# Changelog

This project has not published its first release. Until then, changes accumulate under **Unreleased**.

## Unreleased

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
