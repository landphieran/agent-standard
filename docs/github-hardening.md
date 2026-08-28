# GitHub enforcement and hardening

The repository contains the files needed for enforcement, but branch/ruleset and security-feature settings are external administrative state. Apply them only after workflows pass and with explicit owner authorization.

## Required baseline

- Actions default token permission: read-only.
- Allowed Actions: organization allowlist or verified creators; require full SHA pinning.
- Branch ruleset: pull request required, code-owner review for `.github/`, `.agent-standard/`, `.ruler/`, and `SECURITY.md`; stale approvals dismissed; conversations resolved.
- Required checks: Definition of Done and dependency review; CodeQL when available under the hardened profile.
- Dependabot alerts and security updates enabled.
- Secret scanning and push protection enabled where the plan supports them.
- Force pushes and branch deletion disabled on the default branch.

## Release profile

Use a protected environment, least-privilege OIDC, immutable inputs, signed provenance/SBOM attestations, and documented consumer verification. Do not grant `contents: write`, `packages: write`, `id-token: write`, or `attestations: write` to ordinary PR workflows.

## Current project note

The source repository is private and may not have every GitHub Advanced Security feature available. CI and dependency automation are committed now. Enabling vulnerability alerts, automated security updates, SHA-pinning policy, and a main-branch ruleset is the administrative follow-up after the first green push.
