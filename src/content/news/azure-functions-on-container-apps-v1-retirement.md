---
title: "Functions on Azure Container Apps v1 retires on September 29, 2027"
description: The original Functions-on-Container-Apps hosting model, built on a Microsoft.Web proxy app, stops running in September 2027. The v2 model is a native container app with kind=functionapp — and it's simply better.
pubDate: 2026-09-29
provider: azure
source: https://azure.microsoft.com/updates?id=570800
tags: [container-apps, azure-functions, retirement, serverless]
---

Microsoft has announced that the **v1 hosting model for Azure Functions on Azure Container Apps retires on September 29, 2027**. After that date, existing v1 apps stop running and no longer process requests or event-driven triggers.

The replacement is the **v2 model**, a native container app created with `kind=functionapp`. According to Microsoft, migration typically requires no code changes — you reuse the same container image. There's a migration assistant on GitHub and a migration guide on Learn.

## v1 vs v2, in one paragraph

v1 was a `Microsoft.Web` Function App acting as a proxy in front of a hidden container app — two resources, and most Container Apps features out of reach. v2 is a single `Microsoft.App/containerApps` resource, so you get what Container Apps already does well: revisions and multi-revision traffic splitting, secrets, health probes, custom domains with managed certificates, Easy Auth, sidecars, full scale-rule settings and live logs.

## Why it matters

Two years feels comfortable, but this is a hard stop for event-driven workloads: if a v1 app is still there in September 2027, triggers simply stop firing. And because v1 apps look like regular Function Apps in the portal, they're easy to miss in an inventory.

## Find them

The v1 apps are `Microsoft.Web/sites` linked to a Container Apps managed environment:

```kusto
Resources
| where type =~ 'microsoft.web/sites'
| where kind contains 'functionapp'
| where isnotempty(properties.managedEnvironmentId)
| project name, kind, resourceGroup, subscriptionId
```

The v2 equivalent is created like any other container app:

```bash
az containerapp create \
  --name <app> --resource-group <rg> \
  --environment <environment> \
  --image <registry>.azurecr.io/<image>:<tag> \
  --kind functionapp \
  --ingress external --target-port <port>
```

## Security and cost angle

The migration is worth doing early, not just before the deadline. On v2 you can put Easy Auth and health probes in front of the function, use Container Apps secrets and managed identity the same way as the rest of your apps, and roll out with revision-based traffic splitting instead of all-at-once. Fewer resources per app also means less to tag, monitor and govern — and your IaC no longer has to model a proxy resource that exists only to host something else.
