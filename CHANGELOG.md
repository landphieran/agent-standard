# Changelog

This file records product releases independently from manifest schema revisions.

## Unreleased

## 1.0.0 - 2026-08-30

- Established the v1 promise: immutable, deterministic assessment and adoption without silent overwrite of project-owned content.
- Made `init` assessment-first, required `--apply` for non-interactive mutation, allowed dirty/missing-decision assessments, and added stable exit meanings.
- Added full revision identity, collision classification across generated and agent-owned paths, apply-time drift checks, and partial-copy failure rollback proof.
- Published the Layer 1 control catalog, supported host boundary, Git recovery procedure, nine-configuration render matrix, and separate core/pilot gates.

- Added an Azure DevOps adapter with origin detection, provider-isolated review metadata, standalone and immutable central-template Azure Pipeline modes, Advanced Security expectations, SBOM publication, and a read-only remote-policy auditor.
- Renamed the pre-release ownership contract from GitHub-specific `codeowners` to portable `owners`; the GitHub adapter still derives CODEOWNERS from it.
- Added a transactional `agent-standard init` path with project/stack detection, explicit ownership, verified staging, dry-run plans, namespaced Copier state, collision preservation, rollback, and fail-closed package-manager checks.
- Added standard and advanced setup profiles plus lightweight and spec-driven workflow profiles.
- Moved enforcement into client-neutral scripts and added one complete manifest verification command.
- Made Claude settings, CODEOWNERS, and pull-request checklist merges additive and idempotent during adoption.
- Corrected Codex/Copilot skill discovery, protected OpenSpec skills from Ruler cleanup, and verified each client target.
- Split target conformance from current/local/remote state so local checks do not overclaim GitHub enforcement.
- Added a machine-readable conformance manifest and doctor.
- Added governed documentation and portable agent workflow skills.
- Added configurable CycloneDX/SPDX SBOM generation and enforcement.
- Added supply-chain workflows, security automation, and optional release attestations.
- Hardened the Definition of Done gate, generated-agent tracking, and render verification.
