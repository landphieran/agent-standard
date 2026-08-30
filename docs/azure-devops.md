# Azure DevOps adapter

Azure DevOps support is an adapter in this project, not a fork or a second standard. The portable manifest, agent rules, skills, documentation lifecycle, Definition-of-Done policy, waivers, and SBOM gate stay identical across providers. Only repository-hosting and CI enforcement vary.

## Configuration boundary

```text
.agent-standard/
├── manifest.json                       # portable repository contract
├── gate.json                           # portable test/document/change policy
├── platforms/
│   ├── azure-devops.json               # desired Azure Repos/Pipelines controls
│   └── azure-devops.schema.json
├── evidence/
│   └── azure-devops-audit.schema.json    # versioned remote evidence contract
└── scripts/
    └── audit-azure-devops.mjs           # read-only remote drift audit
.azuredevops/
└── pull_request_template.md             # Azure Repos review surface
azure-pipelines.yml                      # standalone gate or central-template entry point
```

`manifest.platform` identifies the repository provider, CI engine, and pipeline mode. The provider-specific document contains only fields that do not belong in the portable contract: default branch, central-template coordinates, expected branch policies, resolved reviewer identities, and Advanced Security state. The public template never presets organization IDs, project names, credentials, service connections, subscription IDs, deployment environments, or data classification. The generated adapter records only the Azure reviewer IDs and pipeline definition ID that an administrator resolves for that repository.

## Setup

The recommended installer detects `dev.azure.com` and `visualstudio.com` origin URLs. Use an override for a new repository without an origin:

```bash
npx --yes --package=github:landphieran/agent-standard \
  agent-standard init . --owner '@acme/platform' --scm azure-devops
```

The standard profile emits a complete standalone pipeline. Use `--advanced` to select either:

- `standalone`: the repository carries its full install, verification, change-policy, security-scan, and SBOM-publication steps.
- `extends`: the repository has a small entry point that extends an organization-owned Azure Repos template pinned to a full 40-character commit. The central template receives only stable manifest, stack, security-profile, and SBOM-format parameters.

The `extends` mode is the recommended enterprise shape once a platform team operates the central template. The bounded reference implementation is shipped in [`modules/azure-devops`](../modules/azure-devops/README.md) so the consumer contract and central behavior evolve in one reviewed project. Mirror or vendor it into a separately protected organization repository; keep the public adapter usable in standalone mode so local developers and small teams do not depend on private infrastructure.

## One-time Azure DevOps administration

The generator deliberately creates no pipelines and changes no repository or organization settings. After the first push, an authorized administrator must:

