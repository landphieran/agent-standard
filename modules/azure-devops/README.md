# Azure DevOps enterprise pipeline module

This module is the reference implementation behind the generated Azure Pipeline `extends` mode. It stays in the agent-standard project so its parameter contract and repository-side adapter are reviewed and tested together.

An enterprise should copy or mirror `templates/agent-standard.yml` into a separately protected Azure Repos template repository, apply organization-specific pool/feed/network policy there, and pin consuming repositories to the resulting 40-character commit SHA. Do not make application repositories reference a mutable branch.

The template accepts only these bounded parameters:

| Parameter | Values | Purpose |
|---|---|---|
| `stack` | `ts-node`, `ts-next`, `py-fastapi` | Selects locked installation and CodeQL language |
| `securityProfile` | `baseline`, `hardened` | Always runs licensed Code Security dependency scanning; hardened adds CodeQL while the repository adapter separately requires Secret Protection |
| `sbomFormats` | list containing `cyclonedx-json`, `spdx-json`, or both | Selects committed SBOM artifacts to publish |

It intentionally accepts no arbitrary consumer steps, pool names, shell fragments, service connections, or secrets. Organization policy can wrap or adapt the reference implementation, but changes to the parameter surface should remain backward-compatible and be regression-tested against `examples/6-ts-node-azure-devops-extends.yml`.

Azure Pipeline required-template checks and template-repository permissions are external administrative controls. The application repository pins the template revision; the organization repository controls who can create that revision.
