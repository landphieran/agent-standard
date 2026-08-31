# agent-standard 1.0.0 release evidence

Status: core implementation verified locally; release authorization requires the final immutable commit to pass the configured Windows and Ubuntu CI jobs. Organization pilot authorization is a separate gate.

## Core v1 contract

- Canonical product version: `package.json` = `1.0.0`.
- Manifest schema: independently remains schema 1.
- Render identity: `standardVersion` plus full `standardRevision`; mutable refs require explicit development mode.
- Adoption: one assessment-first `init` command, interactive confirmation or non-interactive `--apply`, no persisted plan.
- Preservation: selected output inventory, fail-closed ownership collisions, narrow validated managed merges, and assessment-to-copy state/hash recheck.
- Recovery: partial-copy rollback plus clean-commit Git recovery procedure.

## Verification evidence

| Proof | Result |
|---|---|
| Unit, gate, source, provider, merge, SBOM, skill, recovery, and CLI tests | Passed locally on Windows; includes no-mutation assessment, mutable refs, ownership collisions, destination drift, failure injection, and Git recovery |
| Source verification | Passed; checks canonical version/revision contract, exact bootstrap-tool versions, immutable external references, schema 1, matrix coverage, provider contracts, and root SBOM |
| Render matrix | Passed across nine configurations: every stack × greenfield/adopt, GitHub, Azure standalone/extends, both workflows, both SBOM formats; pairwise remaining settings |
| Stack-native generated verification | Passed for TypeScript Node, Next.js (unit, browser E2E, production build), and FastAPI |
| Selected Copier update/idempotence | Passed locally from a clean immutable commit for the GitHub spec-driven and Azure central-template fixtures; release CI reruns against the authorized final SHA |
| Supported hosts | Windows 11/PowerShell 7 verified locally; CI requires Windows 2025 and Ubuntu 24.04 jobs on the final commit |

Warnings about local CRLF conversion and Copier's dirty-template development version are expected in working-tree verification and are not release evidence. Release adoption must use the final full SHA in both the npx package source and `--ref`.

## Release gates

**Core release gate:** complete when the final clean commit passes `npm test`, all nine renders, the two selected update round trips, the recovery rehearsal, and both CI host jobs. No remote repository or organization settings are changed by this gate.

**Organization pilot gate:** independently requires an approved repository cohort, real team owners, policy/support links, approved revision, recovery owner, and representative assessment snapshots. The small wrapper under `pilot/` invokes the public CLI and collects pilot measures manually; it is not part of the generated core.

## Explicitly deferred

A separate automated adoption/migration engine, a public SDK, a general organization-profile schema, automated rule migration, persisted plans, a post-success rollback command, network telemetry/dashboarding, report-format surface, and a deterministic document-publishing system are outside v1.
