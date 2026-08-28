# Configuration reference

Answers are recorded in `.copier-answers.yml` and reused by `copier update --trust`.

| Setting | Values | Effect |
|---|---|---|
| `project_name` | string | Human name and derived import/package slug |
| `language_stack` | `ts-node`, `ts-next`, `py-fastapi` | Skeleton, language rules, commands, globs, CI setup, and dependency discovery |
| `architecture` | `service-based`, `clean-layered` | Internal module boundaries, dependency direction, scaffold directories, and architecture rules |
| `topology` | `single-deployable`, `modular-monolith`, `distributed-services` | Deployable/data/operational boundaries documented in `docs/topology.md` |
| `mode` | `greenfield`, `adopt` | Whether project source/config skeletons are created |
| `gate` | `strict`, `advisory` | Whether Definition of Done findings block locally and in CI |
| `agents` | `claude`, `codex`, `copilot` | OpenSpec integrations and Ruler output targets; root `AGENTS.md` is always emitted |
| `ci` | boolean | Emits quality, dependency review, and optional CodeQL workflows |
| `bom_format` | `cyclonedx-json`, `spdx-json`, `both` | Committed BOM files and build artifact formats |
| `bom_gate` | `strict`, `advisory` | Whether missing, invalid, or dependency-stale BOMs fail the doctor |
| `security_profile` | `baseline`, `hardened` | Hardened adds CodeQL to dependency and workflow controls |
| `release_attestations` | boolean | Emits tag-triggered GitHub build/SBOM attestations; use only for releasable artifacts |

## Project manifest

`.agent-standard/manifest.json` is the machine-readable source of truth for selected settings, conformance level, install/verify/BOM commands, governed documents, skills, waivers, and supply-chain policy. Its schema is committed beside it. Tool-specific configuration should be derived from or checked against this file instead of inventing another registry.

## Waivers

The only no-test exception surface is `.agent-standard/waivers.json`:

```json
{
  "noTests": [{
    "id": "WAIVER-123",
    "owner": "team@example.com",
    "reason": "generated compatibility shim",
    "expires": "2026-09-30",
    "paths": ["src/generated/**"]
  }]
}
```

A waiver applies only while unexpired and only when all changed source paths match. Environment variables and free-text commit trailers are intentionally not bypasses.

## Adoption mode

Adoption cannot infer an existing repository's exact commands or paths. The rendered manifest and gate contain stack defaults; the adopter must map them to real scripts/globs, add or link architecture documentation, refresh the BOM after the existing lockfile is installed, and run the doctor before changing from advisory to strict.
