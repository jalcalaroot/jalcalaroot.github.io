---
title: "Application Gateway keyless TLS with Managed HSM is GA"
description: Application Gateway v2 can now terminate TLS while the certificate's private key never leaves Azure Key Vault Managed HSM — every handshake signature is computed inside the HSM. A clean answer for "where does the TLS private key live?" in regulated environments.
pubDate: 2026-10-20
provider: azure
source: https://azure.microsoft.com/updates?id=577130
tags: [application-gateway, managed-hsm, tls, security]
---

**Keyless TLS termination** on **Azure Application Gateway** is now generally available. The certificate's private key stays in **Azure Key Vault Managed HSM** as a non-exportable key; when a client opens an HTTPS connection, the gateway asks Managed HSM to compute the handshake signature, the HSM returns it and the handshake completes. WAF inspection and backend routing then work as usual. The gateway never holds the private key.

What you need, per the documentation:

- An **Application Gateway v2** deployment.
- A **Managed HSM** instance holding the key.
- A **user-assigned managed identity** for the gateway, with RBAC permissions on that specific key.
- The certificate's **public portion** supplied to Application Gateway. Certificate generation uses OpenSSL with the Managed HSM TLS offload library.

## Why it matters

Today, TLS termination on Application Gateway normally means the gateway pulls the full certificate — private key included — from Key Vault. For most workloads that's fine. For banks, payment processors and healthcare platforms, auditors increasingly ask a sharper question: *is the private key for this public endpoint ever outside a validated HSM?* With keyless TLS the answer is no. Microsoft highlights:

- Key custody inside a dedicated **FIPS 140-3 Level 3** validated HSM boundary.
- Access controlled with **managed identities and RBAC**, scoped to individual keys.
- **Signing operations auditable** in Managed HSM diagnostic logs.
- **Separation of duties**: the team that operates the gateway doesn't need to be able to read key material.

## What I'd check before adopting

- **Least privilege on the key.** The docs explicitly recommend scoping HSM permissions as narrowly as possible. Give the gateway's identity signing rights on its own key only — not a broad role on the whole HSM.
- **Turn on diagnostic logging** on Managed HSM and send it to your SIEM. A spike in signing operations is a TLS handshake spike; a failure is an outage waiting to happen.
- **The HSM is now in the request path.** Every new TLS handshake depends on Managed HSM being reachable. Include it in your availability design, monitoring and runbooks, and load-test the listener before moving production traffic.
- **Supported TLS configuration.** The feature depends on a supported Application Gateway TLS configuration — validate your SSL policy and listeners in a non-production gateway first.

## Cost angle

Managed HSM is a dedicated, single-tenant HSM pool billed for as long as it exists, so it's rarely worth deploying for one gateway alone. Keyless TLS makes the most sense where you already run Managed HSM for customer-managed keys — then the same HSM, governance and audit trail cover your TLS keys too.
