# Enterprise adoption

The repository baseline is ready to pilot in Azure DevOps Services, but a generated repository is not an enterprise security boundary by itself. Enterprise conformance requires three things together: the application repository contract, centrally administered Azure DevOps controls, and retained evidence that both still match.

The reference desired state is machine-readable in [`modules/azure-devops/enterprise-baseline.json`](../modules/azure-devops/enterprise-baseline.json). Its schema makes the minimum unambiguous for a future policy-as-code controller. It is a control contract, not proof that an Azure DevOps organization has those settings.

## Responsibility model

| Owner | One-time responsibility | Ongoing responsibility |
|---|---|---|
| Application team | Run the initializer, review the generated files, create the pipeline, and provide repository ownership aliases | Use the same verify/DoD/docs/SBOM workflow and review standard updates |
| Platform engineering | Publish an organization preset, protect the extending-template repository, approve build pools/tasks, and operate rollout automation | Promote pinned template revisions, test representative repositories, and monitor drift |
| Azure DevOps administrators | Apply organization/project pipeline settings, repository permissions, branch policies, resource checks, identity policy, auditing, and retention | Review bypass and administrator membership, audit policy changes, and remediate drift |
| Security/governance | Fund Advanced Security, define alert and waiver SLAs, approve evidence retention, and map controls to the company framework | Triage findings, review exceptions, and sample evidence |

Application teams should not need Azure DevOps administration rights. An enterprise wrapper should preselect the provider, owner aliases, stack, security profile, and central-template coordinates; the repository team should normally answer only project identity and adoption versus greenfield mode.

## Minimum enterprise control set

| Control | Scope | Minimum outcome | Evidence |
|---|---|---|---|
| `AS-ENT-ID-001` | Tenant/organization | Organization is Microsoft Entra-backed; projects are private; guest access follows an explicit business policy | Entra/Azure DevOps policy export and access review |
| `AS-ENT-AUTH-001` | Tenant/organization | Production automation uses managed identity, service principal federation, or an Azure DevOps workload-identity service connection; full-scope/global PATs are blocked and PAT lifetime is at most 90 days | Authentication and PAT policy export |
| `AS-ENT-PIPE-001` | Organization/project | Limit non-release job authorization to the current project and protect access to repositories in YAML pipelines | Pipeline settings export or administrator attestation |
| `AS-ENT-PIPE-002` | Organization/project | Limit queue-time variables, enable shell-task argument validation, disable new classic build/release pipelines, disable implied YAML CI, and disable or explicitly approve Marketplace tasks | Pipeline settings and extension inventory |
| `AS-ENT-RESOURCE-001` | Project/resource | Repositories, pools, variable groups, secure files, and service connections use explicit per-pipeline authorization; enterprise `extends` consumers meet a Required template check on each protected resource they use | Resource permissions/check export and a rejected negative test |
| `AS-ENT-REPO-001` | Repository/branch | Default branch policies match the adapter; ordinary contributors cannot bypass on push/completion or force-push; break-glass access is separate, time-bound, and audited | Agent-standard remote audit plus permission review |
| `AS-ENT-AGENT-001` | Agent pool | Pull-request code runs on fresh isolated agents with no production network path or deployment credentials; production deployment pools are separate | Pool configuration and pipeline permissions |
| `AS-ENT-SEC-001` | Organization/repository | Advanced Security is licensed and enabled, the PR status check blocks new high/critical findings, and code/secret alerts have an owner and remediation SLA | Remote audit plus license/alert ownership record |
| `AS-ENT-AUDIT-001` | Organization | Azure DevOps auditing is enabled and streamed or exported before the native 90-day window expires | Audit-stream configuration and SIEM/storage query |
| `AS-ENT-EVIDENCE-001` | Project/governance | Remote-audit JSON, permission review, pipeline logs, test results, and BOM artifacts are retained for at least 90 days or the longer company requirement | Versioned evidence artifact tied to source revision and adapter hash |

These settings address a key threat boundary: pull-request YAML is code. It must be treated as untrusted even when a Build Validation policy runs it. PR validation receives no deployment secrets or broadly scoped repository token, runs on an isolated agent, and can only consume explicitly authorized resources. Deployment is a separate pipeline/stage that consumes reviewed artifacts from a protected branch and uses environment/resource approvals.

Microsoft recommends restricting job authorization scope at the organization level because an unrestricted job token can reach repositories across the organization, and separately enabling YAML repository protection ([job access tokens](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/access-tokens?view=azure-devops)). Azure Pipelines also provides organization/project controls for queue-time variables, shell argument validation, and classic pipeline creation ([pipeline security](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/overview?view=azure-devops), [secure inputs](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/inputs?view=azure-devops)).

Required-template checks belong to protected Azure Pipeline resources, not to repository YAML, so a pull request cannot edit the check itself. Configure them together with explicit pipeline permissions on every sensitive resource ([approvals and checks](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals?view=azure-devops), [pipeline resource security](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/resources?view=azure-devops)).

This resource model creates an important limit: a Required template check runs only when a stage requests the protected resource. Therefore—an inference from Microsoft's documented check model—it is not an organization-wide “every pipeline must extend this template” switch. A pull request that removes the resource reference does not invoke that resource's check. Keep repository-wide required-owner review on pipeline changes, isolate all PR execution, deny credentials by default, and use a protected resource that every sensitive job truly requires. Treat required templates as defense in depth, not proof by themselves that repository YAML cannot be replaced.

