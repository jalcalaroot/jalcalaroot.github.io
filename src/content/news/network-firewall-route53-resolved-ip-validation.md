---
title: "Network Firewall checks that destination IPs really came from your Route 53 Resolver"
description: AWS Network Firewall can now validate that a connection's destination IP was resolved by your VPC's Route 53 Resolver, closing the SNI/Host-header spoofing gap in domain allowlists and extending domain rules to SSH, SFTP and other non-HTTP protocols.
pubDate: 2026-10-21
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/network-firewall-route-53-ip-validation/
tags: [network-firewall, route-53, security, egress]
---

**AWS Network Firewall** now supports **Route 53 Resolved IP Validation**. Instead of trusting only the domain a client *claims* — the TLS SNI or the HTTP `Host` header — the firewall can check whether the destination IP was actually returned by your **VPC's Route 53 Resolver** when it resolved a domain.

It comes in two levels:

- **Policy level — resolved IP validation.** A firewall policy setting that verifies the destination IP was resolved through your VPC Resolver for *any* domain.
- **Rule level — resolved-domain rules.** Match *specific* domains, either with the domain list target type `AWS_ROUTE_53_RESOLVED_DOMAIN` or the Suricata keyword `aws_route_53_resolved_domain`. These require the policy-level setting.

Available in all commercial Regions where Network Firewall and Route 53 Resolver DNS Firewall are available, at no additional charge.

## Why it matters

Domain allowlists for egress have a well-known hole: a compromised workload can send `SNI: api.allowed-vendor.com` to an attacker's IP and walk straight through a rule that only inspects the SNI. Resolved IP validation ties the allowed name to the IPs your own resolver handed out, so spoofed SNI to an arbitrary IP no longer matches.

The second benefit is just as useful: because the check is IP-based, domain logic now works for traffic that carries **no domain name at all**. "This subnet may SFTP only to `sftp.partner-bank.com`" used to mean maintaining IP lists by hand; now it can be a domain rule.

## What I'd check before turning it on

- **Everything must resolve through the VPC Resolver.** Workloads with hard-coded IPs, their own DNS servers or DNS-over-HTTPS won't produce resolutions the firewall knows about. Block outbound 53/853 to the internet and pair this with **Route 53 Resolver DNS Firewall**, so DNS itself is controlled too.
- **Hybrid DNS paths.** If some VPCs forward to on-premises resolvers, confirm how those resolutions are seen before enforcing.
- **Roll out with alerts first.** Start with alert rules on a non-critical egress path, review the logs, then move to drop — the classic way an egress control causes an outage is a dependency nobody documented.

## Security and compliance angle

For finance and healthcare workloads, egress control is usually an audit item ("how do you prevent data exfiltration?"). This turns a domain allowlist from a best-effort control into one that can't be bypassed by setting a header — a much easier story to defend. And at no extra charge, the only cost is the engineering time to roll it out carefully.
