---
title: "What 4 MCP Servers Actually Change When You're Writing Infra"
description: The real setup friction, the concrete per-service benefits, and one moment an agent confidently invented a config file — from wiring Terraform, AWS, Azure, and GitHub MCP servers into a multicloud Terraform workflow.
pubDate: 2026-08-27
---

I run Terraform against two clouds — AWS on one project, Azure on another — with GitHub as the PR gate in front of both. Four MCP servers now sit inside that work: Terraform, AWS, Azure, GitHub. Getting there wasn't a clean plug-and-play, and once it was working, verifying it surfaced something worth writing down on its own: an agent that confidently invented a file that never existed.

## Getting there wasn't the boring part

Two of the four had real friction before they ever connected.

**AWS Labs' general-purpose server is deprecated mid-flight.** I went to install `awslabs.aws-api-mcp-server` — the broad, general-access AWS server — and its own startup banner said so: *"entering end of development, migrate to the AWS MCP Server."* The replacement isn't a simple package swap; it's a fully-managed endpoint (`aws-mcp.us-east-1.api.aws/mcp`) fronted by a thin local proxy, `mcp-proxy-for-aws`. Good thing I checked the actual startup output instead of trusting the package name I'd planned to use.

**GitHub's HTTP endpoint failed with a real, useful error.** I first wired `github` as a remote HTTP server — simplest option, OAuth handled entirely by GitHub, no local token. It failed immediately:

```
Incompatible auth server: does not support dynamic client registration
```

Not a timeout, not a vague 401 — a specific protocol mismatch. The client tries OAuth Dynamic Client Registration and GitHub's endpoint doesn't support it. The fix was the less elegant option I'd been avoiding: run it via Docker with a token pulled straight from an already-authenticated `gh` CLI session.

## Terraform MCP: the registry, checked before the HCL is written

Whichever cloud I'm in, the first thing that can go wrong is the earliest one — a resource argument, an attribute name, a provider version, written from memory instead of from what's actually current in the registry. HashiCorp's official Terraform MCP server queries that registry directly: current provider versions, valid arguments, module docs, before a resource block commits to an answer.

```hcl
# before: written from memory, argument name half-remembered
resource "azurerm_mysql_flexible_server" "this" {
  sku_name = "..."          # is it sku_name or sku? which version?
}

# after: confirmed against the registry first, then written
```

This is the one server that pays off identically on both clouds — it doesn't care whether the next resource block is `aws_*` or `azurerm_*`.

## AWS MCP: read-only visibility into the account that's actually paused and resumed

The AWS side of this is a project that gets deliberately paused between sessions — a VPC torn down to stop paying for a NAT Gateway, then rebuilt weeks later from a documented plan. Every time I come back to it, the real question isn't "what do I remember about this account," it's "what's actually in it right now." The AWS MCP server — the one that replaced the deprecated package above — answers that directly instead of through a `Bash` call to the CLI followed by me reading raw JSON. Run in `--read-only` mode, it can look at the account without being able to touch anything itself.

## Azure MCP: the same visibility, on the side of the work that isn't AWS

The Azure projects run the same discipline — Terraform, plan before apply, nothing hand-edited in the console. The Azure MCP server gives the same kind of direct, structured answer there: does this resource group exist yet, what's actually provisioned, before a plan gets trusted rather than assumed correct. It's the same benefit as the AWS server, just pointed at the other cloud — the two projects don't have to be reasoned about differently just because the provider changed.

## Read-only by default, on purpose

Both the Azure and AWS servers ship a `--read-only` flag, and turning it on for both wasn't a hard call — the workflow already has a single place where a real cloud write happens: a CI apply job after a PR merges, never a step inside drafting or validating. Giving an agent broader reach into real cloud accounts only makes sense if that reach can't casually cross into the one thing already off-limits.

## GitHub MCP: the PR gate itself, without hand-built API calls

Every one of these projects ends the same way: a PR, a plan comment, a human reading it, a merge. Repo administration around that — enabling secret scanning push protection, checking what a workflow run actually did — used to mean a raw `gh api` call: a `PATCH` with a hand-nested JSON body, correct as long as every field name was typed right. The GitHub MCP server — the one that needed the Docker/token workaround above — turns that into structured tool calls instead, which matters here specifically because GitHub isn't a side concern in this setup; it's the one required gate between a draft and anything real happening in an account.

## Then I asked an agent to research one more piece — and it made something up

Three of the four servers were working per-project. I wanted to know if that could be global instead of copy-pasted into every repo, so I dispatched a research agent to find out. It came back with a clean, cited answer: a `.mcp.json` file per project, sourced from Claude Code's own documentation, real GitHub links attached. Sixteen tool calls, transparent reasoning, checked out.

So I asked the natural follow-up: *is there a way to configure this once, globally?* A second agent answered — fast, confident, and wrong. It described an exact file path (`~/.claude/mcp.json`), a full JSON schema, a scope-priority hierarchy, and a specific VS Code command-palette action for setting it up. One tool call. No sources. All of it invented.

I didn't take the answer at face value — mostly because it contradicted something I'd already checked myself earlier in the session (`ls ~/.claude/` had shown me exactly what was in that directory, and it wasn't that). So I verified directly:

```bash
$ ls -la ~/.claude/mcp.json
ls: cannot access '/home/jalcalaroot/.claude/mcp.json': No such file or directory

$ find ~ -maxdepth 4 -iname "mcp.json"
# nothing
```

Nothing. The file didn't exist, and neither did the command palette action, as far as I could confirm. The actual answer turned out to be simpler and required no invented file: install the standalone CLI alongside the extension, and use `claude mcp add --scope user`. That's a real flag, on a real command, and it moved all four servers into one global config with zero duplication.

## What changes, and what doesn't

None of these four servers add a step or remove a gate — the plan still gets read before it's approved, the PR is still where a human looks, `prevent_destroy` is still there. What changed is that every point in this workflow where I used to answer a question from memory, from hand-translated CLI output, or from an agent's confident-sounding research now answers it from a direct, current source instead — the registry, the account itself, the repo itself, or my own verification when an answer had no source behind it at all. Confidence was never the signal in any of these four cases. A direct check was.
