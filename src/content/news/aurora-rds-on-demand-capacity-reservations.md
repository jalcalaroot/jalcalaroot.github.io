---
title: "Aurora and RDS get On-Demand Capacity Reservations"
description: You can now reserve database instance capacity in specific Availability Zones — immediately or up to 120 days ahead — so create, restore, scale and start operations don't fail for lack of capacity. Billed at On-Demand rates whether you use it or not.
pubDate: 2026-10-21
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-aurora-rds-on-demand-capacity-reservations/
tags: [rds, aurora, resilience, finops]
---

**Amazon Aurora and Amazon RDS** now support **On-Demand Capacity Reservations**, the same idea EC2 has had for years: reserve compute capacity for DB instances in one or more Availability Zones, for as long as you need it. The goal, in AWS's words, is that DB instance create, restore, scale-compute and start operations don't fail because of insufficient capacity.

- **Immediate reservations** have no commitment and can be cancelled at any time.
- **Future-dated reservations** can be scheduled **5 to 120 days ahead** and carry a minimum commitment.
- Reserve **two or more AZs** to back Multi-AZ deployments.
- To consume the capacity, you **reference the reservation** when you create, restore, modify or start a DB instance.

Available for Aurora and RDS in all commercial Regions.

## Why it matters

Most DR plans for databases quietly assume that the instance class you need will be there when you restore a snapshot in another AZ or Region, or when you scale up for a peak. Usually it is. During a regional event — exactly when everyone else is restoring too — it may not be, especially for large or newer instance classes. A capacity reservation turns that assumption into a guarantee you can point to in a DR test or a BCP review.

The other obvious use is planned events: a migration cutover weekend, a product launch, a month-end close or a seasonal peak where you know you'll need bigger instances on a specific date.

## The FinOps angle

This is insurance, and it's billed like it:

- Reserved capacity is charged at the **On-Demand rate while the reservation is active, whether or not instances use it**. Unused capacity shows up on the bill as *unused reservation*.
- **Stopping a DB instance doesn't reduce the cost** — its capacity simply becomes unused reservation.
- A capacity reservation gives **no discount by itself**. Discounts come from Reserved DB Instances or Database Savings Plans, which AWS applies automatically to matching usage.
- It covers compute only; storage, I/O and backups are billed as usual.

So reserve for the windows that matter — DR standby capacity for tier-1 systems, migration and peak windows — set an end date, and add unused-reservation charges to your cost anomaly reviews. A reservation someone forgot to cancel is pure waste.

## Security and compliance angle

For regulated workloads with RTO commitments, reserved standby capacity is a concrete control you can document and test, rather than a hope written into a runbook.
