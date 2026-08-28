# Supply-chain standard

## Format policy

CycloneDX JSON and SPDX JSON are both conformant. CycloneDX is the default because it is expressive for application components, services, vulnerabilities/VEX, and build formulation. SPDX remains a first-class choice for ecosystems and procurement flows centered on license and package exchange. `both` is available when downstream consumers genuinely require both; it is not the default because two equivalent artifacts double maintenance and reconciliation.

The repository BOM is committed as `bom.cdx.json`, `bom.spdx.json`, or both. The deterministic checker validates the selected structure and compares package identities with `package-lock.json`, `package.json`, `uv.lock`, or `pyproject.toml`. Volatile timestamp fields are ignored. CI separately generates a fresh Syft build SBOM artifact in the selected format.

This follows the formats supported by the [Anchore SBOM action](https://github.com/anchore/sbom-action), the [CycloneDX npm tooling](https://github.com/CycloneDX/cyclonedx-node-npm), and the [SPDX specification](https://github.com/spdx/spdx-spec).

## Gate policy

- Strict: missing file, wrong format, malformed structure, or dependency identity drift fails CI.
- Advisory: the same conditions are visible but non-blocking during staged adoption.
- Dependency changes refresh the lockfile and BOM in the same pull request.
- CI build SBOMs are artifacts, not substitutes for the reviewable committed BOM.

## Provenance

Tag-triggered attestations are opt-in. GitHub's attestation action accepts CycloneDX or SPDX SBOM predicates, but signing provides value only if a concrete release artifact is identified and consumers verify it. The long-term target is SLSA provenance with isolated reusable release workflows and protected release environments.

## Beyond the basic implementation

High-value next controls are container/image SBOMs after final packaging, vulnerability/VEX policy with an owned SLA, license allow/deny policy, provenance verification at deployment, and an organization-level dependency inventory such as GUAC. These should be profiles over the same manifest rather than per-repository scripts.
