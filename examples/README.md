# Example configurations

Four ready-to-use configurations spanning the option space. Each is a Copier answers
file — feed it with `--data-file` to render that setup without answering prompts:

```bash
copier copy --trust --data-file examples/2-ts-node-service-strict.yml \
  gh:landphieran/agent-standard ./my-repo
```

| # | Stack / mode | Architecture / topology | Gate / BOM | Security |
|---|---|---|---|---|
| 1 | Python FastAPI / adopt | service-based / modular monolith | advisory / SPDX advisory | baseline, no CI |
| 2 | TS Node / greenfield | service-based / modular monolith | strict / CycloneDX strict | hardened |
| 3 | Next.js / greenfield | clean-layered / single deployable | strict / both strict | hardened + release attestations |
| 4 | Python FastAPI / greenfield | clean-layered / distributed services | strict / SPDX strict | hardened |

They are chosen to exercise the whole surface: both languages, all three stacks, both
architectures, all topologies, both modes, both gate behaviours, both BOM formats,
single vs multi-agent, CI on/off, and optional attestations. See [../docs/configuration.md](../docs/configuration.md)
for what each option does.
