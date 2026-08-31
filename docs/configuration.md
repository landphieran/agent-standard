# Configuration reference

Answers are recorded in `.agent-standard/copier-answers.yml`, avoiding collisions with other Copier templates in the same repository. Reuse it with `copier update --trust --answers-file .agent-standard/copier-answers.yml --vcs-ref <FULL_SHA> --data standard_revision=<FULL_SHA>` so the rendered manifest records the same immutable revision Copier used.

## Setup profiles

`standard` is the minimum paved path. It asks only for project identity, stack, mode, ownership, and—when scaffolding—a project architecture. The remaining controls use hardened organization-ready defaults.

`advanced` exposes every setting below. It is intended for platform maintainers, rollout exceptions, and repositories whose constraints differ from the baseline.

| Setting | Values | Standard default / effect |
|---|---|---|
| `setup_profile` | `standard`, `advanced` | `standard`; controls how many questions are shown |
| `project_name` | string | Human name and derived import/package slug; path separators are rejected |
| `language_stack` | `ts-node`, `ts-next`, `py-fastapi` | Skeleton, rules, commands, globs, CI setup, and dependency discovery |
| `mode` | `greenfield`, `adopt` | Scaffold source/config files or preserve and integrate with an existing repository |
| `repository_platform` | `github`, `azure-devops` | `github` for direct Copier use; the recommended installer detects the origin and supports `--scm` override |
| `owners` | `@owner` aliases | Required portable ownership intent; rendered into CODEOWNERS on GitHub and the Azure adapter contract on Azure DevOps |
| `architecture` | `service-based`, `clean-layered` | Direct Copier default is `service-based`; the supported v1 installer requires an explicit adoption decision before apply |
| `topology` | `single-deployable`, `modular-monolith`, `distributed-services` | `modular-monolith`; kept separate from code architecture |
| `workflow_profile` | `lightweight`, `spec-driven` | `lightweight`; proportional native plans or the full OpenSpec lifecycle |
| `gate` | `strict`, `advisory` | `strict`; whether Definition-of-Done findings block |
| `agents` | `claude`, `codex`, `copilot` | All three; root `AGENTS.md` is always emitted |
| `ci` | boolean | `true`; emits verification and supply-chain workflows |
| `azure_pipeline_mode` | `standalone`, `extends` | `standalone`; `extends` delegates CI to an immutable organization template |
| `azure_default_branch` | safe branch name | `main`; target for Azure Repos build-validation and review policies |
| `azure_template_repository` | `Project/Repository` | Central Azure Repos template location; extends mode only |
| `azure_template_ref` | 40-character commit SHA | Required immutable central-template revision; extends mode only |
| `azure_template_path` | repository-relative YAML path | `templates/agent-standard.yml`; extends mode only |
| `bom_format` | `cyclonedx-json`, `spdx-json`, `both` | `cyclonedx-json` |
| `bom_gate` | `strict`, `advisory` | `strict`; missing, invalid, or dependency-stale BOM behavior |
| `security_profile` | `baseline`, `hardened` | `hardened`; baseline keeps provider dependency review/scanning, while hardened adds code and secret protections |
| `release_attestations` | boolean | `false`; opt in only after defining a releasable subject; currently implemented only by the GitHub adapter |

## Derived toolchain

The manifest records `project.packageManager`: npm for TypeScript and uv for Python. Both bootstrap and CI use that standardized command set. The transactional installer rejects pnpm, Yarn, Bun, Poetry, PDM, and Pipenv lockfiles until the standard has matching locked-install and SBOM support; it never silently falls back to an unlocked or declaration-only result.

`standard_revision` is a hidden rendering input rather than an organization profile. Supported release adoption supplies a lowercase full commit SHA; `development` is permitted only by an explicit development invocation. `package.json` is the canonical product version, while manifest schema version 1 changes only when the manifest shape becomes incompatible.

## Project manifest

`.agent-standard/manifest.json` is the machine-readable source of truth for product version/revision, selected settings, target and current conformance state, repository/CI platform, commands, governed documents, skills, waivers, and supply-chain policy. Its schema is committed beside it. Provider-specific desired state lives under `.agent-standard/platforms/` and is checked against the portable manifest instead of creating a competing repository registry.

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

Copier owns the standard kernel. Existing project documentation and common shared configuration are skipped on initial adoption; `merge-config.mjs` owns only the provider-appropriate delimited ownership/review blocks plus the exact Claude hook command. Supported team adoption uses the assessment-first CLI to protect the wider generated-path boundary. Future updates use Copier’s three-way merge and must be reviewed like source changes.

Azure DevOps implementation and one-time administrator steps are documented in [azure-devops.md](azure-devops.md). Azure workload deployment configuration is intentionally a separate future profile; choosing Azure Repos must not silently introduce subscriptions, service connections, or cloud resources.

The rendered Azure adapter starts with `pipeline.definitionId: null` because Azure assigns that ID only after pipeline creation. Recording the assigned positive ID is the one intentional post-create configuration step; the remote auditor then proves that the blocking branch policy points to that exact pipeline rather than merely any successful build.
