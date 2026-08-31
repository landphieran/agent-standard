# Example configurations

Nine configurations span the release-proof matrix. Each is a maintainer Copier answers file; production team adoption uses the assessment-first CLI described in the root README. Maintainer renders must still supply the source revision explicitly:

```bash
copier copy --trust --vcs-ref <FULL_SHA> --data standard_revision=<FULL_SHA> --data-file examples/2-ts-node-service-strict.yml \
  gh:landphieran/agent-standard ./my-repo
```

| # | Platform / pipeline | Stack / mode | Architecture / topology | Workflow | Gate / BOM | Clients / security |
|---|---|---|---|---|---|---|
| 0 | GitHub / Actions | TS Node / greenfield | service-based / modular monolith | lightweight | strict / CycloneDX strict | all / hardened |
| 1 | GitHub / no CI | Python FastAPI / adopt | service-based / modular monolith | lightweight | advisory / SPDX advisory | Claude / baseline |
| 2 | GitHub / Actions | TS Node / greenfield | service-based / modular monolith | spec-driven | strict / CycloneDX strict | all / hardened |
| 3 | GitHub / Actions | Next.js / greenfield | clean-layered / single deployable | spec-driven | strict / both strict | Claude + Copilot / hardened + attestations |
| 4 | GitHub / Actions | Python FastAPI / greenfield | clean-layered / distributed services | spec-driven | strict / SPDX strict | Claude + Codex / hardened |
| 5 | Azure DevOps / standalone | TS Node / greenfield | service-based / modular monolith | lightweight | strict / CycloneDX strict | all / hardened |
| 6 | Azure DevOps / central extends | TS Node / greenfield | clean-layered / modular monolith | lightweight | strict / both strict | Codex + Copilot / hardened |
| 7 | GitHub / Actions | TS Node / adopt | service-based / modular monolith | lightweight | strict / CycloneDX strict | Claude + Codex / baseline |
| 8 | GitHub / Actions | Next.js / adopt | clean-layered / single deployable | lightweight | strict / SPDX strict | Codex + Copilot / baseline |

They cover every supported stack in both greenfield and adoption modes, both repository providers, both Azure Pipeline modes, both workflows, and both BOM formats at least once. Remaining architecture, topology, enforcement, client, CI, and attestation choices use pairwise coverage. See [../docs/configuration.md](../docs/configuration.md) for what each option does.
