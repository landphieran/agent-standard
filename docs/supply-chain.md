# Supply-chain standard

## Format policy

CycloneDX JSON and SPDX JSON are equally conformant choices. CycloneDX is the default because its model is well suited to application components, services, vulnerabilities/VEX, and build formulation. SPDX remains first-class for ecosystems and procurement flows centered on license and package exchange. `both` is available when a real downstream consumer needs both formats.

The selected artifact is committed as `bom.cdx.json`, `bom.spdx.json`, or both. The deterministic checker validates structure and compares package identities with `package-lock.json` or `uv.lock`, falling back to dependency declarations only before the initial lockfile exists. CI validates and publishes the selected BOM. The GitHub adapter additionally generates a fresh Syft filesystem BOM; the current Azure adapter does not yet claim artifact-level BOM generation or provenance.

The manifest records the format, gate mode, files, and package manager. The minimum standard supports npm and uv end to end. Other package managers must add locked-install commands, dependency parsing, CI caching, and regression renders before becoming accepted options.

## Gate policy

- Strict: a missing file, wrong format, malformed structure, or dependency identity drift fails verification.
- Advisory: the same condition is visible but non-blocking during staged adoption.
- Dependency changes update the lockfile and committed BOM in the same pull request.
- Build SBOM artifacts complement but do not replace the reviewable committed BOM.
- CycloneDX and SPDX are normalized to the same package-identity comparison, so format choice does not change gate strength.

## Relationship to provider dependency controls

The committed BOM answers “what this repository resolved.” GitHub adds Dependabot, dependency review, and optional CodeQL. Every CI-enabled Azure DevOps adapter runs Code Security dependency scanning; the hardened profile adds CodeQL and expects Secret Protection with push protection. None substitutes for the others. GitHub jobs require a ruleset, while Azure needs both blocking Build Validation and the blocking `AdvancedSecurity/NewHighAndCritical` status policy because its dependency task reports findings without failing the build by itself.

## Provenance

Tag-triggered attestations are opt-in. Signing is meaningful only after the repository defines the build subject and consumers verify it. The long-term target is isolated reusable release workflows, protected environments, and deployment-time provenance verification.

## Next supply-chain profiles

High-value extensions are container/image SBOMs after final packaging, vulnerability and VEX policy with an owned SLA, license policy, cryptographic BOMs for relevant products, provenance verification at deployment, and an organization dependency inventory. These should remain profiles over the same manifest rather than bespoke repository scripts.
