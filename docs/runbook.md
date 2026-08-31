# Adoption and update runbook

Use the [canonical diagram set](diagrams.md) for a visual summary. This runbook is the normative operator procedure for v1.

## V1 operating promise

`agent-standard init` provides an immutable, deterministic repository baseline that can assess and adopt supported repositories without silently overwriting project-owned content. Assessment and application are deliberately separate decisions inside the same command:

1. inspect repository state and required owner/architecture decisions;
2. render and bootstrap at the selected revision in isolated staging;
3. classify every selected output as create, managed merge, preserved, identical, or blocked collision;
4. show the fresh plan;
5. apply only after confirmation in a terminal or an explicit non-interactive `--apply`.

The assessment is not persisted. Every apply invocation performs a new assessment.

## Prerequisites and supported hosts

- Git 2.27+ and at least one existing commit for adoption
- Node 22.13+
- `uv`/`uvx`
- npm for TypeScript repositories or uv for Python repositories
- one or more real `@owner` aliases
- an explicit `service-based` or `clean-layered` architecture decision

The v1 certified hosts are Windows 11 with PowerShell 7 and Ubuntu 24.04 with bash/PowerShell. macOS is not certified. Assessment can run when the worktree is dirty; application requires a clean worktree so the starting commit is an unambiguous recovery point.

## Pin package and template to one revision

Choose a published full 40-character commit SHA and use it in both positions below:

```bash
npx --yes --package=github:landphieran/agent-standard#<FULL_SHA> -- agent-standard init . \
  --ref <FULL_SHA> \
  --owner '@acme/platform' \
  --architecture service-based
```

The rendered manifest records `standardVersion` and that full `standardRevision`. Branches, tags, shortened SHAs, and `HEAD` are rejected unless `--development` is explicit. Development mode is not an organization pilot or release path.

## Assess first

Run the command without `--apply`. On an existing repository it may be dirty and owner/architecture values may be omitted. The command returns what it can determine and lists anything that prevents an exact render or application.

When the required values are complete, assessment renders into a detached worktree and groups the proposed paths:

- **Create:** absent paths owned by the selected standard output.
- **Managed merge:** only the exact Claude hook and delimited provider review/ownership blocks, after preservation validation.
- **Preserve project-owned:** documented adopt-mode paths skipped by Copier.
- **Identical no-op:** selected output already has the same content.
- **Apply blocker:** any unowned collision, malformed managed boundary, missing decision, mutable revision, unsupported repository/toolchain, dirty worktree, or destination drift.

`--dry-run` always stops after assessment. In an interactive terminal, a blocker-free command asks for confirmation. In automation, omission of `--apply` always means no mutation.

## Apply a reviewed plan

Before applying to an existing repository:

```bash
git status --short
git rev-parse HEAD
```

Commit or stash all work until `git status --short` is empty. Then rerun the same pinned assessment command with `--apply`. The installer rechecks the commit, worktree state, collision-sensitive destination fingerprints, and ownership rules immediately before copying.

```bash
npx --yes --package=github:landphieran/agent-standard#<FULL_SHA> -- agent-standard init . \
  --ref <FULL_SHA> \
  --owner '@acme/platform' \
  --architecture service-based \
  --apply
```

Exit meanings are part of the v1 CLI contract:

- `0`: assessment completed, user declined, or application succeeded.
- `1`: the command, Git, Copier, bootstrap, or another required tool failed operationally.
- `2`: `--apply` was requested but safety or ownership blockers prevented mutation.

## Preservation and collision boundary

Initial adoption never automatically migrates, renames, or replaces existing agent rules or skills. Application is blocked by:

- any existing `.agent-standard/` installation (use Copier update instead);
- any existing `.ruler/` source;
- root or nested `AGENTS.md` or `CLAUDE.md` files;
- same-named standard skills under `.agents/skills/`, `.claude/skills/`, or `.github/skills/`;
- existing OpenSpec artifacts when spec-driven adoption is selected;
- malformed/duplicate managed markers or invalid managed JSON;
- differing content at any selected generated path, including provider workflows/pipelines and `.agent-standard/` files, unless it passes the narrow managed-merge validation.

Existing `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.gitignore`, governed documentation, provider pull-request templates, Claude settings, GitHub CODEOWNERS/Dependabot configuration, and Azure pipeline are preserved according to the documented Copier ownership seam. Provider review metadata and the Claude hook are the only validated merge surfaces.

## Verification and adoption commit

After application, install dependencies, refresh the selected SBOM, and run the repository contract:

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

Map `.agent-standard/gate.json` to the adopted repository's real commands and globs where necessary. Review the complete diff and commit generated rules, client skills, manifest, lockfile, SBOM, documentation, and provider adapter together.

## Recovery

If copying fails, the installer restores replaced files and removes files/directories created by the partial attempt before returning an error.

After a successful apply but before the adoption commit, recovery uses the clean starting commit:

```bash
git diff --name-status
git ls-files --others --exclude-standard
git restore --worktree -- .
git clean -nd
# Review the dry-run list; from the clean starting state it should contain only adoption output.
git clean -fd
git status --short
```

Do not run the final clean command until its dry-run list has been reviewed. After the adoption is committed, use `git revert <adoption-commit>` so recovery is visible in history. V1 does not provide a post-success rollback command or transactional Copier update.

## Future updates

Copier remains the update interface:

```bash
copier update --trust --answers-file .agent-standard/copier-answers.yml --vcs-ref <FULL_SHA> --data standard_revision=<FULL_SHA>
```

Review the three-way merge, reinstall when dependency manifests change, refresh the SBOM, run the manifest verification command, confirm generated instructions and skills remain tracked, and commit the complete update. Exact generated text may change; Copier answer names/values, manifest schema, control IDs, and ownership seams are the compatibility contract.

## Remote enforcement

Generated workflows provide checks but do not make themselves mandatory. After the first push is green, an authorized administrator applies and audits:

- GitHub rulesets and security settings in [github-hardening.md](github-hardening.md).
- Azure DevOps Build Validation, review policies, Advanced Security, and the read-only audit in [azure-devops.md](azure-devops.md).

Until that external state is audited, the manifest remains `pending-remote` or `adopting`. Local success alone is not a conformance claim, and initialization never authorizes remote policy changes.
