# Configuration reference

Answers are recorded in `.agent-standard/copier-answers.yml`, avoiding collisions with other Copier templates in the same repository. Reuse it with `copier update --trust --answers-file .agent-standard/copier-answers.yml`.

## Setup profiles

`standard` is the minimum paved path. It asks only for project identity, stack, mode, ownership, and—when scaffolding—a project architecture. The remaining controls use hardened organization-ready defaults.

`advanced` exposes every setting below. It is intended for platform maintainers, rollout exceptions, and repositories whose constraints differ from the baseline.

| Setting | Values | Standard default / effect |
|---|---|---|
| `setup_profile` | `standard`, `advanced` | `standard`; controls how many questions are shown |
| `project_name` | string | Human name and derived import/package slug; path separators are rejected |
| `language_stack` | `ts-node`, `ts-next`, `py-fastapi` | Skeleton, rules, commands, globs, CI setup, and dependency discovery |
| `mode` | `greenfield`, `adopt` | Scaffold source/config files or preserve and integrate with an existing repository |
| `codeowners` | GitHub users/teams | Required; owns standard, workflow, and security paths |
| `architecture` | `service-based`, `clean-layered` | Chosen for greenfield; `service-based` default during standard adoption |
| `topology` | `single-deployable`, `modular-monolith`, `distributed-services` | `modular-monolith`; kept separate from code architecture |
| `workflow_profile` | `lightweight`, `spec-driven` | `lightweight`; proportional native plans or the full OpenSpec lifecycle |
| `gate` | `strict`, `advisory` | `strict`; whether Definition-of-Done findings block |
| `agents` | `claude`, `codex`, `copilot` | All three; root `AGENTS.md` is always emitted |
| `ci` | boolean | `true`; emits verification and supply-chain workflows |
| `bom_format` | `cyclonedx-json`, `spdx-json`, `both` | `cyclonedx-json` |
| `bom_gate` | `strict`, `advisory` | `strict`; missing, invalid, or dependency-stale BOM behavior |
| `security_profile` | `baseline`, `hardened` | `hardened`; adds CodeQL to dependency controls |
| `release_attestations` | boolean | `false`; opt in only after defining a releasable subject |

## Derived toolchain

The manifest records `project.packageManager`: npm for TypeScript and uv for Python. Both bootstrap and CI use that standardized command set. The transactional installer rejects pnpm, Yarn, Bun, Poetry, PDM, and Pipenv lockfiles until the standard has matching locked-install and SBOM support; it never silently falls back to an unlocked or declaration-only result.

## Project manifest

`.agent-standard/manifest.json` is the machine-readable source of truth for selected settings, target and current conformance state, commands, governed documents, skills, waivers, and supply-chain policy. Its schema is committed beside it. Tool-specific configuration should be derived from or checked against this contract instead of creating another repository registry.

## Workflow profiles

- `lightweight` keeps acceptance criteria in the pull request and creates `docs/changes/` for multi-step, architectural, security-sensitive, migration, or rollback-heavy work.
- `spec-driven` initializes OpenSpec after Ruler and standard-skill propagation so every selected client retains both the shared skills and its OpenSpec workflow artifacts.

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

A waiver applies only while unexpired and only when every changed source path matches. Environment variables and free-text commit trailers are intentionally not bypasses.

## Adoption ownership boundary

Copier owns the standard kernel. Existing project documentation and common shared configuration are skipped on initial adoption; `merge-config.mjs` owns only the delimited CODEOWNERS and pull-request checklist blocks plus the exact Claude hook command. Future updates use Copier’s three-way merge and must be reviewed like source changes.
