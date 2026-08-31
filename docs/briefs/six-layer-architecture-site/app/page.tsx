"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

type TabId = "system" | "layers" | "capabilities" | "workflow" | "value" | "risks" | "presenter";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "system", label: "System context" },
  { id: "layers", label: "Six layers" },
  { id: "capabilities", label: "Capabilities" },
  { id: "workflow", label: "Adoption workflow" },
  { id: "value", label: "Value case" },
  { id: "risks", label: "Risks & decisions" },
  { id: "presenter", label: "Presenter kit" },
];
const tabIds = new Set(tabs.map((tab) => tab.id));

const layers = [
  {
    number: "01", title: "Enterprise baseline", promise: "One trusted minimum for every supported repository.",
    purpose: "Establish the common contract for agent behavior, ownership, security, quality and completion evidence.",
    functionality: "Provides approved guidance, immutable versioning, safe repository adoption and repeatable verification.",
    value: "Reduces ambiguity and gives teams a consistent starting point without silently replacing project-owned knowledge.",
    impacts: ["Security", "Quality", "Consistency", "Auditability"],
  },
  {
    number: "02", title: "Selectable profiles", promise: "Approved patterns for common technologies and delivery models.",
    purpose: "Package reusable guidance for recurring engineering contexts such as technology stacks or delivery environments.",
    functionality: "Lets teams select a supported profile instead of rebuilding the same decisions repository by repository.",
    value: "Speeds setup while keeping specialized guidance reviewable and centrally maintained.",
    impacts: ["Speed", "Reuse", "Quality", "Scale"],
  },
  {
    number: "03", title: "Repository overlay", promise: "Local business and system context stays close to the work.",
    purpose: "Capture the facts, constraints and operating knowledge that are unique to a repository or product.",
    functionality: "Adds local guidance without copying or weakening the enterprise baseline.",
    value: "Makes agent assistance relevant while preserving clear ownership between central standards and project teams.",
    impacts: ["Relevance", "Ownership", "Quality", "Maintainability"],
  },
  {
    number: "04", title: "Explicit precedence", promise: "Everyone knows which instruction wins when guidance overlaps.",
    purpose: "Define a predictable order across enterprise, profile and repository guidance.",
    functionality: "Resolves conflicts consistently and exposes the effective instruction path for review.",
    value: "Lowers troubleshooting time and reduces the risk of accidental or contradictory behavior.",
    impacts: ["Predictability", "Security", "Supportability", "Trust"],
  },
  {
    number: "05", title: "Adoption assessment", promise: "Review first; change only with explicit approval.",
    purpose: "Assess an existing repository safely before any standard-owned content is introduced.",
    functionality: "Shows readiness, required decisions, ownership collisions and the proposed change set.",
    value: "Enables faster onboarding without treating existing project knowledge as disposable.",
    impacts: ["Safety", "Speed", "Transparency", "Adoption"],
  },
  {
    number: "06", title: "Governed exceptions", promise: "Flexibility remains owned, time-bound and visible.",
    purpose: "Allow justified deviations without fragmenting the standard or creating permanent shadow rules.",
    functionality: "Records the reason, owner, scope, approval and review or expiry point for each exception.",
    value: "Balances enterprise control with delivery reality and creates an evidence base for improving the standard.",
    impacts: ["Flexibility", "Accountability", "Learning", "Auditability"],
  },
];

const capabilities = [
  { title: "Define the baseline", layers: "Layer 1", process: ["Approve standards", "Publish guidance", "Verify evidence"], result: "A trusted minimum for every supported repository." },
  { title: "Adapt to context", layers: "Layers 2–3", process: ["Select a profile", "Add local context", "Keep ownership clear"], result: "Relevant guidance without central duplication." },
  { title: "Adopt safely", layers: "Layers 4–5", process: ["Resolve precedence", "Assess current state", "Review before change"], result: "Predictable onboarding that protects project knowledge." },
  { title: "Govern over time", layers: "Layer 6", process: ["Request deviation", "Approve with an owner", "Review or expire"], result: "Accountable flexibility with an audit trail." },
];

const workflow = [
  { number: "1", title: "Approve revision", detail: "Choose one trusted baseline." },
  { number: "2", title: "Assess repository", detail: "Review current state without changing it." },
  { number: "3", title: "Resolve decisions", detail: "Confirm ownership and architecture context." },
  { number: "4", title: "Apply safely", detail: "Require explicit approval before mutation." },
  { number: "5", title: "Verify & govern", detail: "Produce evidence and manage future updates." },
];

