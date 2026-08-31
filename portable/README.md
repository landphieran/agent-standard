# agent-standard portable 1.0.0

This is a static distribution of the agent-standard baseline. It contains
ready-to-copy starter repositories; it does not include an installer or a
generator.

## Local requirements

- Git 2.27 or later
- Node.js 22.13 or later, including npm
- Python 3.11 or later for the Python starter repositories

No separate bootstrap tool is required. Application packages are installed
from the committed `package-lock.json` or `requirements.txt` in the selected
starter repository.

## Choose a starter repository

| Bundle | Use for |
|---|---|
| `bundles/github-ts-node` | TypeScript Node service on GitHub |
| `bundles/github-ts-next` | Next.js application on GitHub |
| `bundles/github-py-fastapi` | Python FastAPI service on GitHub |
| `bundles/azure-ts-node` | TypeScript Node service in Azure Repos |
| `bundles/azure-ts-next` | Next.js application in Azure Repos |
| `bundles/azure-py-fastapi` | Python FastAPI service in Azure Repos |

Each bundle is greenfield-only. Start from an empty Git repository, copy the
contents of one selected bundle into it, replace the documented example project
name and owner alias, review the complete diff, then make the first commit.

Existing-repository adoption is intentionally manual in this distribution:
copying a static bundle cannot safely resolve conflicts with project-owned
files. Use the full release for the assessed adoption workflow.

## First verification

For a TypeScript bundle:

```bash
npm ci
npm run sbom
npm run agent:verify
```

For a Python bundle, create and activate a virtual environment first, then:

```bash
python -m pip install -r requirements.txt
node .agent-standard/scripts/sbom.mjs --write
node .agent-standard/scripts/verify.mjs
```

The generated CI configuration repeats the same checks. Repository policy and
protected-branch settings remain administrator-owned decisions.

## Refreshing a starter repository

This distribution does not update a repository automatically. Download a newer
portable release, compare its selected bundle with your repository, apply the
reviewed changes, refresh the SBOM, run verification, and commit the result as
one change.
