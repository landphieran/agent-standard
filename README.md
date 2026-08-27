# agent-standard

A configurable **paved path** for AI-agent-driven development. Adopt it into a repository
and get one consistent, *enforced* process: a planning workflow, one rulebook shared
across every agent tool, an opinionated architecture skeleton for your stack, and a
definition-of-done gate that blocks "done" until the plan was followed and the tests are
real — in the right place, of the right type, and passing.

It is a thin **integration spine**, not a monolith: it composes three mature tools and
adds the one thing none of them do.

| Concern | Tool |
|---|---|
| Delivery + scaffolding + staying current | **Copier** (`copier update`) |
| Planning: spec → plan → tasks | **OpenSpec** |
| One rulebook across Claude / Codex / Copilot | **ruler** |
| **Definition-of-done enforcement** | a purpose-built gate (`dod.mjs`) — the differentiator |

## Configurable

| Setting | Options |
|---|---|
| Stack | TypeScript Node service · TypeScript Next.js · Python FastAPI |
| Architecture | service-based · clean/layered |
| Mode | greenfield (scaffold) · adopt (existing repo) |
| Gate | strict (blocks) · advisory (reports) |
| Agents | Claude · Codex · Copilot |
| CI | required check on/off |

## Quick start

```bash
# needs: Git, Python+Copier (uv tool install copier), Node >=20
copier copy --trust gh:landphieran/agent-standard ./my-service
```

Or use a ready-made configuration: `--data-file examples/2-ts-node-service-strict.yml`.
Full steps for new and existing repos: **[docs/runbook.md](docs/runbook.md)**.

## Documentation

- [docs/runbook.md](docs/runbook.md) — stand it up (new repo or adopt), and stay current
- [docs/configuration.md](docs/configuration.md) — every setting and its impact
- [docs/architecture.md](docs/architecture.md) — how the four tools compose (with diagrams)
- [examples/](examples/) — four ready-to-render configurations

## Repository layout

```
copier.yml            the config model + tasks that bootstrap OpenSpec & ruler
template/             what gets rendered into a consumer repo
  .claude/hooks/dod.mjs   the definition-of-done gate (Node, cross-platform)
  .agent-standard/        the gate's per-stack config
  .ruler/                 the rulebook source (fanned out by ruler)
  .github/workflows/      the required CI check
  <skeletons>             stack × architecture, gated by answers
test/                 fixture tests for the gate
examples/             four example configurations
docs/                 architecture, configuration, runbook
```

## Status

Working baseline. All three stacks render, install, test green, and are gate-enforced;
`copier update` round-trips; adopt mode wires an existing repo without a skeleton. Tool
versions are pinned in `copier.yml`. Local repository only until a remote is chosen.
