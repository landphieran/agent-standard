# agent-standard maintainer instructions

This repository is the source of a Copier-based conformance standard. Changes must preserve both the source repository and every supported rendered project.

## Read first

- `README.md` for the product boundary.
- `docs/architecture.md` for ownership and control flow.
- `docs/configuration.md` when changing a Copier answer or generated behavior.
- `docs/runbook.md` when changing bootstrap, update, CI, or release procedures.

## Maintainer contract

- Treat `copier.yml` as the public configuration API and `template/` as generated-project source.
- Keep agent rules canonical in `template/.ruler/`; Ruler-generated outputs are committed in consumer repositories.
- Keep deterministic enforcement in scripts. Prompt instructions explain decisions; CI proves machine-checkable claims.
- Support greenfield and adopt modes for every stack. Architecture and deployment topology remain separate axes.
- CycloneDX JSON and SPDX JSON are equally conformant choices. A selected SBOM must be present, structurally valid, and current with dependency identities.
- Pin third-party bootstrap tools by version and GitHub Actions by full commit SHA.
- Do not release or change GitHub repository settings without explicit authorization.

## Verification

Run `npm test` for gate and source checks. Before handoff, render all example configurations with `npm run verify:renders` or rely on the same matrix in CI.

Commit one coherent implementation batch unless the user requests a different history.
