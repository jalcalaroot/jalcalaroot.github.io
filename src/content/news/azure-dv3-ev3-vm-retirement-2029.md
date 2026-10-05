---
title: "Dv3, Dsv3, Ev3 and Esv3 VMs retire on November 15, 2029"
description: Some of the most common general-purpose and memory-optimized VM sizes in Azure now have an end date. Three years sounds like plenty — it isn't, if those sizes are hard-coded across your Terraform.
pubDate: 2026-09-30
provider: azure
source: https://azure.microsoft.com/updates?id=572346
tags: [virtual-machines, retirement, finops]
---

Microsoft has announced that the **Dv3, Dsv3, Ev3 and Esv3** VM series enter the end-of-life stage and **retire on November 15, 2029**. Two more announcements the same day put NVv3 and NVv4 on the same path.

## Why it matters

These are not niche sizes. `Standard_D4s_v3` and `Standard_E8s_v3` sit in a lot of module defaults, landing-zone examples and old Terraform that has been copy-pasted for years. A retirement three years out tends to be ignored until the last six months — exactly when everyone else is migrating too.

## Find them now

Azure Resource Graph gives you the inventory across every subscription you can read:

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| extend size = tostring(properties.hardwareProfile.vmSize)
| where size matches regex @'(?i)^Standard_[DE]\d+(-\d+)?s?_v3$'
| summarize vms = count() by size, subscriptionId
| order by vms desc
```

```bash
az graph query -q "<the query above>" --first 1000 -o table
```

Then grep your IaC for the same pattern — the running VMs are only half of it; the defaults that will create the next ones are the other half.

## The FinOps angle

Treat this as a rightsizing opportunity, not a like-for-like swap. Moving to a current generation is usually the moment to check actual CPU and memory usage, and to line up the change with Reservation or Savings Plan renewals so you don't end up paying for commitments on sizes you're leaving. Benchmark the target size with your workload before committing.
