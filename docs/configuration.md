# Configuration reference

Every setting agent-standard asks, its allowed values, and exactly what changes when you
set it. Answers are recorded in `.copier-answers.yml` and re-used by `copier update`.

| Setting | Values | What it controls |
|---|---|---|
| `project_name` | any string | Name used in generated files, the rulebook, and docs. A slug (`pkg`) is derived for package/import names (`My Service` → `my_service`). |
| `language_stack` | `ts-node` · `ts-next` · `py-fastapi` | The whole toolchain: the skeleton, the test runner, the gate's globs, the CI step — **and the coding-standards module** fanned into the agent rulebook (`.ruler/10-<language>.md`), specific to that language/framework. |
| `architecture` | `service-based` · `clean-layered` | The directory layout (`ARCHITECTURE.md`) **and the architecture-standards module** in the rulebook (`.ruler/20-<architecture>.md`), concretized to the chosen language with real directories and forbidden imports. Service-based groups by capability behind contracts; clean-layered enforces inward-pointing dependencies. |
| `mode` | `greenfield` · `adopt` | `greenfield` scaffolds a full project skeleton. `adopt` writes **no** skeleton — only the standard's wiring (rulebook, process, gate) into an existing repo. |
| `gate` | `strict` · `advisory` | `strict` **blocks** work until the definition-of-done passes. `advisory` reports the same findings but never blocks — the honest way to adopt gradually. |
| `agents` | any of `claude`, `codex`, `copilot` | Which tools get a generated rulebook (ruler targets) and OpenSpec tool integration. More agents = more entry files kept in sync from the one `.ruler/` source. |
| `ci` | `true` · `false` | Whether the required-check CI workflow (`.github/workflows/dod.yml`) is emitted. This is the **hard** enforcement boundary; the local hook alone is bypassable. |

## What each choice changes, concretely

**`language_stack`** sets the gate's `.agent-standard/gate.json`:

| Stack | Source | Unit tests | Integration tests | Runner |
|---|---|---|---|---|
| `ts-node` | `src/**/*.ts` | colocated `*.test.ts`, `tests/unit/` | `tests/integration/`, `*.integration.test.ts` | Vitest |
| `ts-next` | `app,src,components,lib/**` | `__tests__/`, `*.test.tsx` | `e2e/*.spec.ts`, `tests/integration/` | Vitest + Playwright |
| `py-fastapi` | `src,app/**/*.py` | `tests/unit/test_*.py` | `tests/integration/test_*.py` | pytest |

**`gate`** — how the definition-of-done gate responds when a change lands source without
a matching test, misplaces a test, or the suite is red:
- `strict` → the local Claude Code stop hook returns `{"decision":"block"}` and CI fails.
- `advisory` → both print the findings and exit 0.
- Either way, an individual change can opt out with a `no-tests-needed` commit trailer.

**`mode: adopt`** omits: the project skeleton, `pyproject.toml`/`package.json`,
`ARCHITECTURE.md`. It keeps: `.ruler/`, the gate (`.claude/hooks/dod.mjs`,
`.agent-standard/gate.json`, `.claude/settings.json`), the CI workflow, and OpenSpec init.

## Standards delivered to the agents

The generated rulebook (`CLAUDE.md` / `AGENTS.md`, built by ruler from `.ruler/`) is
assembled from three modules, so agents get exactly the standards for *this* project and
nothing agnostic:

- `00-operating.md` — the shared loop (spec → plan → build → done) and definition of done.
- `10-<language>.md` — opinionated, research-backed **language/framework standards** (Python+FastAPI, TypeScript+Node, or TypeScript+Next.js): typing discipline, error handling, framework patterns, tooling.
- `20-<architecture>.md` — **architecture standards** concretized to your language: the real directories, the forbidden imports, contracts/DTOs at the boundary, and how to enforce it with an arch-test.

Selecting `py-fastapi` gives Python standards; `ts-next` gives Next.js standards; the
architecture module names actual directories for that language. To change a standard, edit
`.ruler/` and run `ruler apply` — never the generated files.

## What you may not do

There is no setting to disable a rule of the definition-of-done gate individually, and no
setting to point an agent at a different rulebook. The value is consistency; a per-repo
opt-out surface would erode it. Use `advisory` to soften enforcement, or the
`no-tests-needed` trailer for a single justified exception.
