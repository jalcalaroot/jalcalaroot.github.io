---
title: "Azure Database for PostgreSQL gets cross-tenant customer-managed keys (GA)"
description: PostgreSQL Flexible Server can now encrypt data with a key held in a Key Vault or Managed HSM in a different Entra tenant. For SaaS providers in regulated industries, the customer keeps the key — and the kill switch.
pubDate: 2026-09-29
provider: azure
source: https://azure.microsoft.com/updates?id=571783
tags: [postgresql, encryption, security, compliance]
---

**Cross-tenant customer-managed keys (CMK)** are now generally available for **Azure Database for PostgreSQL Flexible Server**. The server can be encrypted with a key that lives in an **Azure Key Vault or Managed HSM in a different Microsoft Entra tenant** from the one that hosts the database.

Microsoft positions it for SaaS providers and ISVs: the application and database run in the provider's tenant, while the customer keeps the key in theirs and controls rotation and revocation.

## How it works

The trust between tenants is built with workload identity federation, not shared secrets:

1. In the **provider tenant**, create a multitenant app registration and add a user-assigned managed identity as a federated credential on it.
2. In the **customer tenant**, install that multitenant app, create the key in Key Vault or Managed HSM, and grant the app permissions on the key.
3. Back in the provider tenant, create the PostgreSQL server with the user-assigned identity, the multitenant app ID and the customer's key identifier.

## Limits worth knowing

From the documentation:

- CMK is configured **at server creation** — you can't add it to an existing server, so migrating means a new server.
- **Long-term retention backups are not supported** on cross-tenant CMK servers.
- **Azure PowerShell** doesn't support the cross-tenant configuration yet; the docs cover the portal and ARM templates.
- The key vault must be in the **same region** as the server, and geo-redundant backups and read replicas each need a key vault in their own region.

## Why it matters

In finance and healthcare, "who controls the key" is a contract clause, not a technical detail. Until now, a SaaS provider on Flexible Server either held the key itself or had to run the database inside the customer's tenant. Cross-tenant CMK gives a clean split: operations stay with the provider, cryptographic control stays with the customer. If the customer revokes the key, the data becomes inaccessible — which is exactly the guarantee their auditors want, and exactly the incident your runbooks must cover.

## What I'd check

- **Revocation drills.** Agree with each customer how key revocation, accidental deletion and rotation are communicated, and test what your application does when the key disappears.
- **Soft delete and purge protection** on the customer's vault — losing the key means losing the data.
- **Backup strategy.** If you rely on long-term retention for compliance, plan an alternative before choosing cross-tenant CMK.
