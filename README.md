# agent-standard

A minimum viable, secure repository baseline for AI-agent-assisted development. Version 1.0 provides an immutable, deterministic baseline that can assess and adopt supported repositories without silently overwriting project-owned content.

The default path is intentionally small: `agent-standard init` assesses first, stages and verifies the change away from the working repository, classifies ownership collisions, and applies only a fresh blocker-free plan. Teams can opt into the existing advanced Copier answers when they need them; v1 does not add an SDK, profile platform, migration engine, telemetry service, or transactional update system.

## What a repository receives

| Concern | Baseline implementation |
|---|---|
| Agent execution | Tracked `AGENTS.md`/`CLAUDE.md` and portable skills generated from one `.ruler/` source |
| Change workflow | Lightweight acceptance criteria and proportional change plans by default; OpenSpec as an opt-in spec-driven profile |
| Project contract | `.agent-standard/manifest.json` plus schema, explicit ownership, workflow, package manager, repository platform, and conformance state |
| Documentation | Governed indexes, freshness metadata, ADR and runbook conventions, and deterministic link/metadata checks |
| Quality | One full verification command, a source-change/test policy, structured expiring waivers, and matching CI behavior |
| Supply chain | Committed CycloneDX JSON, SPDX JSON, or both, with strict or advisory freshness gates |
| Security | Provider-native protected CI, immutable external references, dependency controls, hardened code/secret scanning, and optional GitHub release attestations |

## Recommended setup

Prerequisites are Git, Node 22.13+, and [`uv`](https://docs.astral.sh/uv/) for isolated, version-pinned Copier execution. Replace `<FULL_SHA>` below with one published 40-character commit SHA. The same SHA pins both the executing package and the Copier template.

PowerShell 7 on Windows:

```powershell
npx.cmd --yes "--package=github:landphieran/agent-standard#<FULL_SHA>" -- agent-standard init ./my-service `
  --ref <FULL_SHA> --owner '@acme/platform' --architecture service-based
```

Bash on Ubuntu:

```bash
npx --yes --package=github:landphieran/agent-standard#<FULL_SHA> -- agent-standard init ./my-service \
  --ref <FULL_SHA> --owner '@acme/platform' --architecture service-based
```

That command is assessment-only. It may run against a dirty repository and reports missing decisions or unsafe collisions without changing the destination. Review the plan, make the worktree clean, then add `--apply`; non-interactive mutation is impossible without that flag.

For an existing repository, use `.` instead of `./my-service`. The installer infers its name, stack, adoption mode, and GitHub/Azure DevOps provider; ownership and architecture remain explicit choices.

Use `--dry-run` to force no-mutation behavior, `--scm azure-devops` when a new Azure Repos project has no origin yet, `--workflow spec-driven` for OpenSpec, or `--advanced` to select existing advanced controls. `--development` is the only mode that permits `HEAD`, a branch, or a local mutable template and records the manifest revision as `development`. The supported minimum toolchains are npm for TypeScript and uv for Python; unsupported lockfiles stop adoption with an actionable finding instead of silently weakening SBOM accuracy.

See [the adoption runbook](docs/runbook.md) for the full procedure and safe update flow.

## Portable static distribution

For teams that may use only Git, Node/npm, and Python/pip, the companion
portable release provides six ready-to-copy greenfield repositories. It has no
initializer or automated update path; teams select a host/stack starter,
review it, and commit it to an empty repository. See the
[portable-distribution guide](docs/portable-distribution.md).

## Standard profile

The paved path defaults to a lightweight planning workflow, strict local and CI gates, all supported agent clients, a strict CycloneDX SBOM, hardened security automation, and no release workflow. GitHub origins receive GitHub Actions controls; Azure Repos origins receive the Azure DevOps adapter and a standalone Azure Pipeline. Greenfield users also choose an architecture; adoption preserves existing application and documentation files.

The advanced profile exposes architecture, topology, workflow, enforcement, client, CI, SBOM, security, attestation, repository-provider, and Azure central-template controls. Answers are namespaced under `.agent-standard/` for deterministic updates without colliding with another Copier template.

## Maintainer verification

```bash
npm install
npm test
npm run verify:renders
```

The render matrix exercises every supported stack in greenfield and adoption modes, GitHub and Azure DevOps, standalone and central Azure Pipelines, both workflow profiles, and both SBOM formats. Remaining settings use pairwise coverage. It verifies provider isolation, preservation and managed merges, client skill discovery, OpenSpec ordering, dependency installation, stack-native checks, and selected idempotent Copier updates.

## Documentation

- [Architecture and ownership](docs/architecture.md)
- [Architecture, runbook, and business diagrams](docs/diagrams.md)
- [Configuration reference](docs/configuration.md)
- [Adoption and update runbook](docs/runbook.md)
- [Conformance levels and states](docs/conformance.md)
- [Version 1 release evidence](docs/release-evidence-v1.0.0.md)
- [Portable static distribution](docs/portable-distribution.md)
- [Business six-layer architecture brief](docs/briefs/agent-standard-six-layer-enterprise-architecture.docx)
- [Supply-chain standard](docs/supply-chain.md)
- [GitHub enforcement](docs/github-hardening.md)
- [Azure DevOps adapter](docs/azure-devops.md)
- [Enterprise adoption and remaining controls](docs/enterprise-adoption.md)
- [Azure DevOps enterprise template module](modules/azure-devops/README.md)
- [Further standardization roadmap](docs/roadmap.md)
- [Rendered examples](examples/README.md)

## Version 1 support boundary

The canonical product version is `package.json`; the manifest schema remains independently versioned at schema 1. Stable v1 interfaces are the documented CLI verbs, flags, and exit meanings; Copier answer names and values; manifest schema; control identifiers; and ownership seams. Exact generated prose, complete file contents, console wording, and internal script structure may change in compatible releases.

Supported adoption hosts are Windows 11 with PowerShell 7 and Ubuntu 24.04 with bash/PowerShell. macOS may work but is not certified for v1. GitHub and Azure DevOps repository settings remain outside the generator boundary and unverified until an authorized administrator applies and audits them.
