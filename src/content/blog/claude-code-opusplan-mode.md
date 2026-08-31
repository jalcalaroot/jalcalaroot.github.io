---
title: "opusplan: Let Opus Plan the Infra Change, Let Sonnet Write It"
description: How Claude Code's opusplan mode splits a Terraform change across two models — Opus for the reasoning that has to be right, Sonnet for the HCL that mostly writes itself.
pubDate: 2026-08-31
---

Every infra change I make with an agent has two phases with very different failure costs. Getting the *plan* wrong — reordering a subnet CIDR, missing that a resource has `prevent_destroy` for a reason, misjudging blast radius — is expensive to catch late. Writing the actual HCL once the plan is right is comparatively mechanical. I'd been running whole sessions on one model regardless of which phase I was in: full Opus rates for boilerplate, or Sonnet reasoning through architecture decisions it wasn't the best tool for. `opusplan` is Claude Code's answer to that mismatch — less a "smarter model" than a routing decision.

## What it actually does

`opusplan` is a model alias, not a new model — set it with `/model opusplan` in a session, `--model opusplan` on the CLI, or `"model": "opusplan"` in `settings.json`. Once set, Claude Code runs Opus while you're in Plan Mode and switches to Sonnet the moment you approve the plan and execution starts. Same session, same context, nothing re-explained — the model underneath just changes with the phase.

```bash
$ claude --model opusplan
> /plan
# Opus reasons through the change, reads the repo, drafts the plan
# you approve →
# Sonnet takes over to write the actual diff
```

## Why this maps onto IaC specifically

`terraform plan` / `apply` is already a two-phase workflow with asymmetric risk — plan is where you catch the mistake, apply mostly executes what the plan already decided. `opusplan` puts that same asymmetry on the model choice: the phase where being wrong is expensive — does this change actually do what I think, does it respect `prevent_destroy`, does it interact badly with something torn down last session — runs on the model with the deepest reasoning. The phase where being wrong is cheap and immediately visible — writing the `resource` block itself — runs on the faster, cheaper model, because a slightly-off Sonnet diff gets caught by `terraform plan` and a human reading it anyway.

## The actual efficiency argument

This isn't "Opus is smarter, use it always" or "Sonnet is cheaper, use it always" — it's that the two phases don't need the same thing, and paying Opus rates for a phase where Sonnet's ceiling is already high enough buys nothing. All-Opus is more expensive than it needs to be for boilerplate. All-Sonnet loses reasoning depth exactly where I want it most — the moment I'm deciding whether a resource is safe to destroy, not after.

## Caveats worth knowing before flipping it on

- **Context window ceiling.** Without an automatic 1M-token upgrade tier, force it with `opusplan[1m]` if a long planning session needs the room.
- **Org-restricted model lists degrade silently, not with an error.** If a workspace policy excludes Opus, `opusplan` quietly stays on Sonnet for the whole session — worth confirming `/model` actually shows Opus during the plan phase rather than assuming it did.
- **Not every provider supports the switch.** Bedrock, Vertex AI, Foundry, and Mantle backends don't do model-alias switching — `opusplan` just pins to whatever the session model already is.

## Where this actually pays off

The projects where this matters most are the ones that get paused and resumed across weeks — the exact shape of most of the infra work here. Every resumed session starts with a planning phase almost by necessity: what's the current state, what changed, what's actually safe to touch. That's the expensive-to-get-wrong part, and it's short relative to the execution that follows it. `opusplan` means not paying for reasoning depth during the part of the session that doesn't need it — and not settling for less of it during the part that does.
