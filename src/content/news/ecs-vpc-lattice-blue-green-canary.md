---
title: "ECS gets blue/green, linear and canary deployments on VPC Lattice"
description: Traffic shifting for ECS services behind VPC Lattice is now native to ECS — test traffic, lifecycle hooks and alarm-driven rollback included. One less reason to keep an ALB in front of service-to-service traffic.
pubDate: 2026-10-02
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-ecs-vpc-lattice-blue-green-deployments
tags: [ecs, vpc-lattice, deployments]
---

ECS services that use VPC Lattice can now roll out new versions with the same three strategies ECS already offered behind load balancers: **blue/green** (all at once), **linear** (equal increments) and **canary** (a small slice first). The traffic shift is managed by ECS itself — no CodeDeploy, no hand-rolled weighted target groups.

## What's in the box

- **Test traffic** against the new revision before production traffic moves.
- **Lifecycle hooks** — Lambda hooks for automated validation and pause hooks for a manual approval gate.
- **Automatic rollback** driven by CloudWatch alarms and the ECS deployment circuit breaker.
- The previous revision stays up during the shift, so rolling back doesn't mean redeploying.

It works for new and existing services, can be configured from the console, CLI, SDKs or IaC, and is available in every Region where VPC Lattice is.

## Why it matters

Lattice was already the cleanest way to wire service-to-service traffic across VPCs and accounts without peering meshes or Transit Gateway routing for every hop. What was missing was a safe release story: if you wanted canaries, the usual answer was to put an ALB back in the path. That gap is closed now, and for internal east-west services it removes a load balancer per service — fewer resources, less to pay for, less to secure.

## What I'd check before adopting

- **Alarms first.** Automatic rollback is only as good as the CloudWatch alarms it watches. Error-rate and p99-latency alarms scoped to the *new* revision are the minimum.
- **Auth policies.** Lattice auth policies apply to the service, not the revision — make sure the green tasks get the same IAM-based access as blue before any traffic shifts.
- **Hook timeouts.** A pause hook nobody approves is a deployment that never finishes. Decide who owns the approval and how long it may wait.
