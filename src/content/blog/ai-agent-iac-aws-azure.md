---
title: "Shipping IaC Faster (and Safer) with Claude Code, VS Code, and AWS/Azure"
description: How an AI coding agent fits into a multicloud Terraform + CloudFormation workflow without turning "fast" into "reckless."
pubDate: 2026-08-23
---

I run infrastructure on both Azure (Terraform) and AWS (CloudFormation). Different clouds, different IaC tools, same underlying question every time I sit down to make a change: how do I ship this fast, without shipping a mistake that costs me a weekend?

Lately that workflow has an AI agent in it — [Claude Code](https://claude.com/product/claude-code) running inside VS Code's terminal, next to the actual editor. Here's the shape of that workflow, and where I still keep a human hand firmly on the wheel.

## The stack

- **VS Code** — the editor, the diff viewer, the place I actually read the code before it ships.
- **Claude Code** — an agent that reads the repo (not just the open file), runs commands, and drafts changes as a normal git diff.
- **Terraform** (Azure) and **CloudFormation** (AWS) — the IaC layer itself, each with its own state, its own quirks.
- **GitHub Actions** — CI: linting, security scanning, cost estimates, and the actual `apply`/`deploy`.

The point of the agent isn't autocomplete. It's that it can read a `CLAUDE.md` describing *why* a repo is built the way it is — "subnets are regional, don't reintroduce per-AZ subnets," "this password is intentionally not the mailto pattern," "don't remove `prevent_destroy` and forget to put it back" — and actually honor that context across a session instead of me re-explaining it every time.

## Secure by default, not secure by afterthought

The fastest way an AI-assisted workflow goes wrong is treating "the agent wrote it" as a substitute for review. A few rules that keep it from doing that:

**Nothing sensitive lives in the repo, ever — not even the AI is told to skip this.** I caught this firsthand: reviewing an old CloudFormation repo before making it public, a parameter file had a plaintext admin password checked in from years back. An agent with read access to the full repo can *find* that kind of thing during a routine review — but only if you actually ask it to look, and only if you still check the diff yourself before anything goes further. The fix is boring and correct: rotate the credential, pull it out of the file, and if it's genuinely spread across history, squash rather than trying to scrub commit-by-commit in a young repo.

```json
// before — never this
{ "ParameterKey": "AdminPassword", "ParameterValue": "hardcoded-in-plaintext" }

// after — reference a secret store, not a literal
{ "ParameterKey": "AdminPasswordSSMParam", "ParameterValue": "/app/dev/admin-password" }
```

**State stays remote and locked, on both clouds.** Terraform state in an Azure Storage Account container; CloudFormation's state *is* the stack itself, but the deploy role that touches it should be as narrow as the change requires — not an account-admin credential reused everywhere.

**Policy-as-code runs before a human even looks.** [Checkov](https://www.checkov.io/) in CI catches the obvious misses — an open security group, a bucket without encryption — before they reach a `terraform apply` or a CloudFormation deploy. An agent drafting the change can run the same scanner locally first and fix what it flags, so the PR arrives already clean instead of red.

## Efficient by default: review the plan, not the philosophy

The other failure mode is the opposite one — being so cautious that IaC changes take a day to ship. The fix isn't skipping review, it's making the review actually informative:

- **`terraform plan` / CloudFormation change sets, always, before apply.** Never `apply` blind. The agent can run this and paste the *output* into the conversation — reviewing "add 3, change 1, destroy 0" takes ten seconds; reviewing raw HCL diffs takes longer and tells you less about blast radius.
- **[Infracost](https://www.infracost.io/) on the PR.** A cost delta on the diff turns "did we mean to provision that?" into a five-second glance instead of a surprise on next month's bill.
- **One clear ask per session.** "Add a new subnet tier for private endpoints, update the NSG, don't touch existing CIDRs" gets a focused diff. A vague "clean up the network module" invites scope creep — from the agent and from me.

A concrete loop looks like this:

```
me:    add an AWS Gateway Load Balancer in front of the existing
       firewall appliances, multi-AZ, reuse the existing Transit
       Gateway attachment

agent: reads the repo, drafts the CloudFormation template + params,
       runs `aws cloudformation validate-template`, shows the diff

me:    read the diff, adjust the AZ list, ask for a change set

agent: creates the change set, pastes the resource-level plan

me:    approve → CI runs Checkov + Infracost → merge → deploy
```

Nothing in that loop skips a human decision point. What changes is *how much typing* separates "I know what I want" from "here's a reviewable diff."

## Where the agent stays on a short leash

An agent is good at drafting, good at running the boring validation commands, good at noticing an inconsistency across files a human would skim past. It is not the thing that gets to decide a production resource is safe to destroy. `prevent_destroy` lifecycle blocks, manual approval gates on the apply job, and a human reading the final plan output before typing "yes" — those stay non-negotiable regardless of how the diff got written.

The productivity win isn't "the AI ships infrastructure for me." It's that the distance between *I know what I want changed* and *a diff I can actually evaluate* got a lot shorter — on both clouds, in the same editor, without switching mental models every time I cross from Terraform to CloudFormation.
