---
title: "Azure Container Apps Behind Application Gateway"
description: The internal-only environment setting that makes an NSG actually mean something, a Let's Encrypt certificate that never touches a file, and the three failures that got there — a 403, a 301 loop, and an empty certificate attribute.
pubDate: 2026-09-06
---

I wanted a reusable pattern for putting a container on the public internet from Azure without punching a hole straight through the network I'd already spent time locking down. The stack ended up being Container Apps (Consumption), Application Gateway, a dedicated ACR and Key Vault, and a Let's Encrypt certificate issued through Terraform — all applied via GitHub Actions over OIDC. The container itself is a hello-world; the plumbing around it is the part meant to be reused.

## The setting that decides whether the NSG means anything

Container Apps gives you two ways to expose the environment: external or internal. External sounds like the obvious pick for something public-facing, until you read what it actually does — inbound traffic for an external, workload-profile environment routes through a Microsoft-managed public IP that never touches your VNet's subnet. It skips the subnet's NSG entirely. If the rest of your infrastructure assumes that NSG is actually restricting something, an external environment quietly makes it decorative.

```hcl
resource "azurerm_container_app_environment" "this" {
  infrastructure_subnet_id       = var.network_containerapps_subnet_id
  internal_load_balancer_enabled = true
  # ...
}
```

One flag, and the environment's only address is private, inside the VNet. That forces something else to be the actual front door — Application Gateway, which ends up doing double duty as both the one public IP in the whole stack and the place TLS terminates. Everything behind it is a plain HTTP hop, because the certificate work already happened.

An internal environment doesn't register its FQDN anywhere the VNet can resolve, either — that's a separate Private DNS Zone you have to create yourself, named exactly after the environment's `default_domain` and linked to the VNet by hand. Skip it and Application Gateway can reach the environment's IP but never resolve its hostname.

## A certificate that never touches a file

The TLS certificate comes from Let's Encrypt via a DNS-01 challenge against a zone I already control, issued through the `vancluever/acme` Terraform provider and imported straight into a dedicated Key Vault. Application Gateway reads it from there through its own managed identity, scoped to exactly one permission: read that vault's secrets. No `.pfx` ever sits on a laptop or in a CI artifact.

Two things about that pipeline weren't obvious until they broke a real apply. First, the certificate resource has to generate its own private key from `common_name` — feed it an external CSR instead (`certificate_request_pem` + `tls_cert_request`) and the `certificate_p12` attribute it produces comes back silently empty. Nothing errors at that resource. The failure surfaces one step later, when Key Vault refuses to import an empty certificate:

```
Error: expected "certificate.0.contents" to not be an empty string
```

Second, Azure role assignments don't take effect the instant Terraform reports them created. The first apply that touches the vault's data plane — the certificate import, or Application Gateway resolving the secret — can 403 even though the role assignment already shows up in state:

```hcl
resource "time_sleep" "wait_for_kv_rbac" {
  depends_on = [
    azurerm_role_assignment.current_user_kv_admin,
    azurerm_role_assignment.appgw_kv_secrets_user,
  ]
  create_duration = "90s"
}
```

Not elegant, but accurate — it's a real propagation window, not a race condition to code around.

## The 301 loop nobody warns you about

Application Gateway's backend settings talk to the container app over plain HTTP — TLS already terminated upstream, and the whole hop lives inside the VNet. Container Apps' own edge proxy doesn't know that: it enforces HTTPS by default and 301-redirects any HTTP request back to its own FQDN. Application Gateway just relays that redirect to the client instead of following it.

The symptom is the deceptive part — the site loads, with a valid certificate and the right hostname, and then quietly serves a 301 pointing at a hostname the visitor was never supposed to see. It took comparing the redirect target byte-for-byte against the container app's internal FQDN to realize the page was never actually being served. The fix is one flag on the ingress block:

```hcl
ingress {
  target_port                = 80
  allow_insecure_connections = true # TLS already terminated at App Gateway; this hop is plain HTTP inside the VNet
}
```

## CI identities that can't wander outside their lane

Two managed identities authenticate GitHub Actions to Azure over OIDC — no stored secrets. The part worth calling out is how narrowly each is scoped: not Contributor on a shared resource group, but Contributor on *this project's own* resource group, `DNS Zone Contributor` on the one DNS record it needs, `Network Contributor` on the one subnet it joins. Nothing here can reach the shared virtual network or any other project's resources, so a compromised workflow here has a small blast radius by construction.

That precision has a cost — every new resource type this project touches means checking whether the CI identity actually has the specific permission for it, and more than once it didn't. The one that actually broke a pipeline run: `Storage Blob Data Contributor` on the state storage account covers the data-plane blob operations Terraform needs for locking, but not the separate management-plane read (`Microsoft.Storage/storageAccounts/read`) that Terraform's own data source uses to look the account up in the first place. Without a plain `Reader` at that same scope, the very first plan for a brand-new identity fails with `AuthorizationFailed` on a data source, before touching a single real resource.

## What's actually reusable

The hello-world container was never the point. What's worth carrying into whatever runs on Container Apps next is the shape around it: internal-only compute with a single gateway as the only public surface, a certificate that lives in a vault instead of a file, and CI identities that can't touch anything beyond what they were explicitly granted. The [full Terraform](https://github.com/jalcalaroot/azure-container-apps) is the reference if any of those pieces need copying wholesale.
