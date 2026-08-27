# Runbook

How to stand up agent-standard — as a new repository, or into an existing one — and how
to keep it current. Two paths; both take a few minutes.

## Prerequisites (once per machine)

- **Git** ≥ 2.27
- **Python** ≥ 3.10 with **Copier** — `uv tool install copier` (or `pipx install copier`).
  You can also run it ephemerally with `uvx copier ...`.
- **Node** ≥ 20 — for OpenSpec, ruler, and the gate (all invoked via `npx`, no global install).

Copier runs shell tasks (OpenSpec + ruler), so every command below passes **`--trust`**.

## Path A — a new repository (greenfield)

```bash
# 1. render the paved path (pick a stack + architecture when prompted, or use an example)
copier copy --trust gh:landphieran/agent-standard ./my-service
#    or non-interactively:
#    copier copy --trust --data-file examples/2-ts-node-service-strict.yml \
#      gh:landphieran/agent-standard ./my-service

cd my-service

# 2. commit what was generated (Copier + OpenSpec + ruler have written the repo)
git init && git add -A && git commit -m "chore: scaffold with agent-standard"

# 3. install deps and confirm the suite is green
#    Python:      uv sync && uv run pytest
#    TS Node/Next: npm install && npm test

# 4. (if ci: true) make .github/workflows/dod.yml a REQUIRED check on your protected branch
```

You now have: the OpenSpec process (`openspec/`), one rulebook fanned out to your agents
(`CLAUDE.md` / `AGENTS.md` from `.ruler/`), a skeleton in your chosen architecture, and the
definition-of-done gate wired locally and in CI.

## Path B — an existing repository (adopt)

```bash
# from the root of your existing repo (commit or stash first)
copier copy --trust --data-file examples/1-py-fastapi-adopt-advisory.yml \
  gh:landphieran/agent-standard .
```

`mode: adopt` writes **no skeleton** — it only adds the standard's wiring: `.ruler/`, the
gate, the CI workflow, and OpenSpec. Then:

```bash
# review what landed — especially .claude/settings.json (the stop hook) and .gitignore
git add -A && git commit -m "chore: adopt agent-standard"
```

Start in **`gate: advisory`** (as example 1 does) so the gate reports without blocking
while your team gets used to it, then re-render with `gate: strict` when ready.

> Adopt note: if you already have a `.claude/settings.json`, Copier will flag the conflict
> on render — merge the `hooks.Stop` entry into your existing file rather than overwriting.

## Verify the gate actually blocks (do this once)

```bash
# change source without a test, then run the gate as Claude Code would:
echo '{}' | node .claude/hooks/dod.mjs        # strict → prints a {"decision":"block"} JSON
```

Add a matching test in the right location and it exits cleanly. This is the whole point —
see it fail once so you trust it.

## Staying current

The standard evolves; pull its improvements without losing your work:

```bash
copier update --trust
```

Copier re-renders from the recorded answers, 3-way-merges against your changes, and re-runs
`ruler apply` (regenerating `CLAUDE.md`/`AGENTS.md`) and `openspec update`. Your code,
`openspec/` content, and generated agent files are preserved. Resolve any merge markers,
run the tests, and commit.

## Day-to-day (what the standard asks of every change)

1. Capture the change as an OpenSpec spec → plan → tasks (don't skip to code).
2. Build it against `ARCHITECTURE.md`.
3. Write tests in the right location and type for your stack.
4. "Done" is when the gate passes — locally on stop, and required in CI.

Reference: [configuration.md](configuration.md) for every option, [architecture.md](architecture.md)
for how the pieces fit.
