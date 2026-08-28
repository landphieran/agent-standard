# agent-standard maintainer instructions

This repository is the source of a Copier-based conformance standard. Changes must preserve both the source repository and every supported rendered project.

## Read first

- `README.md` for the product boundary.
- `docs/architecture.md` for ownership and control flow.
- `docs/configuration.md` when changing a Copier answer or generated behavior.
- `docs/runbook.md` when changing bootstrap, update, CI, or release procedures.

## Maintainer contract

- Treat `copier.yml` as the public configuration API and `template/` as generated-project source.
- Keep the manifest, gates, skills, and documentation lifecycle provider-neutral. Put hosting/CI behavior behind explicit GitHub or Azure DevOps adapters and render only the selected provider's control files.
- Keep agent rules canonical in `template/.ruler/`; Ruler-generated outputs are committed in consumer repositories.
- Keep deterministic enforcement in scripts. Prompt instructions explain decisions; CI proves machine-checkable claims.
- Support greenfield and adopt modes for every stack. Architecture and deployment topology remain separate axes.
- CycloneDX JSON and SPDX JSON are equally conformant choices. A selected SBOM must be present, structurally valid, and current with dependency identities.
- Pin third-party bootstrap tools by version, GitHub Actions by full commit SHA, and central Azure Pipeline templates by immutable commit SHA.
- Do not release or change GitHub/Azure DevOps repository or organization settings without explicit authorization. Remote auditors are read-only by default.

## Verification

Run `npm test` for gate and source checks. Before handoff, render all example configurations with `npm run verify:renders` or rely on the same matrix in CI. Any provider change must cover provider isolation plus each supported pipeline mode.

Commit one coherent implementation batch unless the user requests a different history.
