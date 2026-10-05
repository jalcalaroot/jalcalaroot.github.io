---
title: "Security Hub groups exposures into remediation plans"
description: AWS Security Hub now rolls findings that share a root cause into a single, prioritized remediation plan with fix instructions in CLI, Terraform, CloudFormation, Python and CDK. Fix the cause once instead of closing the same symptom fifty times.
pubDate: 2026-10-01
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/aws-security-hub-remediation-plans/
tags: [security-hub, security, remediation, iac]
---

AWS Security Hub now has **remediation plans**. Instead of presenting every exposure as its own item, Security Hub groups the findings that come from the same underlying problem — a misconfigured setting, an overly permissive access policy — into one plan. Fix that root cause and the related exposures are resolved or drop in severity together.

Each plan comes with:

- A **priority** (Critical, High, Medium or Low) and impact information, with the plans that remove the most risk surfaced first.
- **Fix instructions in five formats**: AWS CLI, Terraform, CloudFormation, Python and CDK.
- **API access**, so the plans can be consumed programmatically — AWS explicitly calls out AI agents applying fixes at scale.

It is available in every Region where Security Hub is offered, at no additional charge as part of the Security Hub Essentials plan.

## Why it matters

Anyone who has run Security Hub across a real AWS Organization knows the problem: the finding count is a measure of how many resources share a bad default, not of how many things you need to do. One permissive policy or one landing-zone default can light up dozens of accounts, and teams end up triaging symptoms one ticket at a time. Grouping by root cause turns the backlog into something closer to an actual work plan — and gives you a better number to report to a CISO or an auditor than "open findings".

## How I'd use it

- **Fix the code, not the console.** The Terraform and CloudFormation snippets are the useful part. If a misconfiguration was created by a module, the fix belongs in that module — otherwise the next `terraform apply` will happily put the exposure back. Treat the generated IaC as a starting point for a PR, reviewed like any other change.
- **Be careful with automated remediation.** API access for agents is powerful, but changing IAM policies or network exposure in production without a human in the loop is exactly how you cause an outage while fixing a finding. Start with read-only consumption (plans into tickets), then automate low-blast-radius fixes behind an approval step.

## Security and cost angle

For regulated environments — finance, healthcare — the value is evidence: a root-cause view with a documented fix and a closed plan is easier to defend in an audit than a spreadsheet of suppressed findings. And since it ships at no additional charge in the Essentials plan, there's no budget conversation needed to try it.
