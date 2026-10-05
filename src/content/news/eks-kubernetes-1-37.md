---
title: "Amazon EKS adds Kubernetes 1.37"
description: Kubernetes 1.37 is available on EKS and EKS Distro in every EKS Region, including GovCloud (US). Metrics API goes GA, DRA device taints go GA, and HPA scale-to-zero is now beta and on by default.
pubDate: 2026-10-02
provider: aws
source: https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-eks-distro-kubernetes-version-1-37
tags: [eks, kubernetes, containers, finops]
---

Amazon EKS and EKS Distro now support **Kubernetes 1.37**. New clusters can be created on it and existing clusters upgraded from the console, `eksctl`, the CLI or IaC. It's available in every Region where EKS runs, including AWS GovCloud (US). EKS Distro builds are published in ECR Public Gallery and on GitHub.

The highlights AWS calls out:

- **Metrics API GA** — `metrics.k8s.io/v1`, the API behind HPA's CPU/memory metrics and `kubectl top`.
- **DRA device taints and tolerations GA** — administrators can taint devices such as GPUs so that workloads only land on them if they explicitly tolerate the taint.
- **HPA scale-to-zero beta, enabled by default** — workloads can scale down to zero pods when idle.

## Why it matters

Scale-to-zero being on by default is the one I'd look at first. Idle internal APIs, queue workers and batch consumers that sit at `minReplicas: 1` across dozens of namespaces add up, and they also keep nodes alive that Karpenter or Cluster Autoscaler could otherwise remove. Keep in mind that scaling to zero means no pod is running to report CPU or memory, so it is meant for workloads scaled on external or object metrics (queue depth, request rate), not plain CPU — and the first request after idle pays a cold start.

DRA device taints matter for anyone sharing GPU capacity: they give you a scheduler-level way to keep general workloads off expensive accelerators, or to drain a faulty device, without node-level hacks.

## Upgrade checklist

Run the cluster insights before touching the control plane — they flag deprecated API usage and add-on incompatibilities:

```bash
aws eks list-insights --cluster-name <cluster>
aws eks update-cluster-version --name <cluster> --kubernetes-version 1.37
```

Then upgrade managed add-ons and node groups (or let Karpenter roll nodes through updated AMIs), and only after that start using new features. Upgrade one minor version at a time and test in a non-production cluster first — the usual rules still apply.

## FinOps angle

Staying current isn't only about features: clusters that fall behind into EKS extended support pay a higher per-cluster hourly rate than standard support. A predictable upgrade cadence is cheaper than a rushed one, and 1.37 is a good moment to check which of your clusters are closest to leaving standard support.
