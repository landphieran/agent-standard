# Contributing

Changes to `copier.yml` are changes to the public configuration contract. Changes under `template/` affect consumer repositories and must be tested across every example.

1. Explain the intended conformance outcome and affected controls.
2. Update templates, deterministic checks, tests, and maintainer documentation together.
3. Run `npm test` and `pwsh scripts/verify-render.ps1`.
4. Confirm generated `AGENTS.md`, `CLAUDE.md`, client skills, lockfiles, and SBOM files are tracked.
5. Open a pull request using the repository template.