1. Create a YAML pipeline whose path is `azure-pipelines.yml`, then record its positive definition ID in `.agent-standard/platforms/azure-devops.json`. The generated `null` value deliberately keeps remote conformance pending until the pipeline exists.
2. Add that pipeline as an enabled, blocking, automatically queued Build Validation policy on the configured default branch. Set “queue on source update only” to false and validity duration to `0`, so source changes queue a run and protected-branch changes immediately invalidate/requeue prior results. Azure Repos does not support pull-request triggers declared with the YAML `pr` keyword, so build validation is the enforcement boundary ([Microsoft documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/repos/azure-repos-git?view=azure-devops#pr-triggers)).
3. Require at least one reviewer, exclude the creator's vote, disallow completion while any reviewer rejects or waits, reset votes on source pushes, add the responsible owner/security group through a blocking Required Reviewers policy that applies across the repository, require linked work items, and require comment resolution. Resolve the portable `@owner` aliases to Azure identity UUIDs and record them in `ownership.requiredReviewerIds`; the remote audit remains nonconformant while that array is empty or the policy binds different identities.
4. For every CI-enabled repository, license and enable Code Security, then add `AdvancedSecurity/NewHighAndCritical` as an enabled, blocking Status Check branch policy. Keep it applicable by default, reset it on source updates, and leave its authorized identity and iteration options at their Microsoft-recommended defaults. The dependency task publishes findings but does not itself reject the build; this status policy is the merge gate. It blocks newly introduced high/critical dependency, code, and secret findings without making an existing alert backlog prevent initial adoption. After that backlog is cleared, teams may strengthen the declared adapter value and branch policy to `AdvancedSecurity/AllHighAndCritical` ([Advanced Security status checks](https://learn.microsoft.com/en-us/azure/devops/repos/security/configure-github-advanced-security-features?view=azure-devops#set-up-pull-request-status-checks)).
5. The hardened profile additionally requires CodeQL plus Secret Protection and secret push protection. Its pipeline orders CodeQL initialization before the build and analysis after it, and waits for CodeQL result processing before the status policy evaluates, as required by [Advanced Security code-scanning setup](https://learn.microsoft.com/en-us/azure/devops/repos/security/github-advanced-security-code-scanning?view=azure-devops).
6. In `extends` mode, grant only this pipeline read access to the central template repository and require the extending template on every protected resource the pipeline uses in addition to the immutable commit pin ([secure templates](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/templates?view=azure-devops)). A required-template check is enterprise defense in depth, not a substitute for the commit pin, owner review, or PR-job isolation; it evaluates only when the protected resource is requested.
7. Apply the organization/project settings in [`modules/azure-devops/enterprise-baseline.json`](../modules/azure-devops/enterprise-baseline.json): project-scoped job tokens, YAML repository protection, constrained queue-time variables, shell argument validation, YAML-only pipelines, explicit resource authorization, isolated agents, federated automation identity, auditing, and evidence retention.
8. Restrict branch-policy bypass, force-push, branch deletion, pipeline editing, pull-request status contribution, and template-repository write permissions to the least-privileged reviewed groups; keep break-glass membership explicit, time-bounded, and audited.
9. Run the remote audit below and retain its schema-valid JSON output together with the administrator permission review before changing conformance state.

The minimum adapter targets Azure DevOps Services. Its Advanced Security tasks and Pipeline Artifact publication are service features; Azure DevOps Server needs a separately tested adapter rather than silent fallback.

## Read-only remote audit

Provide either `SYSTEM_ACCESSTOKEN` from a protected Azure Pipeline or a short-lived, least-privileged `AZURE_DEVOPS_EXT_PAT` through the process environment, then run:

```bash
node .agent-standard/scripts/audit-azure-devops.mjs \
  --organization https://dev.azure.com/acme \
  --project Platform \
  --repository 00000000-0000-0000-0000-000000000000 \
  --output ./agent-standard-azure-audit.json \
  --json
```

In an Azure Pipeline, the script can use `SYSTEM_COLLECTIONURI`, `SYSTEM_TEAMPROJECT`, and `BUILD_REPOSITORY_ID`. Both the branch-policy and Advanced Security queries call Azure DevOps REST endpoints directly; the Azure CLI is not required. Tokens are neither accepted on the command line nor written to output or error details. The auditor performs GET/list operations only; it never applies policy. Run credentialed evidence collection only from a protected administrative or default-branch pipeline. Never map a token into pull-request validation because the pull request can change executable repository code.

Policy evaluation can be tested without Azure access:

```bash
node .agent-standard/scripts/audit-azure-devops.mjs \
  --policy-file ./policy-response.json \
  --security-file ./security-response.json \
  --json
```

An audit failure identifies stable `AS-ADO-*` control IDs. Written evidence includes the standard version, adapter SHA-256, source revision when available, target scope, timestamp, and live/offline input mode; validate it with `.agent-standard/evidence/azure-devops-audit.schema.json`. The script proves the declared branch-policy settings and Advanced Security enablement; it does not yet enumerate ACL/bypass membership, organization pipeline settings, agent isolation, identity/PAT policy, audit streaming, or required-template checks. Its JSON output is therefore one evidence item, not an automatic conformance promotion.

## Enterprise layering

Use three independently owned layers:

1. This public project defines the minimum portable contract and provider adapter.
2. A private organization distribution supplies approved owner aliases, internal registries, support contacts, data classifications, and the pinned central-template coordinates.
3. A separately protected pipeline-template repository vendors the reference module, adds organization policy, and is consumed through `extends`.

This keeps application repositories small, gives teams the same local workflow, and lets security/platform owners harden policy without embedding privileged mutation or company identifiers in the public standard.

The full responsibility split, rollout order, enterprise control catalog, and remaining engineering backlog are in [Enterprise adoption](enterprise-adoption.md).

## Azure cloud opportunities after the minimum adapter

Azure DevOps hosting and Azure workload deployment are separate axes. A later Azure deployment profile can build on this adapter with workload-identity federation instead of client secrets, Bicep or Terraform validation, Azure Policy and Defender for Cloud evidence, protected Azure Pipeline environments and approvals, Key Vault references, ACR image SBOM/provenance, and deployment-time attestation verification. Those controls should be optional profiles derived from the same manifest, not prerequisites for adopting the repository baseline.
