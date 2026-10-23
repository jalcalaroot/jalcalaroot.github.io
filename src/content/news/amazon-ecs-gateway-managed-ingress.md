---
title: "Amazon ECS Gateway: managed ingress for ECS services"
description: ECS can now provision and run the Application Load Balancers in front of your services. Platform teams define ingress, TLS and WAF once on a gateway; application teams opt in with a connector and get an HTTPS hostname — up to 25 services per ALB.
pubDate: 2026-10-20
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/announcing-amazon-ecs-gateway/
tags: [ecs, containers, networking, finops]
---

AWS launched **Amazon ECS Gateway**, a managed ingress resource for ECS. A platform team creates a gateway, sets its networking and security standards once, and associates it with one or more clusters. Application teams then opt a service in by adding a **gateway connector** that names the container port to expose. ECS takes it from there.

What ECS creates and manages in your account:

- **Shared per gateway:** the Application Load Balancer, its HTTPS listener and the load balancer security group.
- **Per service:** an ACM certificate, a unique hostname (`https://<id>.ecs.<region>.on.aws`), a listener rule, a target group and a service security group.

Up to **25 services share one ALB** via host-based routing; ECS adds ALBs as they fill up and removes them when empty. A **WAF web ACL** set on the gateway applies to every connected service. It works with `awsvpc` services on EC2, Fargate and ECS Managed Instances, in all commercial Regions, with no charge for the gateway itself — you pay for the ALBs, logs, metrics and data transfer it creates.

## Why it matters

Ingress has always been the part of ECS that every team re-solved: one ALB per service (expensive), or a hand-built shared ALB with listener-rule priorities managed by whoever was brave enough. ECS Gateway turns that into a platform-engineering contract — the platform owns scheme, subnets, TLS and WAF; the service owner just declares a port. For landing zones in regulated environments that's the right split: nobody can ship a public endpoint without the gateway's WAF in front of it.

## Read the limits before you migrate

From the documentation:

- **HTTPS on 443 only**, hostname-addressed traffic only — non-HTTP protocols are out of scope.
- **Immutable settings** — name, scheme, subnets, listener and IP address type can't change. Get internal vs internet-facing right the first time.
- **Single account**: gateway and clusters must live in the same account.
- **No consolidation**: ECS doesn't move services between ALBs, so half-empty ALBs can linger after churn.
- **Out-of-band changes aren't repaired.** If someone edits a managed listener rule or security group, ECS won't fix it and later deployments can fail. Protect resources tagged `AmazonECSManaged=true` with an SCP or permission boundary.

## Cost angle

Twenty-five services behind one ALB instead of twenty-five ALBs is a real saving in fixed hourly charges for internal tools and small APIs. Just remember that LCU charges and data transfer still scale with traffic, and tag your gateways so the shared ALB cost can be allocated back to the services using it.