const measures = [
  { outcome: "Safer adoption", question: "Did the standard protect repository-owned content?", indicator: "Unowned collisions found before change; silent overwrites", evidence: "Assessment results and pilot issue log" },
  { outcome: "Higher quality", question: "Did teams reach the agreed completion standard more consistently?", indicator: "First-pass conformance; rework caused by missing guidance", evidence: "Control results and retrospective review" },
  { outcome: "Faster delivery", question: "Did reusable decisions remove setup and support effort?", indicator: "Time to assess and adopt; repeated questions per repository", evidence: "Pilot timestamps and support log" },
  { outcome: "Engineering scale", question: "Can multiple teams use one baseline without losing local context?", indicator: "Shared baseline adoption; local overlays; maintenance effort", evidence: "Repository inventory and maintainer review" },
  { outcome: "Stakeholder trust", question: "Could teams explain what changed and why?", indicator: "Team-reported clarity; unresolved objections; exception reasons", evidence: "Short survey and decision record" },
];

const risks = [
  { risk: "The baseline changes unexpectedly", dependency: "An approved, identifiable standard revision", control: "Use an immutable revision and record what each repository adopted.", decision: "Who approves a new baseline for pilot use?" },
  { risk: "Project knowledge is overwritten", dependency: "A clear boundary between standard-owned and project-owned content", control: "Assess first and stop when unowned content would collide.", decision: "Who resolves ownership conflicts before application?" },
  { risk: "Conformance is assumed rather than proven", dependency: "Reliable local checks and separately owned platform controls", control: "Report local evidence honestly and keep unknown remote state visible.", decision: "Which evidence is required for pilot acceptance?" },
  { risk: "Governance grows faster than adoption", dependency: "A deliberately small product boundary", control: "Release Layer 1 first; add later layers only when pilot evidence supports them.", decision: "What evidence is enough to fund the next layer?" },
];

const artifacts = [
  { title: "One-page executive brief", audience: "Sponsors and governance leaders", use: "States the problem, bounded promise, pilot decision and expected evidence." },
  { title: "Interactive architecture brief", audience: "Business and technology stakeholders", use: "Explains the system, layers, workflow, value and risk in one navigable view." },
  { title: "Pilot scorecard", audience: "Pilot teams and sponsors", use: "Compares agreed baseline measures with observed pilot results." },
  { title: "Before-and-after evidence pack", audience: "Security, quality and engineering leadership", use: "Shows repository assessments, adopted controls, exceptions and team feedback." },
  { title: "Control catalog", audience: "Engineering and assurance teams", use: "Defines each control, owner, verification method and honest conformance state." },
  { title: "Decision memo", audience: "Adoption sponsor", use: "Recommends continue, adjust or stop based on evidence—not enthusiasm." },
];

const executiveSummary = "Agent Standard is a six-layer operating model for governed AI-assisted engineering. Layer 1 establishes an immutable, deterministic repository baseline that assesses and adopts supported repositories without silently overwriting project-owned content. Later layers add approved profiles, repository context, explicit precedence, adoption assessment and governed exceptions. The recommended adoption approach is a small representative pilot with baseline measures, transparent evidence and a pre-agreed continue, adjust or stop decision.";

type TabSelectionOptions = { focus?: boolean; scroll?: boolean };
type SelectTab = (id: TabId, options?: TabSelectionOptions) => void;

