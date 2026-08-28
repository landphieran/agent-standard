# Further standardization roadmap

The basic implementation intentionally stops before organization-specific policy. These are the strongest next opportunities, in priority order.

1. **Organization control profile.** Map manifest control IDs to NIST SSDF outcomes and export evidence. NIST frames SSDF as an outcome-based, risk-adjusted practice set rather than a universal checklist: [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final).
2. **Policy-as-code rulesets.** Provision GitHub rules, security settings, environments, and allowed Actions from a reviewed organization repository. Keep project templates declarative and administrative mutation centralized.
3. **Artifact provenance maturity.** Move release builds into isolated reusable workflows and verify attestations at consumption/deployment, aligning with [SLSA v1.2](https://slsa.dev/spec/v1.2/).
4. **Security posture evidence.** Add OpenSSF Scorecard and an organization dashboard for control drift. [OpenSSF Scorecard](https://openssf.org/scorecard/) automates a useful set of repository security checks but should inform risk decisions rather than become a score target.
5. **Agent threat model profile.** For repositories that build agents or expose tools/MCP, add explicit authorization, tool allowlists, data-flow classification, memory isolation, approval boundaries, and adversarial evals mapped to the [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/).
6. **Ownership and service catalog integration.** Generate CODEOWNERS, service metadata, on-call/runbook links, data classification, and lifecycle state from one organization catalog instead of asking each repo independently.
7. **Migration and exception lifecycle.** Add a central waiver registry with owner, expiry, compensating control, approval, review reminders, and metrics. Expired exceptions should fail closed.
8. **Evals for agent instructions and skills.** Maintain representative repository tasks and score success, unnecessary context, safety-boundary adherence, and regression rate before changing shared prompts or skills.

These patterns mirror the useful parts of WIPFU (progressive-disclosure task routing), Tincturo (canonical root guidance plus nested ownership/freshness metadata), and Receipt Engine (a machine-readable agent manifest and deterministic validators) without copying project-specific conventions into the universal baseline.
