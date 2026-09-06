---
title: "Azure Container Apps Behind Application Gateway"
description: Terraform architecture for an internal-only Container Apps Environment exposed through Application Gateway — DNS-01 certificates into Key Vault, per-resource RBAC for CI, and the exact gotchas that broke the first three apply attempts.
pubDate: 2026-09-06
---

Terraform module that puts a container on the public internet from Azure without exposing the Container Apps Environment itself. Stack: Container Apps (Consumption), Application Gateway v2, a dedicated ACR, a dedicated Key Vault, and a Let's Encrypt certificate issued via DNS-01. GitHub Actions applies it via OIDC, no stored Azure credentials.

```
                              Internet
                                 |
                    Application Gateway (public IP)
                    TLS termination + HTTP -> HTTPS redirect
                                 |
                    ───── VNet-internal only below this line ─────
                                 |
              Container Apps Environment (internal, Consumption)
                                 |
                    Container App (nginx:alpine, port 80)
```

## Resources

| Resource | Config |
|---|---|
| `azurerm_container_app_environment` | `internal_load_balancer_enabled = true`, Consumption workload profile, joined to an existing subnet |
| `azurerm_container_app` | Single revision, `min_replicas = 1` / `max_replicas = 2`, pulls from ACR via managed identity |
| `azurerm_container_registry` | Basic SKU, `admin_enabled = false` |
| `azurerm_key_vault` | RBAC-authorized, `public_network_access_enabled = true`, purge protection off |
| `azurerm_application_gateway` | Standard_v2 (no WAF), one public listener on 443, one HTTP listener that only redirects |
| `acme_certificate` (`vancluever/acme`) | DNS-01 against an existing Azure DNS zone |
| `azurerm_user_assigned_identity` x4 | 2 workload identities (ACR pull, Key Vault read) + 2 CI identities (agent, plan) |

## Why the environment is internal, not external

Container Apps has two ingress modes for the environment. External routes inbound traffic through a Microsoft-managed public IP that never touches your VNet's subnet — it bypasses the subnet's NSG entirely. That makes the NSG on that subnet decorative for anything arriving that way. Internal keeps the environment's only address inside the VNet:

```hcl
resource "azurerm_container_app_environment" "this" {
  infrastructure_subnet_id       = var.network_containerapps_subnet_id
  internal_load_balancer_enabled = true
  logs_destination                = "log-analytics"
  log_analytics_workspace_id      = var.network_log_analytics_workspace_id

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}
```

Consequence: an internal environment doesn't register its FQDN anywhere the VNet can resolve. You have to create the Private DNS Zone yourself, named exactly after `default_domain`, link it to the VNet, and add a wildcard record — otherwise Application Gateway can never resolve the Container App's hostname:

```hcl
resource "azurerm_private_dns_zone" "containerapps" {
  name                = azurerm_container_app_environment.this.default_domain
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "containerapps" {
  private_dns_zone_id  = azurerm_private_dns_zone.containerapps.id
  virtual_network_id   = var.network_vnet_id
  registration_enabled = false
}

resource "azurerm_private_dns_a_record" "containerapps_wildcard" {
  name                = "*"
  private_dns_zone_id = azurerm_private_dns_zone.containerapps.id
  ttl                 = 300
  records             = [azurerm_container_app_environment.this.static_ip_address]
}
```

## Gotcha: the 301 loop between App Gateway and the Container App

Application Gateway terminates TLS and talks HTTP to the backend — the container app never sees TLS at all, `backend_http_settings` uses `protocol = "Http"` on port 80. But Container Apps' edge proxy enforces HTTPS by default and 301-redirects any plain HTTP request back to its own FQDN. App Gateway just relays that redirect to the client. Symptom: the site loads with a valid certificate and correct hostname, then serves a 301 to `https://<container-app-fqdn>.internal...` instead of the page. Fix is one flag on the ingress block:

```hcl
ingress {
  external_enabled           = true # reachable from outside the environment (App Gateway) - the environment itself stays internal-only
  target_port                = 80
  allow_insecure_connections = true # TLS already terminated at App Gateway; this hop is HTTP inside the VNet
  traffic_weight {
    latest_revision = true
    percentage      = 100
  }
}
```

