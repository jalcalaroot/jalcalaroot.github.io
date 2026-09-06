---
title: "AKS with Virtual Nodes Behind AGIC"
description: The Kubernetes side of the same reference pattern as the Container Apps project — a pod scheduled with no VM behind it, an ingress controller that silently ignores a misconfigured annotation, and the three RBAC grants Azure doesn't hand you for free.
pubDate: 2026-09-06
---

Same goal as the [Container Apps project](/blog/azure-container-apps-behind-application-gateway/), the Kubernetes way this time: a container reachable over HTTPS on a custom domain, through Application Gateway, without a VM sitting behind the workload. On AKS that means Virtual Nodes — the direct analog of an EKS Fargate profile — fronted by AGIC, the Application Gateway Ingress Controller. The cluster is real and running while I write this, not a diagram.

## A pod with no node behind it, on purpose

A Virtual Node schedules a pod as an ACI container group instead of onto a VM in the node pool — no capacity to provision, billed per second the pod actually runs. It doesn't claim pods automatically, though; nothing about "Virtual Nodes" means pods land there by default. The deployment has to ask for it explicitly:

```yaml
nodeSelector:
  kubernetes.io/role: agent
  type: virtual-kubelet
tolerations:
  - key: virtual-kubelet.io/provider
    operator: Exists
  - key: azure.com/aci
    effect: NoSchedule
```

Without that, the scheduler puts the pod on the real "system" node like anything else — same mechanism an EKS Fargate profile uses to claim pods by selector, just inverted: there you opt a namespace into Fargate, here you opt a pod into the virtual node.

Virtual Nodes also forces a networking decision earlier than I expected: it isn't compatible with Azure CNI Overlay, only flat CNI. That means every pod — real node or virtual — gets a real, routable VNet IP rather than an address from a separate overlay range, which is why the virtual-nodes subnet is a full `/24` instead of something smaller. And ACI itself has no overcommit: `requests` and `limits` have to be identical, or the container group creation fails outright with `ContainerLimitGreaterThanContainerGroupTotalRequest` before the pod ever starts.

## AGIC's identity comes with zero permissions attached

AGIC runs as a managed AKS add-on, and Terraform hands it an existing Application Gateway to manage:

```hcl
ingress_application_gateway {
  gateway_id = azurerm_application_gateway.this.id
}
```

I'd assumed — wrongly — that "managed add-on" meant Azure would also wire up whatever permissions that identity needs against a gateway I built myself. It doesn't. Both AGIC's identity and the ACI Connector's identity come back with no RBAC at all, and each one fails differently until you grant it by hand. AGIC alone needs three separate role assignments before it can do anything:

```hcl
resource "azurerm_role_assignment" "agic_app_gateway_contributor" {
  scope                = azurerm_application_gateway.this.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_kubernetes_cluster.this.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

resource "azurerm_role_assignment" "agic_resource_group_reader" {
  scope                = azurerm_resource_group.this.id
  role_definition_name = "Reader"
  principal_id         = azurerm_kubernetes_cluster.this.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

resource "azurerm_role_assignment" "agic_appgw_subnet_network_contributor" {
  scope                = var.network_appgw_subnet_id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_kubernetes_cluster.this.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}
```

Missing any one produces a different, equally opaque error — `ApplicationGatewayForbidden` for the first two, `ApplicationGatewayInsufficientPermissionOnSubnet` for the third — because the gateway's subnet lives in a different resource group than the cluster. The ACI Connector has its own version of the same gap: without `Network Contributor` on the virtual-nodes subnet, it crash-loops on `AuthorizationFailed` the instant it tries to join a container to the network. Both are one-time role assignments, but neither shows up until the add-on actually tries to act and fails.

## The ingress that never matched anything, silently

This is the one that cost the most time to track down, because nothing about it looked like a failure. Selecting AGIC as the ingress controller is supposed to be a one-line `spec.ingressClassName: azure-application-gateway`. I had it as an annotation instead — `kubernetes.io/ingress.class: azure-application-gateway` — which reads as equivalent and isn't:

```yaml
metadata:
  annotations:
    appgw.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: azure-application-gateway   # not the annotation above it
```

With the annotation instead of the field, AGIC produced no error, no warning, nothing in its logs pointing at the Ingress at all. It just kept reconciling its own empty default configuration — a placeholder listener and backend pool with no hostname and no real target — over and over, because as far as AGIC was concerned, my actual Ingress object didn't exist. The only visible symptom was the site not responding, which looks identical to a dozen other misconfigurations. Diffing the exact YAML AGIC expects against what I'd written was the only way to catch it.

## What's the same as the Container Apps side, what isn't

The RBAC discipline carries over directly: both CI identities here are scoped resource-by-resource, same as the Container Apps project, and hit the same underlying gap — `Contributor` doesn't include `Microsoft.Authorization/roleAssignments/write`, so granting the cluster's kubelet identity `AcrPull` needed a narrowly-scoped `Role Based Access Control Administrator` on the ACR specifically, not the resource group.

What's genuinely different is the certificate story. The Container Apps project reads its Let's Encrypt certificate live from Key Vault on every request. AGIC doesn't support that — it reads a Kubernetes `Secret`, full stop, so the certificate gets baked in once via `kubectl create secret tls`. The Terraform-side renewal still runs on schedule, but a renewed certificate sitting in state does nothing on its own; someone has to re-run that `kubectl` step against the live cluster afterward. Reusable infrastructure and reusable *operations* turned out to be two different problems, and this project only solved the first one.
