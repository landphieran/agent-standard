# Conformance model

The levels are cumulative and provide a portable target for future policy-as-code or build-profile integration.

| Level | Required outcomes |
|---|---|
| AS-1 — Agent instructions | Canonical tracked rules, generated client entry points, declared clients |
| AS-2 — Workflow and docs | AS-1 plus manifest/schema, planning workflow, governed docs, portable skills, deterministic doctor, quality CI |
| AS-3 — Secure development | AS-2 plus lockfile/BOM enforcement, SHA-pinned workflows, dependency automation/review, security policy, structured waivers |
| AS-4 — Provenance | AS-3 plus releasable artifact definition, signed build/SBOM attestations, verification instructions, and protected release environment |

The template defaults to AS-3. Enabling `release_attestations` emits necessary workflow mechanics but a project should claim AS-4 only after consumers verify attestations and the release subject is well-defined.

## Initial control identifiers

| ID | Control | Automated evidence |
|---|---|---|
| AS-AGENT-001 | Agent instructions are generated from one canonical source and tracked | Doctor file/tracking checks |
| AS-SKILL-001 | Declared workflow skills have valid frontmatter and propagated copies | Doctor plus Ruler render matrix |
| AS-DOC-001 | Required docs and indexes exist with valid local links | Doctor |
| AS-QUAL-001 | Source changes include tests or a structured waiver | DoD gate |
| AS-QUAL-002 | Stack-native lint, type, test, and build checks pass | CI gate command |
| AS-SUPPLY-001 | Selected CycloneDX/SPDX BOM is valid and current with dependency identities | SBOM checker |
| AS-SUPPLY-002 | Workflow actions are immutable and dependency changes are reviewed | Source checks and GitHub workflows |
| AS-PROV-001 | Released subject carries signed build/SBOM provenance | Optional tag workflow plus consumer verification |

The next schema revision should make these controls first-class manifest entries and emit JSON/SARIF evidence for organization dashboards.