function TabButton({ id, label, active, onSelect }: { id: TabId; label: string; active: boolean; onSelect: SelectTab }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = tabs.findIndex((tab) => tab.id === id);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    onSelect(tabs[next].id, { focus: true, scroll: false });
  };

  return <button id={`tab-${id}`} className="tab-button" role="tab" aria-selected={active} aria-controls={`panel-${id}`} tabIndex={active ? 0 : -1} onClick={() => onSelect(id)} onKeyDown={handleKeyDown}>{label}</button>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [expandedLayer, setExpandedLayer] = useState(0);
  const [copyState, setCopyState] = useState("Copy executive summary");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (!tabIds.has(hash)) return;

    const frame = window.requestAnimationFrame(() => setActiveTab(hash));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectTab: SelectTab = (id, { focus = false, scroll = true } = {}) => {
    setActiveTab(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) window.requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(executiveSummary);
    setCopyState("Summary copied");
    window.setTimeout(() => setCopyState("Copy executive summary"), 1800);
  };

  return (
    <main>
      <header className="hero">
        <div className="hero-shell">
          <div className="hero-kicker">Enterprise Engineering • Evidence-led adoption brief</div>
          <div className="hero-grid">
            <div>
              <h1>Six-layer enterprise agent architecture</h1>
              <p className="hero-lead">A governed operating model for safer, faster AI-assisted delivery—explained as a system, not a sales pitch.</p>
            </div>
            <aside className="hero-promise" aria-label="Layer 1 promise">
              <span>Layer 1 promise</span>
              <p>An immutable, deterministic repository baseline that can assess and adopt supported repositories without silently overwriting project-owned content.</p>
            </aside>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => selectTab("value")}>Build the value case</button>
            <button className="secondary-action" onClick={copySummary}>{copyState}</button>
            <button className="text-action" onClick={() => window.print()}>Print / save as PDF</button>
          </div>
        </div>
      </header>

      <nav className="tab-rail" aria-label="Architecture brief sections">
        <div className="tab-list" role="tablist" aria-label="Architecture brief">
          {tabs.map((tab) => <TabButton key={tab.id} {...tab} active={activeTab === tab.id} onSelect={selectTab} />)}
        </div>
      </nav>

      <div className="content-shell">
        <section id="panel-system" className="tab-panel" role="tabpanel" aria-labelledby="tab-system" hidden={activeTab !== "system"}>
          <div className="section-heading">
            <div><span className="eyebrow">System context</span><h2>One governed system connects policy, teams, repositories and delivery platforms</h2></div>
            <p>The standard turns approved enterprise direction into repository-level guidance, then produces evidence that teams and leaders can review.</p>
          </div>
          <div className="context-map" aria-label="System context diagram">
            <div className="context-column"><div className="context-label">External users</div><div className="context-box muted-box">Engineering leaders</div><div className="context-box muted-box">Security & governance</div><div className="context-box muted-box">Repository teams</div></div>
            <div className="context-arrow" aria-hidden="true"><span>approved direction</span><b>→</b></div>
            <div className="context-core"><span>Business system</span><strong>Agent<br />Standard</strong><small>approved guidance<br />safe adoption<br />reviewable evidence</small></div>
            <div className="context-arrow" aria-hidden="true"><span>governed content</span><b>→</b></div>
            <div className="context-column compact-column"><div className="context-label">Delivery surface</div><div className="context-box repo-box">Consumer repositories</div></div>
            <div className="context-arrow" aria-hidden="true"><span>usable context</span><b>→</b></div>
            <div className="context-column"><div className="context-label">Third-party services</div><div className="context-box">Coding assistants<small>Codex • Claude • Copilot</small></div><div className="context-box">Delivery platforms<small>GitHub • Azure DevOps</small></div></div>
          </div>
          <div className="flow-strip">
            <div><span>Input</span><strong>Approved guidance</strong><p>Policy, controls and ownership enter through a reviewed baseline.</p></div>
            <div><span>Context</span><strong>Repository knowledge</strong><p>Local business and system facts remain project-owned.</p></div>
            <div><span>Output</span><strong>Conformance evidence</strong><p>Teams can explain what is present, missing or externally controlled.</p></div>
          </div>
          <div className="boundary-note"><strong>Important boundary:</strong> repository or organization settings on delivery platforms remain administrator-owned unless explicitly authorized.</div>
        </section>

        <section id="panel-layers" className="tab-panel" role="tabpanel" aria-labelledby="tab-layers" hidden={activeTab !== "layers"}>
          <div className="section-heading">
            <div><span className="eyebrow">Layered architecture</span><h2>Common control at the foundation; more context and flexibility above it</h2></div>
            <p>Each layer solves a distinct enterprise problem. Teams can begin with Layer 1 and add later layers only when adoption evidence justifies them.</p>
          </div>
          <div className="layer-list">
            {layers.map((layer, index) => {
              const open = expandedLayer === index;
              return <article className={`layer-row ${open ? "is-open" : ""}`} key={layer.number}>
                <button aria-expanded={open} aria-controls={`layer-${index}`} onClick={() => setExpandedLayer(open ? -1 : index)}>
                  <span className="layer-number">{layer.number}</span><span className="layer-title"><strong>{layer.title}</strong><small>{layer.promise}</small></span><span className="layer-toggle" aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                <div id={`layer-${index}`} className="layer-detail" hidden={!open}>
                  <div><span>Purpose</span><p>{layer.purpose}</p></div><div><span>Functionality</span><p>{layer.functionality}</p></div><div><span>Enterprise value</span><p>{layer.value}</p></div>
                  <div className="impact-row" aria-label="Value dimensions">{layer.impacts.map((impact) => <em key={impact}>{impact}</em>)}</div>
                </div>
              </article>;
            })}
          </div>
        </section>

        <section id="panel-capabilities" className="tab-panel" role="tabpanel" aria-labelledby="tab-capabilities" hidden={activeTab !== "capabilities"}>
          <div className="section-heading">
            <div><span className="eyebrow">Business capability map</span><h2>Four capabilities turn the architecture into repeatable business processes</h2></div>
            <p>This view connects architectural layers to the work teams perform and the business result each capability is intended to produce.</p>
          </div>
          <div className="capability-head" aria-hidden="true"><span>Capability</span><span>Business process</span><span>Business result</span></div>
          <div className="capability-list">
            {capabilities.map((capability) => <article className="capability-row" key={capability.title}>
              <div className="capability-name"><strong>{capability.title}</strong><span>{capability.layers}</span></div>
              <div className="process-flow">{capability.process.map((step, index) => <div key={step}><span>{step}</span>{index < capability.process.length - 1 && <b aria-hidden="true">→</b>}</div>)}</div>
              <p className="capability-result">{capability.result}</p>
            </article>)}
          </div>
        </section>

        <section id="panel-workflow" className="tab-panel" role="tabpanel" aria-labelledby="tab-workflow" hidden={activeTab !== "workflow"}>
          <div className="section-heading">
            <div><span className="eyebrow">Adoption workflow</span><h2>Every adoption follows a visible, reviewable path</h2></div>
            <p>Assessment and application are deliberately separated. Teams can understand readiness and risk before deciding whether to change a repository.</p>
          </div>
          <div className="workflow-grid">
            {workflow.map((step, index) => <article className={`workflow-step ${index === 0 || index === workflow.length - 1 ? "bookend" : ""}`} key={step.number}>
              <span>{step.number}</span><strong>{step.title}</strong><p>{step.detail}</p>{index < workflow.length - 1 && <b className="step-arrow" aria-hidden="true">→</b>}
            </article>)}
          </div>
          <div className="decision-gates">
            <article><span>Gate 1</span><strong>Is the repository ready?</strong><p>Assessment can proceed with a dirty working state, but application cannot.</p></article>
            <article><span>Gate 2</span><strong>Are decisions complete?</strong><p>Ownership and architecture context must be known before the standard is applied.</p></article>
            <article><span>Gate 3</span><strong>Is the change still safe?</strong><p>Repository state and content collisions are checked again immediately before application.</p></article>
          </div>
          <div className="four-part-flow"><span>Approved guidance</span><b>+</b><span>Repository-owned context</span><b>+</b><span>Review before mutation</span><b>=</b><span>Conformance evidence</span></div>
        </section>

        <section id="panel-value" className="tab-panel" role="tabpanel" aria-labelledby="tab-value" hidden={activeTab !== "value"}>
          <div className="section-heading">
            <div><span className="eyebrow">Evidence-led value case</span><h2>Demonstrate value with a bounded pilot, not AI enthusiasm</h2></div>
            <p>Frame the project as an engineering control and enablement system. Agree on the questions, evidence and decision rules before the pilot begins.</p>
          </div>
          <div className="pilot-sequence">
            <article><span>01</span><strong>Establish the baseline</strong><p>Record how repositories are assessed, adopted and supported today.</p></article>
            <article><span>02</span><strong>Run a representative pilot</strong><p>Use 4–6 repositories across stacks, providers and greenfield/adoption scenarios.</p></article>
            <article><span>03</span><strong>Make an evidence-based decision</strong><p>Continue, adjust or stop using criteria agreed before the pilot.</p></article>
          </div>
          <h3 className="subsection-title">Questions worth measuring</h3>
          <div className="measure-table" role="table" aria-label="Pilot value measures">
            <div className="measure-header" role="row"><span role="columnheader">Outcome</span><span role="columnheader">Question</span><span role="columnheader">Indicator</span><span role="columnheader">Evidence source</span></div>
            {measures.map((measure) => <div className="measure-row" role="row" key={measure.outcome}><strong role="cell">{measure.outcome}</strong><span role="cell">{measure.question}</span><span role="cell">{measure.indicator}</span><span role="cell">{measure.evidence}</span></div>)}
          </div>
          <div className="value-guidance">
            <article className="criteria-box"><span className="eyebrow">Example pilot gates</span><h3>Define success before results are known</h3><ul><li>No silent overwrite of project-owned content.</li><li>No critical security or quality regression.</li><li>Adoption is faster or clearer than the current process.</li><li>Every unresolved exception has an owner and next action.</li><li>Pilot teams can explain the effective guidance and evidence.</li></ul></article>
            <article className="anti-pitch"><span className="eyebrow">Keep the case credible</span><h3>What not to claim</h3><ul><li>Do not lead with generic productivity percentages.</li><li>Do not attribute every delivery change to AI.</li><li>Do not claim enterprise scale from a single team.</li><li>Do not hide unknown remote controls or pilot friction.</li></ul><p>Use observed workflow evidence, team feedback and control results. Credibility is part of the value.</p></article>
          </div>
        </section>

        <section id="panel-risks" className="tab-panel" role="tabpanel" aria-labelledby="tab-risks" hidden={activeTab !== "risks"}>
          <div className="section-heading">
            <div><span className="eyebrow">Value, dependency and risk</span><h2>The architecture creates value by controlling a small set of dependencies</h2></div>
            <p>Use risks as decision inputs. Each one should have a clear control and an accountable leadership decision.</p>
          </div>
          <div className="risk-head" aria-hidden="true"><span>Business risk</span><span>Critical dependency</span><span>Architectural response</span><span>Leadership decision</span></div>
          <div className="risk-list">{risks.map((item) => <article className="risk-row" key={item.risk}><strong>{item.risk}</strong><p>{item.dependency}</p><p>{item.control}</p><p className="decision-cell">{item.decision}</p></article>)}</div>
          <div className="value-band"><div><strong>Security</strong><span>Consistent trusted controls</span></div><div><strong>Quality</strong><span>Explicit completion evidence</span></div><div><strong>Delivery speed</strong><span>Reusable decisions and automation</span></div><div><strong>Engineering scale</strong><span>Local context without baseline fragmentation</span></div></div>
        </section>

        <section id="panel-presenter" className="tab-panel" role="tabpanel" aria-labelledby="tab-presenter" hidden={activeTab !== "presenter"}>
          <div className="section-heading">
            <div><span className="eyebrow">Presenter kit</span><h2>Use a small evidence pack to build the case over time</h2></div>
            <p>Different stakeholders need different depth. Keep the story consistent while giving each audience the artifact that supports its decision.</p>
          </div>
          <div className="artifact-list">{artifacts.map((artifact, index) => <article className="artifact-row" key={artifact.title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{artifact.title}</strong><p><em>Audience</em>{artifact.audience}</p><p><em>Use</em>{artifact.use}</p></article>)}</div>
          <div className="presenter-grid">
            <article><span className="eyebrow">30-minute walkthrough</span><ol><li><strong>5 min</strong> — The repository adoption problem and Layer 1 promise.</li><li><strong>8 min</strong> — System context, layers and business capabilities.</li><li><strong>7 min</strong> — Safe adoption workflow and boundaries.</li><li><strong>7 min</strong> — Pilot measures, risks and decision gates.</li><li><strong>3 min</strong> — Confirm pilot scope, owners and next decision.</li></ol></article>
            <article className="opening-script"><span className="eyebrow">Suggested opening</span><blockquote>“This is not a proposal to adopt AI everywhere. It is a proposal to make repository-level agent use safer, more consistent and easier to evaluate. We will start with a bounded baseline, test it on representative repositories and use evidence to decide what comes next.”</blockquote></article>
          </div>
          <div className="recommendation-callout"><span>Recommended next move</span><strong>Authorize a small Layer 1 pilot with named repository owners, agreed measures and a scheduled continue / adjust / stop review.</strong></div>
        </section>
      </div>

      <footer><div><strong>Agent Standard</strong><span>Six-layer enterprise architecture</span></div><p>Source basis: architecture, runbook, conformance, release evidence and business architecture documents in the Agent Standard repository.</p></footer>
    </main>
  );
}
