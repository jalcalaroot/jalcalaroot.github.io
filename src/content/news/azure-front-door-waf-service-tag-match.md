---
title: "Front Door Premium WAF can now match on Azure service tags"
description: WAF custom rules on Azure Front Door Premium can match the source IP against Azure service tags — allow, block or rate-limit traffic from Azure services without maintaining IP lists by hand. Powerful, and easy to get dangerously broad.
pubDate: 2026-10-20
provider: azure
source: https://azure.microsoft.com/updates?id=577156
tags: [front-door, waf, networking, security]
---

The **service tag match condition** for **Azure WAF custom rules on Front Door Premium** is now generally available. Custom rules can match the request's source IP against **service tags** — Microsoft-maintained groups of IP prefixes for Azure services — with the new `ServiceTagMatch` operator. Prefixes are updated automatically, so your rules don't go stale.

The details from the documentation:

- Match variables: **`SocketAddr`** (the IP of the TCP connection that reached Front Door) or **`RemoteAddr`** (the original client IP, taken from `X-Forwarded-For` when present). No other match variables work with this operator.
- Match value: one or more tag names, matched exactly — `AzureMonitor`, `AzureCloud`, regional tags like `AzureCloud.eastus`.
- Works with **Allow, Block, Log** and **rate-limit** rules, and combines with URI, host and method conditions.

A rule that allows Azure Monitor probes, straight from the docs:

```json
{
  "name": "AllowAzureMonitor",
  "priority": 10,
  "ruleType": "MatchRule",
  "matchConditions": [
    {
      "matchVariable": "SocketAddr",
      "operator": "ServiceTagMatch",
      "negateCondition": false,
      "matchValue": ["AzureMonitor"]
    }
  ],
  "action": "Allow"
}
```

## Why it matters

Until now, "let the monitoring probes in" or "lock `/admin` to traffic from our Azure region" meant copying IP ranges from the weekly service tag JSON into WAF rules — and forgetting to update them. Matching on tags removes that toil and the drift that comes with it.

## Read the warnings — they're the important part

- **Use `SocketAddr`, not `RemoteAddr`, for trust decisions.** `X-Forwarded-For` is set by the caller; anyone can spoof it.
- **`AzureCloud` is huge.** It covers public Azure IP space, **including other customers' resources**. "Allow AzureCloud" is effectively "allow anyone with an Azure subscription".
- **A tag identifies a service, not a tenant.** Allowing a tag allows anyone who can send traffic through that service. It's a coarse filter, not authentication.
- **Allow skips the managed rules.** An Allow action stops evaluation of the Default Rule Set and Bot Protection for that request. Keep allow rules narrow and combined with path or host conditions.
- **Start in Log or Detection mode** before switching to Block.

## Security and cost angle

For regulated workloads, the safest uses are restrictive: block or rate-limit Azure-sourced traffic your app never expects, and scope sensitive paths with negated conditions. Treat any Allow rule on a service tag as a security exception that needs review. On the cost side, rate-limiting unexpected Azure-sourced traffic at the edge also keeps it from reaching — and scaling — your origins.
