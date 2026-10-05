---
title: "GuardDuty enablement becomes an AWS Organizations policy"
description: GuardDuty now supports AWS Organizations declarative policies, so detector and protection-plan enablement is set once at the root or OU level, applied in every Region, and can't be switched off from member accounts.
pubDate: 2026-10-01
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/guardduty-org-enablement-policies/
tags: [guardduty, organizations, security, governance]
---

Amazon GuardDuty is now managed through **AWS Organizations policies** (policy type `GUARDDUTY_POLICY`). From the GuardDuty delegated administrator you define an enablement baseline and attach it at the organization root, an OU or individual accounts. The policy has a `default` block that applies to every Region and optional Region-specific blocks that replace the default where you need something different.

What the policy controls: foundational threat detection plus the protection plans — S3 Protection, EKS Protection, Malware Protection for EBS, RDS Protection, Lambda Protection, AI Protection and Runtime Monitoring. Foundational detection must be enabled in any block that enables another feature.

Two properties make this different from what we had before:

- **It can't be overridden.** Enablement set by a policy cannot be changed from the GuardDuty console or API in the member account.
- **It follows the account.** New accounts, or accounts moved into an OU, inherit the policy automatically.

Available in all AWS commercial Regions and AWS GovCloud (US).

## Why it matters

Until now, org-wide GuardDuty meant a per-Region auto-enable configuration from the delegated admin — a separate setting in every Region, easy to drift, and easy to forget when a new Region is opted in. Moving it into Organizations puts threat detection in the same governance layer as SCPs and the other declarative policies: one place to define it, inheritance through the OU tree, and a clear answer when an auditor asks "how do you guarantee detection is on everywhere?".

## Read this before you click

The GuardDuty docs carry an important warning: **enabling the `GUARDDUTY_POLICY` policy type stops the existing Regional auto-enable settings from applying — even before you attach a policy.** The console enables the policy type automatically when the delegated admin creates the first policy. So don't experiment in production: write down your current auto-enable configuration first, design the equivalent policy (root baseline plus OU-specific overrides), and attach it in the same change.

To record what you have today, per Region:

```bash
aws guardduty describe-organization-configuration \
  --detector-id <detector-id> --region <region>
```

Prerequisites: trusted access for GuardDuty in Organizations, a delegated administrator, and a delegation policy that lets that account manage GuardDuty policies.

## Cost angle

Protection plans are billed per account and Region, and a root-level policy turns them on everywhere it applies. Decide deliberately which plans belong in the baseline and which only make sense for specific OUs — Runtime Monitoring on a sandbox OU, for example, may not be worth it. Regional overrides and OU-level policies are the tool for that.
