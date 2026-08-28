# Example configurations

One paved-path fixture and four advanced configurations span the option space and exercise
the regression matrix. Each is a Copier answers file; specify `HEAD` explicitly while the project is pre-release:

```bash
copier copy --trust --vcs-ref HEAD --data-file examples/2-ts-node-service-strict.yml \
  gh:landphieran/agent-standard ./my-repo
```

| # | Stack / mode | Architecture / topology | Workflow | Gate / BOM | Clients / security |
|---|---|---|---|---|---|
| 0 | TS Node / greenfield | service-based / modular monolith | lightweight | strict / CycloneDX strict | all / hardened |
| 1 | Python FastAPI / adopt | service-based / modular monolith | lightweight | advisory / SPDX advisory | Claude / baseline, no CI |
| 2 | TS Node / greenfield | service-based / modular monolith | spec-driven | strict / CycloneDX strict | all / hardened |
| 3 | Next.js / greenfield | clean-layered / single deployable | spec-driven | strict / both strict | Claude + Copilot / hardened + attestations |
| 4 | Python FastAPI / greenfield | clean-layered / distributed services | spec-driven | strict / SPDX strict | Claude + Codex / hardened |

They are chosen to exercise the whole surface: both languages, all three stacks, both
architectures, all topologies, both modes, both gate behaviours, both BOM formats,
single vs multi-agent, CI on/off, and optional attestations. See [../docs/configuration.md](../docs/configuration.md)
for what each option does.
