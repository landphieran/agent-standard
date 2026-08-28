# GitHub enforcement and hardening

The generator commits enforceable jobs but intentionally does not mutate repository or organization settings. Those are privileged external state and require explicit administrator authorization.

## Required baseline

- Default Actions token permission is read-only.
- Allowed Actions follow an organization allowlist and immutable SHA policy.
- A default-branch ruleset requires pull requests, code-owner review for the managed workflow, dependency, agent, skill, OpenSpec, and security paths in CODEOWNERS, stale-review dismissal, and conversation resolution.
- Required jobs include `definition-of-done` and `dependency-review`; hardened repositories also require CodeQL analysis.
- Dependabot alerts and security updates are enabled.
- Secret scanning and push protection are enabled where the GitHub plan supports them.
- Force pushes and branch deletion are disabled on the default branch.

The configured CODEOWNERS block has explicit standard/security paths rather than a repository-wide wildcard, so existing product ownership remains intact.

## Release profile

Use a protected environment, least-privilege OIDC, immutable inputs, signed provenance/SBOM attestations, and documented consumer verification. Do not grant `contents: write`, `packages: write`, `id-token: write`, or `attestations: write` to ordinary pull-request workflows.

## Evidence and drift

A future organization controller should audit rulesets and security features through the GitHub API, compare them with the manifest target, and emit a timestamped evidence record. Until that exists, promotion from `pending-remote` to `conformant` is a reviewed administrative action, not a doctor side effect.

## Current source repository

No repository settings are changed by this implementation. The source manifest therefore records remote enforcement as `unverified`; applying branch rules, vulnerability features, allowed-Action policy, or environments is a separate authorized follow-up after the pushed workflows are green.
