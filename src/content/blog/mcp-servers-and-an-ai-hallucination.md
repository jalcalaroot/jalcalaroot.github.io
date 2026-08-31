---
title: "Connecting 4 MCP Servers — and Catching My Own Agent Hallucinate a Config File"
description: Wiring up Terraform, Azure, AWS, and GitHub MCP servers surfaced a deprecated package, a broken OAuth flow, and one AI research pass that confidently invented a file that never existed.
pubDate: 2026-08-27
---

I wanted Claude Code to be able to check real state instead of guessing — actual Terraform registry docs, actual Azure/AWS resources, actual GitHub repo settings — across every project I work in, not just one repo at a time. Four MCP servers later, it worked. Getting there surfaced more than I expected, including one moment where I caught an AI agent inventing a config file that doesn't exist, in real time.

## The setup wasn't the boring part

Two of the four servers had real friction before they ever connected:

**AWS Labs' general-purpose server is deprecated mid-flight.** I went to install `awslabs.aws-api-mcp-server` — the broad, general-access AWS server — and its own startup banner said so: *"entering end of development, migrate to the AWS MCP Server."* The replacement isn't a simple package swap either; it's now a fully-managed endpoint (`aws-mcp.us-east-1.api.aws/mcp`) fronted by a thin local proxy, `mcp-proxy-for-aws`. Good thing I checked the actual output instead of trusting the package name I'd planned to use.

**GitHub's HTTP endpoint failed with a real, useful error.** I first wired `github` as a remote HTTP server — simplest option, OAuth handled entirely by GitHub, no local token. It failed immediately:

```
Incompatible auth server: does not support dynamic client registration
```

Not a timeout, not a vague 401 — a specific protocol mismatch. The client tries OAuth Dynamic Client Registration and GitHub's endpoint doesn't support it. The fix was the less elegant option I'd been avoiding: run it via Docker with a token pulled straight from an already-authenticated `gh` CLI session, so nothing new had to be minted by hand.

## Then I asked an agent to research the fix — and it made something up

Once three of the four servers were working per-project, I wanted to know if that could be global instead of copy-pasted into every repo. I dispatched a research agent to find out. It came back with a clean, cited answer: a `.mcp.json` file per project, sourced from Claude Code's own documentation, with real GitHub links attached. Sixteen tool calls, transparent reasoning, checked out.

So I asked the natural follow-up: *is there a way to configure this once, globally?* A second agent answered — fast, confident, and wrong. It described an exact file path (`~/.claude/mcp.json`), a full JSON schema, a scope-priority hierarchy, and a specific VSCode command-palette action ("Claude Code: Add MCP Server") for setting it up. One tool call. No sources. All of it invented.

I didn't take the answer at face value — mostly because it contradicted something I'd already checked myself earlier in the session (`ls ~/.claude/` had shown me exactly what was in that directory, and it wasn't that). So I verified directly:

```bash
$ ls -la ~/.claude/mcp.json
ls: cannot access '/home/jalcalaroot/.claude/mcp.json': No such file or directory

$ find ~ -maxdepth 4 -iname "mcp.json"
# nothing
```

Nothing. The file didn't exist. Neither did the command palette action, as far as I could confirm. The confident tone and the specific detail — a real-looking path, a plausible JSON shape — were exactly what made it worth checking rather than repeating.

The actual answer, it turned out, was simpler and required no invented file: install the standalone CLI alongside the extension, and use `claude mcp add --scope user`. That's a real flag, on a real command, and it moved all four servers into one global config with zero duplication.

## Read-only by default, on purpose

Both the Azure and AWS servers ended up with a `--read-only` flag. Not because I assumed it was safest — I found it sitting in each tool's own `--help` output and used it deliberately, because it matches a rule I already follow by hand: infrastructure changes go through Terraform, never a direct console or CLI edit. Extending that same rule to an AI agent's tools felt less like an extra precaution and more like the same rule applied consistently.

## The actual lesson

The first research pass was right and cited its sources. The second was equally confident and entirely fabricated. Nothing in the tone of either answer told me which was which — the only thing that did was checking the claim against the filesystem myself. That's not a reason to distrust AI-assisted work; it's the same discipline I'd apply to a tutorial that "should" work but doesn't, or a Terraform argument that looks right until `plan` disagrees. Confidence was never the signal. Verification was.