## Certificate pipeline: DNS-01 into Key Vault, no file ever touches disk

`vancluever/acme`'s `azuredns` provider resolves the DNS-01 challenge against an existing, already-delegated Azure DNS zone, using the same `az login` credentials `azurerm` already has — no separate service principal:

```hcl
resource "acme_certificate" "this" {
  account_key_pem           = acme_registration.this.account_key_pem
  common_name               = local.fqdn
  key_type                  = "RSA2048"
  certificate_p12_password  = random_password.pfx.result

  dns_challenge {
    provider = "azuredns"
    config = {
      AZURE_ZONE_NAME       = data.azurerm_dns_zone.this.name
      AZURE_RESOURCE_GROUP  = data.azurerm_dns_zone.this.resource_group_name
      AZURE_SUBSCRIPTION_ID = var.subscription_id
    }
  }
}
```

**Gotcha**: `certificate_p12` — the attribute imported into Key Vault below — comes back **empty** if the certificate is requested via an external CSR (`certificate_request_pem` + `tls_cert_request`). It's only populated when `acme_certificate` generates its own key from `common_name`. The failure doesn't surface on this resource; it surfaces one resource downstream with `"certificate.0.contents" to not be an empty string`. Cost one full failed apply to trace back.

```hcl
resource "azurerm_key_vault_certificate" "this" {
  name         = "cert-${var.dns_record_name}"
  key_vault_id = azurerm_key_vault.this.id
  certificate {
    contents = acme_certificate.this.certificate_p12
    password = random_password.pfx.result
  }
  depends_on = [time_sleep.wait_for_kv_rbac]
}
```

Application Gateway then reads the secret directly by ID — no copy, no re-upload:

```hcl
ssl_certificate {
  name                = "ssl-hello-world"
  key_vault_secret_id = azurerm_key_vault_certificate.this.secret_id
}
```

**Gotcha**: RBAC propagation lag. Role assignments can take up to a couple of minutes to actually take effect in Azure, even though they show up as created in Terraform state immediately. The first apply that reads the vault's data plane — the cert import above, or App Gateway resolving `secret_id` — can 403 without warning. Fix is a plain wait, not a retry loop:

```hcl
resource "time_sleep" "wait_for_kv_rbac" {
  depends_on = [
    azurerm_role_assignment.current_user_kv_admin,
    azurerm_role_assignment.appgw_kv_secrets_user,
  ]
  create_duration = "90s"
}
```

## RBAC: two CI identities, scoped per resource, not per resource group

Two user-assigned identities authenticate GitHub Actions via OIDC — no stored secrets. Unlike the shared network project's identities (Contributor over an entire shared resource group), both of these are scoped to exactly the resources this project touches:

| Role | Scope | Identity |
|---|---|---|
| Contributor / Reader | This project's resource group | agent / plan |
| DNS Zone Contributor / Reader | The one DNS zone record needed | agent / plan |
| Network Contributor | The one subnet the environment joins | agent only |
| Storage Blob Data Contributor | State storage account (blob lease locking needs write even for `plan`) | agent + plan |
| Reader | State storage account, management plane (`Microsoft.Storage/storageAccounts/read`) | agent + plan |
| Log Analytics Contributor / Reader | The shared Log Analytics workspace | agent / plan |
| Key Vault Reader | This project's Key Vault | plan only |

**Gotcha**: `Storage Blob Data Contributor` is a data-plane role — reading/writing blobs. It does **not** cover the management-plane read (`Microsoft.Storage/storageAccounts/read`) that Terraform's own `data "azurerm_storage_account" "tfstate"` needs to resolve. Without a separate `Reader` at that scope, the first plan/apply for any new identity fails with `AuthorizationFailed` on that data source alone — everything else in the config is fine.

## What's out of scope

WAF on Application Gateway (`Standard_v2`, not `WAF_v2` — cost decision, one-line change if needed), autoscaling beyond `min_replicas`/`max_replicas`, multi-region. Full variable reference and RBAC breakdown: [azure-container-apps](https://github.com/jalcalaroot/azure-container-apps).
