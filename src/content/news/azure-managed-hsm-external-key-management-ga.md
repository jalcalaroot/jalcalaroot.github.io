---
title: "Managed HSM external key management is GA: hold your own key outside Microsoft"
description: Azure Key Vault Managed HSM can now delegate wrap and unwrap operations to a customer-operated HSM outside Microsoft, through an EKM proxy. Real sovereignty for regulated data — with the availability risk moving to you.
pubDate: 2026-10-16
provider: azure
source: https://azure.microsoft.com/updates?id=574296
tags: [managed-hsm, encryption, sovereignty, compliance]
---

**External key management (EKM)** for **Azure Key Vault Managed HSM** is now generally available in all Azure public regions. Organizations with regulatory or sovereignty requirements can keep their **key-encryption keys (KEKs)** in an HSM they operate **outside Microsoft infrastructure**.

How it works: an Azure service configured with a customer-managed key points at a **Managed HSM key URI** as usual. For external keys, Managed HSM authenticates the request and forwards the wrap/unwrap operation through your **EKM proxy** to your external HSM. The service's data encryption key is unwrapped and returned; the KEK itself never leaves your HSM. Proxy connectivity runs over the public internet with mutual TLS at GA; **Private Link** connectivity is still in **preview**.

Microsoft doesn't ship the proxy — vendors implement it. Named partners include Entrust, Eviden, Fortanix, Futurex, Securosys, Thales and Utimaco. The feature is enabled per subscription; the announcement notes access goes through your Microsoft account team.

## Why it matters

Customer-managed keys in Key Vault or Managed HSM still sit in Microsoft-operated hardware. For some regulators, central banks and public-sector health data, that's not enough: they want the key physically under the customer's control, and the ability to cut Microsoft off. EKM provides exactly that, without each Azure service integrating with a different HSM vendor — they keep using Managed HSM.

## The trade-off: you now own availability

The documentation is blunt about it:

- The **Managed HSM SLA doesn't cover your proxy or external HSM**, and outages caused by them don't count against the SLAs of dependent services such as Azure Storage.
- Every external operation adds **network round-trips** — higher latency than an in-Azure key.
- **No backup/restore** of external keys in Managed HSM, and **no multi-region replication** with external keys.
- **Secure Key Release** and the confidential VM disk-encryption scenarios that need it are **not supported**.
- External key identifiers are immutable; rotate by creating new key versions.
- Sovereign clouds (Azure Government, Azure China) are out of scope.

So design the external HSM and proxy as tier-0 infrastructure: redundant, monitored and in your DR plan. If they're down, your storage accounts and databases using that key can be too.

## Getting started

Enablement starts with a subscription feature flag:

```bash
az feature register --namespace Microsoft.KeyVault --name MHSM_EKM \
  --subscription "<subscription-id>"
az feature show --namespace Microsoft.KeyVault --name MHSM_EKM \
  --subscription "<subscription-id>" --query properties.state -o tsv
```

## Cost angle

Microsoft adds no surcharge: you pay standard Managed HSM pricing plus your own HSM, proxy, connectivity and operations. Use it where a mandate requires keys outside Microsoft — Microsoft itself recommends regular Managed HSM keys for every other workload.
