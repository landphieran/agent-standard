# Adoption and update runbook

## Prerequisites

- Git 2.27+
- Node 22.13+
- `uv`/`uvx`
- a clean Git worktree for an existing repository
- a real GitHub user or team for protected paths

Bootstrap executes version-pinned Ruler and, for the spec-driven profile, OpenSpec. Copier therefore runs with `--trust` inside an isolated staging worktree.

## Recommended installer

Greenfield:

```bash
npx --yes --package=github:landphieran/agent-standard agent-standard init ./my-service --owner '@acme/platform'
```

Existing repository:

```bash
cd ./existing-repository
npx --yes --package=github:landphieran/agent-standard agent-standard init . --owner '@acme/platform'
```

Ownership is always explicit because a GitHub organization name alone is not a valid substitute for the team responsible for protected paths. The installer:

1. requires the repository root, a clean worktree, and an existing commit;
2. detects the supported stack and package manager;
3. renders and bootstraps in a detached temporary worktree;
4. prints the exact file plan;
5. copies the verified delta with rollback backups if application fails.

`--dry-run` performs the staging and verification but leaves the destination unchanged. The current minimum toolchains are npm and uv. An unsupported package-manager lockfile fails before rendering because the corresponding locked install and SBOM parser are not yet standardized.

## Initial verification

Install dependencies, refresh the committed SBOM, and run the single repository contract:

```bash
# TypeScript
npm install
npm run sbom
node .agent-standard/scripts/verify.mjs

# Python
uv sync
node .agent-standard/scripts/sbom.mjs --write
node .agent-standard/scripts/verify.mjs
```

In adoption mode, first map `.agent-standard/gate.json` commands and globs to the repository’s real lint, type, build, unit, and integration checks. Commit the lockfile, selected SBOM files, generated rulebooks, and client skills together.

## What adoption preserves

Initial adoption does not overwrite an existing `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.gitignore`, governed documentation file or template, Dependabot file, pull-request template, Claude settings, CODEOWNERS, or another Copier template's root answers file. The bootstrap adds one idempotent Claude Stop hook, one delimited CODEOWNERS block, and one delimited pull-request checklist while preserving unrelated configuration.

The standard’s documentation entry point is `docs/agent-standard.md`, so teams can link it from their existing index on their own terms.

## Advanced and direct Copier use

Use `--workflow spec-driven` to install OpenSpec. Use `--advanced` to answer all controls interactively. For automation or an answer file, Copier remains the lower-level interface; specify `HEAD` explicitly while the project is pre-release:

```bash
uvx copier copy --trust --vcs-ref HEAD \
  --answers-file .agent-standard/copier-answers.yml \
  --data-file path/to/answers.yml \
  gh:landphieran/agent-standard .
```

Direct Copier adoption still preserves the protected files, but only the recommended installer provides destination-level transaction and rollback behavior.

## Test policy behavior

To inspect the local Definition-of-Done policy after changing a source file:

```bash
echo '{}' | node .agent-standard/scripts/dod.mjs
```

Strict mode returns a Claude block decision or a non-zero CI result. Advisory mode reports the same finding without blocking. A legitimate exception must be an owned, reasoned, expiring path waiver in `.agent-standard/waivers.json`.

## Update

```bash
copier update --trust --answers-file .agent-standard/copier-answers.yml
```

After the three-way merge:

1. review conflicts and manifest changes;
2. reinstall if dependency manifests changed;
3. run the manifest `updateBom` command;
4. run the manifest `verify` command;
5. confirm generated instructions and skills are tracked;
6. review and commit the complete standard update together.

## GitHub enforcement

Generated workflows provide checks but do not make themselves mandatory. After the first push is green, an authorized administrator must apply the branch ruleset and security settings described in [github-hardening.md](github-hardening.md). Until that external state is audited, the manifest remains `pending-remote` or `adopting`; local success alone is not a conformance claim.
