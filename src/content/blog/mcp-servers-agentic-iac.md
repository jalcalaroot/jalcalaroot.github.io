---
title: "What 4 MCP Servers Actually Change When You're Managing Real Infra"
description: What actually changes when an agent writing Terraform can check the registry, the live account, and the repo instead of working from memory.
pubDate: 2026-08-27
---

An agent drafting Terraform has the same weak spot every time: it writes from what it remembers about a provider, not from what's actually in the registry or in your account right now. Most of the time that's close enough. Occasionally it isn't, and you don't find out until `terraform plan` disagrees with you. MCP servers close that gap by giving Claude Code something to check against instead of something to remember. I wired up four — Terraform, Azure, AWS, GitHub — and the difference shows up in a few concrete places.

## Provider docs stop being a guess

Before, an argument name or a provider version was whatever I already knew or what a web search turned up — good enough most of the time, silently wrong occasionally, and there was no way to tell which from inside the conversation. The Terraform MCP server (HashiCorp's official one) queries the real registry: current provider versions, valid resource arguments, module docs. Now that check happens before the HCL gets written, not after `terraform validate` complains.

```hcl
# before: written from memory, argument name half-remembered
resource "azurerm_mysql_flexible_server" "this" {
  sku_name = "..."          # is it sku_name or sku? which version?
}

# after: confirmed against the registry first, then written
```

Small difference on any one resource. It compounds on a session that touches five files across three providers.

## Checking real infrastructure instead of assuming it

Every environment check I'd done up to this point was a `Bash` call to `az` or `aws`, followed by me reading raw JSON or a text table and translating it back into an answer. That's a place errors sneak in — not in the query, in the reading. The Azure and AWS MCP servers make that a direct, structured call instead: does this resource group already exist, what's actually deployed right now, before I tell you whether a plan is safe to apply. For a project that gets paused and resumed across weeks — which is how all of these repos actually get worked on — that matters more than it would on something touched daily. The state in my head decays between sessions; querying the account directly doesn't.

## Read-only by default, on purpose

Both the Azure and AWS servers ship a `--read-only` flag that disables anything resembling a write. I turned it on for both, and it wasn't a hard call — it's the same rule that's already written into how these projects work: infrastructure changes go through Terraform and a PR, never a direct console or CLI edit. Giving an agent broader reach into real cloud accounts only makes sense if that reach can't casually cross into the one thing already off-limits. The flag makes the boundary structural instead of a rule I have to remember to enforce every session.

## GitHub, without the hand-built API calls

Every piece of repo administration up to now was a raw `gh api` call — a `PATCH` with a hand-nested JSON body for something like enabling secret scanning push protection, correct, but with more room to typo a field name than I'd like. The GitHub MCP server turns that into structured tool calls instead of strings I have to get exactly right. Less relevant to Terraform directly, but it's the same category of change as the other three: replacing "construct the raw request correctly" with "ask for the outcome."

## What this actually buys, concretely

None of these four turn Claude Code into something that applies infrastructure unsupervised — the plan still gets reviewed, the PR is still the gate, `prevent_destroy` is still there. What changes is where the agent's answers come from. "This argument is valid" becomes a registry lookup instead of a recollection. "This resource group doesn't exist yet" becomes a query instead of an assumption carried over from three sessions ago. For IaC specifically, that's the failure mode that actually costs time — not the agent being wrong in an obvious way, but being *plausibly* wrong in a way that only shows up when `plan` runs against the real account. Grounding it in live state is what closes that gap.
