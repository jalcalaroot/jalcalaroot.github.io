---
title: "The Boring Way to Expose a Container App on Azure"
description: Why an internal-only Container Apps Environment behind Application Gateway beats the one-line "make it external" shortcut, and what that decision drags in — DNS-01 certificates into Key Vault, resource-scoped CI identities, and an environment built to be torn down.
pubDate: 2026-09-06
---

I wanted a real, reusable pattern for putting a container on the public internet from Azure without punching a hole straight through the network I'd already spent time locking down. Not a tutorial's happy path — the actual shape of it: Terraform, OIDC CI/CD, the same Checkov/tflint/gitleaks gate every other project in this workspace runs, and a hello-world container that exists only to prove the plumbing works. The interesting part turned out to be less about Container Apps itself and more about the one setting that decides whether the network design around it means anything at all.

## The one flag that makes the NSG mean anything

Azure Container Apps has two ways to expose the environment: external, or internal. External sounds like the obvious choice for something that needs to be public — until you read what it actually does. An external, workload-profile environment routes inbound traffic through a Microsoft-managed public IP that lives *outside* your VNet's subnet. It never touches the subnet's NSG at all. So if the rest of your infrastructure is built around network security groups actually restricting traffic, an external Container Apps environment quietly makes the NSG on that subnet decorative — the traffic that matters skips it entirely.

Internal-only closes that gap:

```hcl
resource "azurerm_container_app_environment" "this" {
  internal_load_balancer_enabled = true
  # ...
}
```

One line, and the environment's only address is a private one inside the VNet. Nothing reaches the container app except through whatever I explicitly route to it — which meant something else now had to be the actual front door.

## Application Gateway ended up doing double duty

That something else is Application Gateway, and it ends up doing two jobs at once: it's the only public IP in the whole stack, and it's where TLS actually terminates. Everything behind it — from the gateway to the container app — is a plain HTTP hop inside the VNet, because the certificate work already happened.

That single decision has a side effect that isn't obvious until you hit it: Container Apps' own edge proxy enforces HTTPS by default and 301-redirects anything that arrives over HTTP back to its own FQDN. Application Gateway's backend settings talk to the container app over HTTP — TLS already terminated upstream — so without disabling that enforcement, every request loops: the browser gets a valid certificate and a 301 pointing at a hostname it was never supposed to see.

```hcl
ingress {
  allow_insecure_connections = true
  # ...
}
```

The fix is one flag, but the symptom without it is deceptive — the site *loads*, with a real certificate, and just quietly redirects to the wrong place. It took a byte-for-byte comparison of the redirect target against the container app's internal FQDN to see what was actually happening.

## The certificate lives in Key Vault, not in a file anywhere

The TLS certificate itself comes from Let's Encrypt via a DNS-01 challenge against a zone I already control, issued through the `vancluever/acme` Terraform provider and imported straight into a dedicated Key Vault. Application Gateway reads it from there through Key Vault-integrated TLS termination, using a managed identity scoped to exactly one permission: read that one vault's secrets. No certificate file ever sits on a laptop or in a CI artifact.

Two things about that pipeline weren't obvious going in. First, `acme_certificate` only produces an importable `certificate_p12` when it generates its own private key from a `common_name` — feed it an external CSR instead and that attribute comes back silently empty, and the failure doesn't surface until Key Vault refuses it three resources later. Second, Azure role assignments don't take effect instantly; the first apply that touches the vault's data plane can 403 even though the role assignment already shows up in the Terraform plan as created. A 90-second `time_sleep` between the RBAC grant and the first read isn't cargo-culting — it's the actual propagation window.

## CI identities that can't touch the network

The GitHub Actions side authenticates to Azure via OIDC — no stored secrets — through two dedicated managed identities, and the part worth calling out is how narrowly each one is scoped. Not "Contributor on the resource group and move on": Contributor on *this project's* resource group, `DNS Zone Contributor` scoped to the one DNS zone record it needs, `Network Contributor` scoped to the one subnet it has to join. Nothing here can reach the shared virtual network, the shared Key Vault from the network layer, or any other project's resource group.

That's slower to write than a blanket role assignment — every new resource type this project touches means checking whether the CI identity actually has the specific permission for it, and more than once it didn't (a management-plane `Reader` on the state storage account, separate from the data-plane `Storage Blob Data Contributor`, was one gap that only showed up on the first real pipeline run). But the alternative is a compromised workflow in a disposable hello-world project having write access to production-adjacent shared infrastructure, which isn't a trade I'm willing to make for saving a few lines of Terraform.

## Built to be torn down, not just built to run

Application Gateway bills by the hour whether or not anything is calling it, so this environment doesn't stay up between uses — it goes down when I'm not actively working with it and comes back with `terraform apply` when I am. That only works cleanly because nothing has a `prevent_destroy` lifecycle block and the Key Vault has purge protection off on purpose: a `terraform destroy` actually finishes, and a fresh `terraform apply` afterward doesn't fight a soft-deleted resource with a name collision.

Reproducibility ended up mattering more than uptime here. The pattern this project proves out — internal-only compute, a single gateway as the public surface, certificates that live in a vault instead of a file, CI identities that can't wander outside their lane — is the part that's actually reusable for whatever runs on Azure Container Apps next. The hello-world container was never the point.
