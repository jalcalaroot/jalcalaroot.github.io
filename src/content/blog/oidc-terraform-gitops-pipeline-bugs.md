---
title: "Four Real Bugs From My First OIDC + Terraform GitOps Pipeline"
description: What actually broke the first time I ran a GitHub Actions → AWS OIDC pipeline end-to-end — and why none of the fixes were applied by hand.
pubDate: 2026-08-27
---

I built a GitOps pipeline for a personal AWS project: GitHub Actions assumes an IAM role via OIDC — no static credentials anywhere — runs `terraform plan` on a PR, and applies for real only after merge to `main`. On paper it's a well-documented pattern. The first time I actually ran it end-to-end, it broke four different ways before a single resource got created.

None of the fixes happened by clicking around in the AWS console. Every one went in as a code change, through the same pipeline that was failing, and let CI re-prove it. That discipline is the actual point of this post — not the bugs themselves.

## Bug 1: the OIDC `sub` claim isn't what the tutorials show you

Every guide writes the trust policy condition as `repo:OWNER/REPO:ref:refs/heads/main`. Repos created after mid-2026 emit a different claim — GitHub started including numeric IDs to make the claim immutable across renames:

```
# what the docs show
repo:jalcalaroot/thecloudroot:ref:refs/heads/main

# what a new repo's token actually sends
repo:jalcalaroot@12345678/thecloudroot@98765432:ref:refs/heads/main
```

`gh api repos/OWNER/REPO --jq '{id,owner_id:.owner.id}'` gets you the real IDs. Both trust policies (the apply role and the plan role) needed the update — I'd only checked one.

## Bug 2: the plan job tried to assume a role on top of a role

The default Terraform provider had `assume_role` hardcoded to the CRUD role, left over from when everything ran under one identity locally. But the *plan* job already authenticates as the read-only role via OIDC — so on every PR, a read-only identity was trying to assume a role it correctly has no permission to assume, and the plan step failed with an opaque `AccessDenied`.

```hcl
# before — fine for local dev, wrong for CI
provider "aws" {
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::...:role/thecloudroot-dev-agent"
  }
}

# after — the provider uses whatever identity is already active
provider "aws" {
  region = "us-east-1"
}
```

Locally, you assume the role by hand before running Terraform. In CI, OIDC has already put you in the right identity — the provider doesn't need to jump again.

## Bug 3: a read-only role still needs to read itself

`terraform plan` refreshes *everything* already in state — including the two IAM roles the project itself created. The plan role had no `iam:GetRole` / `GetRolePolicy` on those ARNs, so every plan failed trying to refresh its own infrastructure, despite never needing to change it. The fix is a read-only statement scoped tightly to the project's own role ARNs — enough to refresh state, nowhere near enough to modify anything.

## Bug 4: GitHub Free quietly has no second gate

This one didn't have a code fix. Branch protection, repository rulesets, and required reviewers on Environments — all three return "Upgrade to GitHub Pro" on a private repo. Which means: nothing *technically* stops a direct push to `main`, and the PR review is the only human checkpoint before `apply` runs for real. The mitigation is discipline, documented as the rule it is, not a control — if this were a team repo instead of a personal one, that gap would be the first thing to close, budget allowing.

## The part that actually mattered

None of these four were exotic. They were the kind of thing you only find by running the real pipeline against a real cloud account instead of trusting that the YAML "looks right." What made it work wasn't getting it right on the first try — it was refusing to fix any of it by hand in the AWS console, even when that would've been faster. Every bug went in as a diff, and CI proved the fix the same way it had proved the failure.