## Rollout sequence

1. **Prepare the organization.** Apply the enterprise baseline at organization scope wherever possible, connect Entra ID, restrict PATs, enable auditing, choose retention, fund Advanced Security, and define platform/security owner groups.
2. **Protect the platform repositories.** Vendor the reference extending template into a private repository, protect its default branch, approve its Microsoft tasks and package sources, and pin consumers to reviewed 40-character commits.
3. **Pilot representative repositories.** Use at least one TypeScript service, one Python service, and one existing complex repository. Include a negative test that changes source without tests, tampers with pipeline YAML, introduces a vulnerable dependency, and attempts unauthorized resource access.
4. **Bind remote controls.** Create each pipeline, record its definition ID and resolved reviewer identity IDs, apply branch/status policies, run the remote audit, and complete the permission review.
5. **Promote conformance deliberately.** Move from `pending-remote` to `conformant` only after strict local checks, the revision-bound remote audit, enterprise control evidence, and an authorized approval all exist.
6. **Scale through a controller.** Inventory repositories, open update pull requests for pinned standard/template revisions, detect drift on a schedule, and report exceptions centrally. Do not give every application pipeline permission to mutate its own controls.

## Evidence operation

The Azure auditor can write a versioned artifact as well as console JSON:

```bash
node .agent-standard/scripts/audit-azure-devops.mjs \
  --organization https://dev.azure.com/acme \
  --project Platform \
  --repository 00000000-0000-0000-0000-000000000000 \
  --output ./agent-standard-azure-audit.json \
  --json
```

The live policy and Advanced Security queries use Azure DevOps REST directly with `SYSTEM_ACCESSTOKEN` or `AZURE_DEVOPS_EXT_PAT` supplied only through the environment; the Azure CLI is not required. The evidence records the standard version, live/offline input mode, SHA-256 of the repository adapter, source revision when Azure supplies one, target scope, timestamp, and every `AS-ADO-*` result. Validate it with `.agent-standard/evidence/azure-devops-audit.schema.json` and publish it from a protected administrative/default-branch pipeline. Never map `System.AccessToken`, a PAT, or a service connection into an untrusted pull-request job merely to collect governance evidence.

Azure DevOps stores audit events for 90 days, so longer retention requires export or audit streaming ([Azure DevOps auditing](https://learn.microsoft.com/en-us/azure/devops/organizations/audit/azure-devops-auditing?view=azure-devops)). Pipeline run and artifact retention is project-level rather than per YAML pipeline and must also be set administratively ([pipeline retention](https://learn.microsoft.com/en-us/azure/devops/pipelines/policies/retention?view=azure-devops)).

## Remaining enterprise engineering

These items are deliberately not represented as completed controls:

1. **Policy-as-code controller (highest priority).** Apply and audit the organization baseline, branch policies, ACLs, required-template checks, Advanced Security state, and evidence retention from a separately privileged platform service.
2. **ACL and organization-setting audit.** The current repository auditor proves branch-policy and Advanced Security state only. It does not enumerate effective permissions, break-glass membership, organization pipeline settings, PAT policy, agent-pool isolation, required-template checks, or audit streaming.
3. **Federated auditor identity.** Prefer the new Azure DevOps workload-identity service connection for protected administrative automation. The current standalone auditor accepts a pipeline job token or short-lived PAT through environment variables and should not become a reason to create persistent credentials.
4. **Evidence bundle/control mapping.** Combine local results, remote results, administrative evidence, approvals, and exception history; map them to NIST SSDF/OSCAL or the company GRC system without claiming that an SBOM is a bill of process.
5. **Artifact and release provenance.** The Azure adapter validates and publishes the selected committed CycloneDX/SPDX BOM, but it does not yet create or verify Azure release attestations, container-image BOMs, signatures, or deployment-time provenance. This remains below AS-4.
6. **Approved dependency/tool distribution.** Enterprises commonly need internal npm/Python mirrors, egress policy, Microsoft/Marketplace task approval, and an owned process for pinned tool upgrades. Those organization coordinates do not belong in the public template.
7. **Dependency update automation.** Advanced Security detects risk but does not open dependency upgrade pull requests. The organization still needs an approved Renovate or equivalent service, registry credentials with read-only scope, update grouping, and ownership/triage policy.
8. **Azure workload delivery profile.** Workload-identity federation for Azure Resource Manager, IaC validation, Azure Policy/Defender evidence, Key Vault, ACR, protected environments, and deployment approvals remain a separate optional profile.
9. **Azure DevOps Server adapter.** Services is the tested target. Server versions, on-premises agents, missing service features, and upgrade cadence require their own compatibility matrix.

For agent pools, Microsoft-hosted agents provide a fresh VM per job; when private networking or custom images require Managed DevOps Pools, use stateless agents for untrusted builds and authorize only selected pipelines ([hosted-agent security](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/hosted?view=azure-devops), [Managed DevOps Pools scaling](https://learn.microsoft.com/en-us/azure/devops/managed-devops-pools/configure-scaling?view=azure-devops)). For Azure service connections, workload identity federation avoids stored client secrets and broad shared credentials ([service connections](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops)).
