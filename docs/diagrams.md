---
id: DOC-DIAGRAMS
type: reference
status: active
owner: ["@landphieran"]
scope: repository
last_verified: 2026-08-30
verified_against: agent-standard-1.0.0
---

# Agent standard diagrams

These diagrams are the reviewable visual summary of the standard. The architecture and runbook documents remain the normative sources for implementation and procedure; this page keeps the visual explanations together and links them from the source index.

## Six-layer enterprise architecture

```mermaid
flowchart BT
  L1[Layer 1 — Enterprise baseline\ncommon controls and deterministic evidence]
  L2[Layer 2 — Selectable profiles\napproved stack, architecture, workflow and provider choices]
  L3[Layer 3 — Repository overlay\nteam domain, operating and delivery context]
  L4[Layer 4 — Explicit precedence\npredictable resolution when instructions differ]
  L5[Layer 5 — Adoption assessment\nfit, impact, ownership and migration decisions]
  L6[Layer 6 — Governed exceptions\nowned, scoped, evidenced and expiring departures]
  L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

The layers form one control system. The baseline creates consistency; profiles and overlays add approved context; precedence keeps outcomes predictable; assessment makes adoption evidence-based; governed exceptions provide bounded flexibility.

## How the standard works

```mermaid
flowchart LR
  S[Immutable agent-standard source\nversion + revision + template + controls] --> I[Assessment-first init]
  I --> T[Detached staging worktree]
  T --> R[Copier render]
  R --> B[Version-pinned bootstrap]
  B --> O[Ownership classification\ncreate + merge + preserve + collision]
  O -->|confirmed / --apply| C[Consumer repository\nRuler + skills + manifest]
  O -->|blocked| X[Assessment report\nno destination mutation]
  C --> L[Local verification\ndoctor + DoD + SBOM]
  L --> P{Repository provider}
  P -->|GitHub| GH[GitHub Actions adapter]
  P -->|Azure DevOps| AZ[Azure Pipeline adapter\nstandalone or central template]
  GH --> Q[Provider policy\nauthorized admin]
  AZ --> Q
```

The generator owns the rendered contract and provider control files. Repository administrators own the remote settings that make passing checks mandatory.

## Adoption and update runbook

```mermaid
flowchart TD
  A[Assess repository\ndirty is allowed] --> D[Resolve apply decisions\nowner + architecture + immutable SHA]
  D --> W[Render and bootstrap\nin isolated staging worktree]
  W --> V[Verify identity, contract,\nSBOM and ownership seams]
  V --> B{Any blocker?}
  B -->|yes| R[Review findings\nleave destination unchanged]
  B -->|no| Y{Confirm or --apply?}
  Y -->|no| R
  Y -->|yes| P[Recheck HEAD, clean state,\npath hashes and collisions]
  P --> X[Apply verified delta\nwith failure rollback]
  X --> C[Verify and commit generated files\nlockfile + SBOM + docs + skills]
  C --> U[Update later with Copier\nreview three-way merge]
  U --> V
  C --> E[Authorized remote audit\nGitHub rulesets or Azure policies]
```

## Business explanation

```mermaid
flowchart LR
  N[Teams repeatedly rebuild\nagent rules, CI gates, docs,\nsecurity and SBOM controls] --> S[Agent standard]
  S --> W[One versioned contract\nwith greenfield and adoption modes]
  S --> G[Deterministic local and CI gates]
  S --> P[Provider-neutral core\nwith GitHub and Azure adapters]
  S --> O[Portable agent instructions\nand skills]
  W --> B[Consistent delivery baseline]
  G --> T[Evidence-based changes\nand safer merges]
  P --> F[Works across supported\nrepository platforms]
  O --> A[Agents follow the same\nteam operating model]
```

The standard reduces duplicated setup while leaving application architecture, deployment topology, and remote policy ownership explicit. It improves repeatability and audit evidence; it does not reorganize an adopted application or silently change repository settings.
