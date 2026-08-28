# agent-standard

A minimum viable, secure repository baseline for AI-agent-assisted development. It gives teams the same agent workflow, documentation lifecycle, quality checks, and supply-chain controls without requiring every repository to invent them again.

The default path is intentionally small: the installer detects an existing project, stages and verifies the change away from the working repository, preserves project-owned files, and applies the result only after bootstrap succeeds. Teams can opt into the full configuration surface when they need it.

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

Prerequisites are Git, Node 22.13+, and [`uv`](https://docs.astral.sh/uv/) for isolated Copier execution. The project is pre-release, so the installer intentionally uses repository `HEAD` unless `--ref` is supplied.

```bash
npx --yes --package=github:landphieran/agent-standard agent-standard init ./my-service --owner '@acme/platform'
```

For an existing repository, commit or stash current work and run the same command at its root. The installer infers its name, stack, adoption mode, and GitHub/Azure DevOps provider; security ownership remains an explicit choice:

```bash
npx --yes --package=github:landphieran/agent-standard agent-standard init . --owner '@acme/platform'
```

Use `--dry-run` to inspect the verified file plan, `--scm azure-devops` when a new Azure Repos project has no origin yet, `--architecture clean-layered` to change the application layout, `--workflow spec-driven` for OpenSpec, or `--advanced` to answer every remaining control question. The supported minimum toolchains are npm for TypeScript and uv for Python; unsupported lockfiles stop adoption with an actionable error instead of silently weakening SBOM accuracy.

See [the adoption runbook](docs/runbook.md) for the full procedure and the lower-level Copier escape hatch.

## Standard profile

The paved path defaults to a lightweight planning workflow, strict local and CI gates, all supported agent clients, a strict CycloneDX SBOM, hardened security automation, and no release workflow. GitHub origins receive GitHub Actions controls; Azure Repos origins receive the Azure DevOps adapter and a standalone Azure Pipeline. Greenfield users also choose an architecture; adoption preserves existing application and documentation files.

The advanced profile exposes architecture, topology, workflow, enforcement, client, CI, SBOM, security, attestation, repository-provider, and Azure central-template controls. Answers are namespaced under `.agent-standard/` for deterministic updates without colliding with another Copier template.

## Maintainer verification

```bash
npm install
npm test
npm run verify:renders
```

The render matrix exercises two paved paths plus five advanced configurations, including a realistic existing FastAPI repository and both Azure Pipeline modes. It verifies provider isolation, collision preservation, managed configuration merges, client skill discovery, OpenSpec ordering, dependency installation, both SBOM formats, stack-native checks, and idempotent Copier updates.

## Documentation

- [Architecture and ownership](docs/architecture.md)
- [Configuration reference](docs/configuration.md)
- [Adoption and update runbook](docs/runbook.md)
- [Conformance levels and states](docs/conformance.md)
- [Supply-chain standard](docs/supply-chain.md)
- [GitHub enforcement](docs/github-hardening.md)
- [Azure DevOps adapter](docs/azure-devops.md)
- [Enterprise adoption and remaining controls](docs/enterprise-adoption.md)
- [Azure DevOps enterprise template module](modules/azure-devops/README.md)
- [Further standardization roadmap](docs/roadmap.md)
- [Rendered examples](examples/README.md)

## Status

Pre-release. The current source identifies itself as `0.6.0-dev`; no compatibility promise or release has been published. GitHub and Azure DevOps repository settings are outside the generator boundary and remain explicitly unverified until an authorized administrator applies and audits them.
