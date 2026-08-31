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

## Layer 1 control catalog

Control identifiers and outcomes are stable v1 interfaces. **Non-waivable** controls define the product or trust boundary. **Configurable** controls expose an approved choice without removing the outcome. **Waivable** controls permit only the repository's structured, owned, reasoned, and expiring waiver mechanism.

| ID | Required outcome | Accountable owner | Applicability | Policy class | Enforcement and evidence |
|---|---|---|---|---|---|
| AS-BASE-001 | Product version and full source revision identify the adopted baseline; mutable refs require explicit development mode | Standard maintainers | Every supported render/adoption | Non-waivable | Package/template source checks, CLI SHA validation, rendered manifest/schema |
| AS-ADOPT-001 | Assessment is non-mutating; non-interactive application requires `--apply` and a fresh blocker-free assessment | Standard maintainers and adopting team | Initial greenfield/adoption | Non-waivable | CLI tests, staged plan, exit contract |
| AS-OWN-001 | Project-owned files, agent instructions, rule sources, skills, and provider content are not silently overwritten | Adopting repository owner | Initial adoption | Non-waivable | Full selected-output classification, ownership collision tests, managed-merge validation |
| AS-RECOVER-001 | Partial copy failure restores the destination; successful adoption starts clean and has documented Git recovery | Standard maintainers and adopting team | Application | Non-waivable | Failure-injection test and recovery rehearsal |
| AS-AGENT-001 | Agent instructions come from one canonical source and generated entry points are tracked | Repository owner | All repositories | Non-waivable | Doctor file/tracking checks |
| AS-SKILL-001 | Declared workflow skills have valid frontmatter and supported client copies | Repository owner | Selected clients | Configurable | Doctor plus client-path tests |
| AS-DOC-001 | Governed documents exist with ownership/freshness metadata and valid local links | Repository owner | All repositories | Configurable | Doctor documentation checks |
| AS-QUAL-001 | Source changes include recognized tests or a valid structured waiver | Repository owner | Source changes | Waivable | Definition-of-Done policy and `.agent-standard/waivers.json` |
| AS-QUAL-002 | Stack-native lint, type, test, and build checks pass | Repository owner | Supported stack | Configurable | Manifest full verification command in local and CI execution |
| AS-SUPPLY-001 | Selected CycloneDX/SPDX BOM is valid and current with locked dependency identities | Repository and security owners | Repositories with dependencies | Configurable | SBOM checker; strict/advisory mode is explicit |
| AS-SUPPLY-002 | External workflow references are immutable and dependency changes are reviewed | Standard and security owners | CI-enabled repositories | Non-waivable | Source checks and provider workflows/pipelines |
| AS-REMOTE-001 | Pull requests, required jobs, owner review, and security features are enforced | Authorized provider administrators | Hosted repositories | Non-waivable external gate | Authorized provider audit; Azure emits `AS-ADO-*` results |
| AS-PROV-001 | A released subject carries verifiable build/SBOM provenance | Release owner | Opt-in release profile | Configurable | Release workflow and consumer verification |

The catalog defines outcomes and evidence, not a network telemetry system. V1 evidence remains in the repository, CI run, release evidence note, and authorized provider audit.
