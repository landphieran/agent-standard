---
name: plan-change
description: Plan a repository change when implementation, refactoring, migration, or durable behavior needs explicit acceptance criteria and proportionate tasks.
---

# Plan a change

Read `AGENTS.md`, `.agent-standard/manifest.json`, the nearest documentation index, and only the architecture or runbook material relevant to the request.

Identify affected boundaries, tests, documentation, security controls, and SBOM impact. Keep the plan proportional to risk; a small fix does not need ceremonial tasks.

Follow `manifest.workflow.profile`:

- `lightweight`: keep acceptance criteria in the pull request; use `docs/changes/` for multi-step, architectural, security-sensitive, migration, or rollback-heavy work.
- `spec-driven`: capture non-trivial work in `openspec/changes/` and validate it with the configured OpenSpec command.

Planning does not authorize implementation or external changes unless the user requested them.
