# Conformance model

Conformance has two dimensions: a target level and a current state. This prevents a locally generated repository from claiming that remote GitHub or Azure DevOps policy is enforced when nobody has verified the repository settings.

## Levels

| Level | Required outcomes |
|---|---|
| AS-1 — Agent instructions | Canonical tracked rules, generated client entry points, declared clients |
| AS-2 — Workflow and docs | AS-1 plus manifest/schema, proportional planning workflow, governed docs, portable skills, deterministic doctor, and quality CI |
| AS-3 — Secure development | AS-2 plus locked dependency workflow, committed BOM gate, immutable workflow references, dependency automation/review, security policy, and structured waivers |
| AS-4 — Provenance | AS-3 plus a defined release subject, signed build/SBOM attestations, consumer verification, and protected release environment |

The template targets AS-3. Generating an attestation workflow is necessary but not sufficient for AS-4.

## States

| State | Meaning |
|---|---|
| `adopting` | Local integration or advisory controls are still being mapped and remediated |
| `pending-remote` | Local strict controls pass, but required provider rules/settings are unverified |
| `conformant` | Local controls and authorized remote enforcement have both been audited |
| `drifted` | Previously accepted evidence no longer matches repository or remote state |

The doctor reports target, state, local enforcement, and remote enforcement separately. It never promotes a repository automatically and never equates a green local run with AS-3 conformance.

`AS-ENT-*` controls in the Azure enterprise baseline are an organization overlay. A repository may satisfy the portable AS-3 contract while enterprise admission remains pending; an enterprise should not label it conformant until the applicable identity, pipeline, resource, permission, agent, audit, and evidence controls are also approved.

## Initial control identifiers

| ID | Control | Automated evidence |
|---|---|---|
| AS-AGENT-001 | Agent instructions come from one canonical source and are tracked | Doctor file/tracking checks |
| AS-SKILL-001 | Declared workflow skills have valid frontmatter and supported client copies | Doctor plus client-path tests |
| AS-DOC-001 | Governed docs exist with ownership/freshness metadata and valid local links | Doctor |
| AS-QUAL-001 | Source changes include tests or a structured waiver | DoD policy |
| AS-QUAL-002 | Stack-native lint, type, test, and build checks pass | Full verification command |
| AS-SUPPLY-001 | Selected CycloneDX/SPDX BOM is valid and current with locked dependency identities | SBOM checker |
| AS-SUPPLY-002 | External workflow references are immutable and dependency changes are reviewed | Source checks plus provider workflows/pipelines |
| AS-REMOTE-001 | Pull requests, required jobs, owner review, and security features are enforced | Authorized provider audit; Azure emits schema-versioned, revision-bound `AS-ADO-*` results |
| AS-PROV-001 | A released subject carries verifiable build/SBOM provenance | Optional release profile plus consumer verification |

The next evidence revision should combine provider results with local checks, administrative controls, approvals, and exceptions, then map the bundle to organization policy frameworks without expanding the minimum application-repository footprint.
