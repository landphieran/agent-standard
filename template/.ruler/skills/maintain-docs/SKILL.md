---
name: maintain-docs
description: Update and verify repository documentation when behavior, interfaces, architecture, operations, security controls, or maintained files change.
---

# Maintain documentation

Start at `docs/README.md`. Trace only the documents whose claims changed. Update code and docs together, refresh `last_verified` and `verified_against` only after checking the claim, and keep indexes and local links correct.

Use an ADR for durable decisions and a runbook for repeatable operational work. Run `node .agent-standard/scripts/doctor.mjs` before finishing.
