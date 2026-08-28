---
name: security-review
description: Review security-sensitive changes, dependency updates, trust boundaries, credentials, authorization, workflows, or release provenance in this repository.
---

# Security review

Read `SECURITY.md`, `.agent-standard/manifest.json`, and the affected trust-boundary documentation. Trace untrusted input through validation, authorization, storage, logging, tool execution, and output. Check tenant/data isolation where applicable.

For dependency or build changes, verify the lockfile, committed SBOM, pinned workflow actions, minimal permissions, and release attestation policy. Findings need an exploitable condition, impact, and specific mitigation; distinguish confirmed issues from hypotheses.
