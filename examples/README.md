# Example configurations

Four ready-to-use configurations spanning the option space. Each is a Copier answers
file — feed it with `--data-file` to render that setup without answering prompts:

```bash
copier copy --trust --data-file examples/2-ts-node-service-strict.yml \
  gh:landphieran/agent-standard ./my-repo
```

| # | File | Stack | Architecture | Mode | Gate | Agents | CI |
|---|---|---|---|---|---|---|---|
| 1 | `1-py-fastapi-adopt-advisory.yml` | Python FastAPI | service-based | **adopt** | **advisory** | claude | off |
| 2 | `2-ts-node-service-strict.yml` | TS Node | service-based | greenfield | strict | all 3 | on |
| 3 | `3-ts-next-clean-strict.yml` | TS Next.js | clean-layered | greenfield | strict | claude, copilot | on |
| 4 | `4-py-fastapi-clean-strict.yml` | Python FastAPI | clean-layered | greenfield | strict | claude, codex | on |

They are chosen to exercise the whole surface: both languages, all three stacks, both
architectures, both modes (adopt vs greenfield), both gate behaviours (advisory vs
strict), single vs multi-agent, and CI on/off. See [../docs/configuration.md](../docs/configuration.md)
for what each option does.
