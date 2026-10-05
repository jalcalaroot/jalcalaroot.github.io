---
title: "DCsv3 and DCdsv3 confidential VMs retire on October 31, 2029 — but the real deadline is this month"
description: The SGX-based DCsv3 and DCdsv3 series retire in 2029, but reservations can only be bought or renewed until October 31, 2026 and capacity restrictions start November 1, 2026. If you run enclaves for regulated workloads, start planning now.
pubDate: 2026-10-01
provider: azure
source: https://azure.microsoft.com/updates?id=569592
tags: [confidential-computing, virtual-machines, retirement, finops]
---

Microsoft has announced the retirement of the **DCsv3 and DCdsv3-series** VMs — Linux, Windows and Dedicated Host — on **October 31, 2029**. After that date they can no longer be used or purchased.

The date that matters more is much closer:

- **October 31, 2026** — last day to purchase or renew 1-year and 3-year Reserved VM Instances for these series.
- **November 1, 2026** — capacity restrictions begin.

Microsoft's recommended targets are the **DCasv6 / DCadsv6 / DCesv6 / DCedsv6** confidential VM series, the memory-optimized **ECasv6 / ECadsv6 / ECesv6 / ECedsv6** series, or containerized options: **Confidential Azure Container Instances** and **virtual nodes on Azure Container Instances**.

## Why it matters

DCsv3 and DCdsv3 are the Intel SGX sizes — the ones you pick when an application runs code inside **enclaves**. The recommended v6 confidential VMs protect the **whole VM** instead. That's not a size swap: moving from application enclaves to a confidential VM changes the trust boundary, the attestation flow and, often, the application itself. In finance and healthcare these workloads usually exist because a compliance or contractual requirement asked for hardware-backed isolation, so the migration needs security and compliance sign-off, not just a Terraform change.

Capacity restrictions starting next month also mean scale-out and new deployments on these sizes can't be taken for granted anymore — a real risk for anything that autoscales.

## Find them now

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
    or type =~ 'microsoft.compute/virtualmachinescalesets'
| extend size = coalesce(tostring(properties.hardwareProfile.vmSize), tostring(sku.name))
| where size matches regex @'(?i)^Standard_DC\d+d?s_v3$'
| summarize count() by size, type, subscriptionId
```

Then search your IaC and AKS node pool definitions for the same sizes — confidential AKS node pools count too.

## The FinOps angle

If you hold reservations on DCsv3 or DCdsv3, don't auto-renew a 3-year term on a series with a retirement date and capacity restrictions. Decide before October 31 whether a shorter term, an exchange, or a move to the v6 series fits your migration timeline — and benchmark the target size with your workload first, because billing may change after migration.
