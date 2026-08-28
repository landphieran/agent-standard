# agent-standard

A configurable, testable repository standard for AI-agent-assisted development. Copier renders the project contract; OpenSpec structures changes; Ruler distributes one rulebook and skill pack across agent clients; deterministic scripts and GitHub Actions enforce everything machines can prove.

## What a repository receives

| Control | Generated implementation |
|---|---|
| Agent execution | Tracked `AGENTS.md`/`CLAUDE.md` plus portable workflow skills generated from `.ruler/` |
| Change workflow | OpenSpec proposal, plan, task, validation, and archive flow |
| Project contract | `.agent-standard/manifest.json` and JSON Schema |
| Documentation maintenance | Indexed docs, metadata, ADR template, runbook index, and link/conformance checks |
| Quality | One Definition of Done verdict locally and in CI; structured expiring waivers |
| Architecture | Stack-specific rules and scaffold, with internal architecture separate from deployment topology |
| Supply chain | Committed CycloneDX JSON, SPDX JSON, or both; lockfile-aware freshness checks and CI build SBOMs |
| Security | SHA-pinned Actions, least-privilege permissions, Dependabot, dependency review, optional CodeQL, optional release attestations |

## Configuration surface

- Stacks: TypeScript Node, TypeScript Next.js, Python FastAPI
- Architecture: capability/service-based or clean/layered
- Topology: single deployable, modular monolith, or distributed services
- Mode: greenfield scaffold or adoption into an existing repository
- Enforcement: strict or advisory Definition of Done; strict or advisory BOM gate
- BOM: CycloneDX JSON, SPDX JSON, or both
- Agents: Claude, Codex, Copilot
- Security: baseline or hardened; optional release attestations

## Quick start

Prerequisites are Git, Node 22+, and Copier through `uvx` or an installed Python tool.

```bash
uvx copier copy --trust gh:landphieran/agent-standard ./my-service
```

Install dependencies before the first commit so the lockfile and generated SBOM are included. Follow [the runbook](docs/runbook.md) for greenfield and adoption paths.

## Maintainer verification

```bash
npm install
npm test
pwsh -NoProfile -File scripts/verify-render.ps1
```

The render matrix exercises all four examples through Copier tasks, tracked Ruler outputs, skill propagation, dependency installation, BOM refresh, doctor checks, and stack-native verification.

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration reference](docs/configuration.md)
- [Adoption and update runbook](docs/runbook.md)
- [Conformance levels and controls](docs/conformance.md)
- [Supply-chain standard](docs/supply-chain.md)
- [GitHub enforcement and hardening](docs/github-hardening.md)
- [Further standardization roadmap](docs/roadmap.md)
- [Rendered examples](examples/README.md)

## Status

Pre-release. The current source identifies itself as `0.6.0-dev`; no release or compatibility promise exists yet. Changes can land as one coherent batch, but the render/update contract is tested before every merge.
