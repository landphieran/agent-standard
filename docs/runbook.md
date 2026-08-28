# Adoption and update runbook

## Prerequisites

- Git 2.27+
- Node 22+
- `uv` with ephemeral `uvx copier`, or Copier 9+

Copier tasks execute pinned OpenSpec and Ruler commands, so copy/update requires `--trust`.

## Greenfield repository

```bash
uvx copier copy --trust gh:landphieran/agent-standard ./my-service
cd ./my-service
```

Install before committing so CI's locked install has a lockfile:

```bash
# TypeScript
npm install
npm run sbom
npm run agent:verify

# Python
uv sync
node .agent-standard/scripts/sbom.mjs --write
node .agent-standard/scripts/doctor.mjs
```

Then initialize Git and commit all generated files, including `AGENTS.md`, `CLAUDE.md`, client skill copies, the dependency lockfile, and the selected BOM file(s).

## Existing repository

Commit or stash current work, then render an adoption configuration into the repository:

```bash
uvx copier copy --trust --data-file path/to/adopt-answers.yml gh:landphieran/agent-standard .
```

Start with advisory gates. Map `.agent-standard/gate.json` commands and globs to the repository's real test/lint/build entry points. Merge an existing `.claude/settings.json` carefully. Add the generated documentation routes to existing indexes, refresh the SBOM from the installed lockfile, run the doctor, and commit all adopted artifacts.

Move to strict only after the baseline is green and the CI jobs are required by a ruleset.

## Verify failure behavior once

Change a source file without a test and run:

```bash
echo '{}' | node .claude/hooks/dod.mjs
```

Strict mode returns a Claude block decision. Add a recognised test and rerun. For a legitimate exception, add an owned, reasoned, expiring path waiver and have it reviewed.

## Update

```bash
copier update --trust
```

After the three-way merge:

1. Review Copier conflicts and manifest changes.
2. Reinstall if dependency manifests changed.
3. Run the manifest `updateBom` command.
4. Run the manifest `verify` command.
5. Confirm Ruler outputs and propagated skills are tracked.
6. Review the entire generated diff and commit it as one standard update.

## GitHub enforcement

After the first pushed workflows pass, create a branch ruleset that requires `definition-of-done`, `dependency-review`, and—under the hardened profile—CodeQL. Require pull requests, stale-review dismissal, conversation resolution, linear history if desired, and code-owner review for standard/security paths. See [github-hardening.md](github-hardening.md); repository settings are intentionally not mutated by Copier.
