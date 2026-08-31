# Organization pilot wrapper

This folder is outside `template/` and therefore outside the provider-neutral generated core. Copy it into a private organization-owned location, set the real policy URL and support contact in `pilot-settings.psd1`, and approve one published full commit SHA before authorizing a team pilot.

The wrapper is intentionally small: it pins the npx package and template to the same SHA, passes checked-in defaults to the public CLI, and preserves assessment-first behavior. It is not an SDK or organization-profile schema.

Assessment:

```powershell
./agent-standard-pilot.ps1 -Revision '<FULL_SHA>' -Owner '@acme/team' -Path '../repository'
```

Application after review and a clean worktree:

```powershell
./agent-standard-pilot.ps1 -Revision '<FULL_SHA>' -Owner '@acme/team' -Path '../repository' -Apply
```

Pilot authorization is a separate gate from the core v1 release. Before a team starts, record the repository owner, support route, policy link, approved revision, recovery owner, and the small set of manually collected measures: assessment result, time to adopt, first verification result, blockers, and recovery use.
