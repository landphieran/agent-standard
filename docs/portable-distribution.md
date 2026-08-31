# Portable distribution

The portable distribution is the team-ready alternative to the full
agent-standard release. It is a single `agent-standard-portable-<version>.tar.gz`
archive containing ready-to-copy, static starter repositories. It is intended
for teams whose approved local tooling is limited to Git, Node/npm, and,
for Python starters, Python/pip.

## What it contains

Each archive contains six greenfield starter repositories:

| Repository host | TypeScript service | Next.js application | FastAPI service |
|---|---|---|---|
| GitHub | `github-ts-node` | `github-ts-next` | `github-py-fastapi` |
| Azure Repos | `azure-ts-node` | `azure-ts-next` | `azure-py-fastapi` |

Every starter includes committed application dependency definitions, a static
agent instruction set, a lightweight change policy, an SBOM generator and
checker implemented with Node's standard library, and the matching GitHub
Actions or Azure Pipelines configuration. Consumers copy one starter into an
empty Git repository, replace the example project identity, review the files,
and commit them.

## Deliberate boundary

The portable archive has no initializer, generator, automatic updater, or
existing-repository merge capability. It does not contain Copier, uv, Ruler,
or OpenSpec—not as an executable, configuration, lockfile, or transitive
application dependency. Updating an adopted repository is a reviewed manual
comparison against a newer static bundle. This trades automation for a small,
auditable runtime dependency boundary.

The full release remains the choice when assessment-first adoption, ownership
collision handling, selectable configuration answers, or managed updates are
needed.

## Build and verification

Maintainers create and verify the archive with:

```bash
npm run verify:portable
```

The command renders all six profiles, creates their committed dependency files,
runs each starter's complete verification, removes generated install/build/test
output, and scans the complete release tree and archive for excluded tools. It
fails if the source checkout is dirty so the recorded revision cannot diverge
from the archived content.
The archive is written to `portable/dist/`, which is intentionally ignored by
Git. Release the generated archive only after running this command from the
immutable commit that will be tagged.

The release metadata records the source revision, host prerequisites, and a
path-bound SHA-256 file inventory for each bundle. The bundle digest is the
SHA-256 of the compact JSON `files` array, whose entries are sorted by path and
contain each relative path and file SHA-256. CI rebuilds and verifies all six
starters on Ubuntu with the minimum supported Python version. The standard
release gate in [release evidence](release-evidence-v1.0.0.md) still applies
independently.
