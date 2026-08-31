#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, relative as relativePath, resolve, sep } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const setup = process.argv.includes('--setup')
const findings = []
const note = message => findings.push(message)

function insideRoot (path) {
  const fromRoot = relativePath(root, path)
  return fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
}

function safeRelative (relative) {
  return typeof relative === 'string' && relative.length > 0 && !isAbsolute(relative) && insideRoot(resolve(root, relative))
}

function json (relative) {
  const path = resolve(root, relative)
  if (!existsSync(path)) { note(`${relative} is missing`); return null }
  try { return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) } catch (error) { note(`${relative} is invalid JSON: ${error.message}`); return null }
}

function tracked (relative) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relative], { cwd: root, stdio: 'ignore' })
    return true
  } catch { return false }
}

function checkLinks (documents) {
  for (const relative of documents || []) {
    if (!safeRelative(relative)) continue
    if (!relative.endsWith('.md')) continue
    const path = resolve(root, relative)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0]
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      let decoded
      try { decoded = decodeURIComponent(target) } catch { note(`${relative} has an invalid encoded link ${target}`); continue }
      const destination = resolve(dirname(path), decoded)
      if (!insideRoot(destination)) note(`${relative} links outside the repository: ${target}`)
      else if (!existsSync(destination)) note(`${relative} links to missing ${target}`)
    }
  }
}

function checkSkills (names) {
  for (const name of names || []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) { note(`manifest skill name is invalid: ${name}`); continue }
    const relative = `.ruler/skills/${name}/SKILL.md`
    if (!existsSync(resolve(root, relative))) { note(`${relative} is missing`); continue }
    if (!setup && existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
    const text = readFileSync(resolve(root, relative), 'utf8').replace(/\r\n/g, '\n')
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const closing = text.indexOf('\n---\n', 4)
    const frontmatter = closing >= 0 ? text.slice(0, closing) : ''
    if (!text.startsWith('---\n') || closing < 0 || !new RegExp(`^name: ${escapedName}$`, 'm').test(frontmatter) || !/^description: .+/m.test(frontmatter)) {
      note(`${relative} needs valid name and description frontmatter`)
    }
  }
}

function checkDocumentMetadata (documents) {
  const fields = ['id', 'type', 'status', 'owner', 'scope', 'last_verified', 'verified_against']
  for (const relative of documents || []) {
    if (!safeRelative(relative)) continue
    if (!relative.startsWith('docs/')) continue
    const path = resolve(root, relative)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    if (!text.startsWith('---\n')) { note(`${relative} is missing governance frontmatter`); continue }
    const closing = text.indexOf('\n---\n', 4)
    if (closing < 0) { note(`${relative} has unterminated governance frontmatter`); continue }
    const frontmatter = text.slice(0, closing)
    for (const field of fields) if (!new RegExp(`^${field}:\\s*\\S+`, 'm').test(frontmatter)) note(`${relative} is missing metadata field ${field}`)
  }
}

function checkPropagatedSkills (manifest) {
  const targets = new Set()
  if (manifest.agents?.includes('claude')) targets.add('.claude/skills')
  if (manifest.agents?.includes('codex')) targets.add('.agents/skills')
  if (manifest.agents?.includes('copilot')) targets.add('.github/skills')
  for (const target of targets) {
    for (const name of manifest.skills || []) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) continue
      const canonicalPath = resolve(root, `.ruler/skills/${name}/SKILL.md`)
      if (!existsSync(canonicalPath)) continue
      const relative = `${target}/${name}/SKILL.md`
      if (!existsSync(resolve(root, relative))) note(`${relative} was not propagated by Ruler`)
      else {
        if (!setup && existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
        const canonical = readFileSync(canonicalPath, 'utf8').replace(/\r\n/g, '\n')
        const propagated = readFileSync(resolve(root, relative), 'utf8').replace(/\r\n/g, '\n')
        if (canonical !== propagated) note(`${relative} is out of sync with the canonical skill`)
      }
    }
  }
}

function checkWorkflowArtifacts (manifest) {
  if (manifest.workflow?.profile !== 'spec-driven') return
  const expected = {
    claude: ['.claude/commands/opsx/propose.md', '.claude/skills/openspec-propose/SKILL.md'],
    codex: ['.agents/skills/openspec-propose/SKILL.md'],
    copilot: ['.github/prompts/opsx-propose.prompt.md', '.github/skills/openspec-propose/SKILL.md']
  }
  for (const agent of manifest.agents || []) {
    const candidates = expected[agent] || []
    if (candidates.length && !candidates.some(relative => existsSync(resolve(root, relative)))) {
      note(`${agent} is missing its OpenSpec propose workflow artifact`)
    }
  }
}

function checkToolchain (manifest) {
  const stack = manifest.project?.stack
  const expected = stack === 'py-fastapi' ? 'uv' : 'npm'
  if (manifest.project?.packageManager !== expected) {
    note(`manifest project.packageManager must be ${expected} for ${stack}`)
  }
  const unsupported = stack === 'py-fastapi'
    ? ['poetry.lock', 'pdm.lock', 'Pipfile.lock']
    : ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']
  for (const relative of unsupported) {
    if (existsSync(resolve(root, relative))) note(`${relative} is not supported by the ${expected} minimum-standard toolchain`)
  }
  if (stack !== 'py-fastapi' && existsSync(resolve(root, 'package.json'))) {
    try {
      const declared = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8').replace(/^\uFEFF/, '')).packageManager
      if (declared && !/^npm@/i.test(declared)) note(`package.json declares unsupported package manager ${declared}`)
    } catch { /* dependency manifests are validated by the stack's own command */ }
  }
}

function checkManifest (manifest, gate) {
  const oneOf = (value, values, field) => { if (!values.includes(value)) note(`manifest ${field} is invalid`) }
  const uniqueStrings = (value, field) => {
    if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item) || new Set(value).size !== value.length) {
      note(`manifest ${field} must be a non-empty array of unique strings`)
      return false
    }
    return true
  }

  if (typeof manifest.standardVersion !== 'string' || !manifest.standardVersion) note('manifest standardVersion is required')
  if (manifest.conformanceLevel !== manifest.conformance?.target) note('manifest conformanceLevel must match conformance.target')
  oneOf(manifest.conformance?.localEnforcement, ['strict', 'advisory'], 'conformance.localEnforcement')
  oneOf(manifest.conformance?.remoteEnforcement, ['unverified', 'configured', 'enforced', 'drifted'], 'conformance.remoteEnforcement')
  if (typeof manifest.project?.name !== 'string' || !manifest.project.name) note('manifest project.name is required')
  if (typeof manifest.project?.packageName !== 'string' || !manifest.project.packageName) note('manifest project.packageName is required')
  oneOf(manifest.project?.stack, ['ts-node', 'ts-next', 'py-fastapi'], 'project.stack')
  oneOf(manifest.project?.architecture, ['service-based', 'clean-layered'], 'project.architecture')
  oneOf(manifest.project?.topology, ['single-deployable', 'modular-monolith', 'distributed-services'], 'project.topology')
  oneOf(manifest.project?.mode, ['greenfield', 'adopt'], 'project.mode')
  oneOf(manifest.workflow?.profile, ['lightweight', 'spec-driven'], 'workflow.profile')
  const expectedEngine = manifest.workflow?.profile === 'spec-driven' ? 'openspec' : 'native'
  if (manifest.workflow?.engine !== expectedEngine) note(`manifest workflow.engine must be ${expectedEngine}`)
  oneOf(manifest.platform?.repository, ['github', 'azure-devops'], 'platform.repository')
  const expectedCi = !manifest.qualityGate?.ci
    ? 'none'
    : manifest.platform?.repository === 'azure-devops' ? 'azure-pipelines' : 'github-actions'
  if (manifest.platform?.ci !== expectedCi) note(`manifest platform.ci must be ${expectedCi}`)
  oneOf(manifest.platform?.pipelineMode, ['none', 'standalone', 'extends'], 'platform.pipelineMode')
  const allowedPipelineModes = !manifest.qualityGate?.ci
    ? ['none']
    : manifest.platform?.repository === 'azure-devops' ? ['standalone', 'extends'] : ['standalone']
  if (!allowedPipelineModes.includes(manifest.platform?.pipelineMode)) {
    note(`manifest platform.pipelineMode must be ${allowedPipelineModes.join(' or ')}`)
  }

  if (uniqueStrings(manifest.agents, 'agents')) {
    for (const agent of manifest.agents) oneOf(agent, ['claude', 'codex', 'copilot'], `agent ${agent}`)
  }
  uniqueStrings(manifest.documents, 'documents')
  if (Array.isArray(manifest.documents)) {
    for (const document of manifest.documents) if (!safeRelative(document)) note(`manifest document path is unsafe: ${document}`)
  }
  if (uniqueStrings(manifest.skills, 'skills')) {
    for (const skill of manifest.skills) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill)) note(`manifest skill name is invalid: ${skill}`)
  }
  if (!/^@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?:\s+@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)*$/.test(manifest.governance?.owners || '')) {
    note('manifest governance.owners must contain valid owner aliases')
  }
  for (const name of ['install', 'verify', 'updateBom']) {
    if (typeof manifest.commands?.[name] !== 'string' || !manifest.commands[name].trim()) note(`manifest commands.${name} is required`)
  }
  if (manifest.qualityGate?.mode !== manifest.conformance?.localEnforcement) note('manifest qualityGate.mode must match conformance.localEnforcement')
  if (typeof manifest.qualityGate?.ci !== 'boolean') note('manifest qualityGate.ci must be boolean')
  if (manifest.qualityGate?.waivers !== '.agent-standard/waivers.json') note('manifest qualityGate.waivers must use .agent-standard/waivers.json')
  if (manifest.conformance?.status === 'conformant' && manifest.conformance?.remoteEnforcement !== 'enforced') {
    note('conformant status requires enforced remote controls')
  }
  if (['pending-remote', 'conformant'].includes(manifest.conformance?.status) &&
      (manifest.conformance?.localEnforcement !== 'strict' || manifest.supplyChain?.bom?.mode !== 'strict' || !manifest.qualityGate?.ci)) {
    note(`${manifest.conformance.status} status requires strict local/BOM gates and CI`)
  }
  oneOf(manifest.supplyChain?.securityProfile, ['baseline', 'hardened'], 'supplyChain.securityProfile')
  if (typeof manifest.supplyChain?.releaseAttestations !== 'boolean') note('manifest supplyChain.releaseAttestations must be boolean')
  if (manifest.supplyChain?.securityProfile === 'hardened' && !manifest.qualityGate?.ci) note('the hardened security profile requires CI')
  if (manifest.supplyChain?.releaseAttestations && !manifest.qualityGate?.ci) note('release attestations require CI')
  if (manifest.supplyChain?.releaseAttestations && manifest.platform?.repository === 'azure-devops') {
    note('release attestations are not implemented by the minimum Azure DevOps adapter')
  }
  oneOf(manifest.supplyChain?.bom?.mode, ['strict', 'advisory'], 'supplyChain.bom.mode')
  if (uniqueStrings(manifest.supplyChain?.bom?.formats, 'supplyChain.bom.formats')) {
    for (const format of manifest.supplyChain.bom.formats) oneOf(format, ['cyclonedx-json', 'spdx-json'], `BOM format ${format}`)
  }
  if (uniqueStrings(manifest.supplyChain?.bom?.files, 'supplyChain.bom.files') &&
      manifest.supplyChain.bom.files.length !== manifest.supplyChain.bom.formats?.length) {
    note('manifest BOM formats and files must have the same length')
  }
  if (gate) {
    if (gate.mode !== manifest.qualityGate?.mode) note('gate mode does not match the manifest quality gate')
    if (Boolean(gate.openspec) !== (manifest.workflow?.profile === 'spec-driven')) note('gate OpenSpec setting does not match the workflow profile')
    if (gate.waiversFile !== manifest.qualityGate?.waivers) note('gate waiver path does not match the manifest')
    for (const name of ['doctorCommand', 'unitCommand', 'fullCommand']) {
      if (typeof gate[name] !== 'string' || !gate[name].trim()) note(`gate ${name} is required`)
    }
  }
}

function checkManagedConfiguration (manifest) {
  const owner = manifest.governance?.owners

  if (manifest.agents?.includes('claude') && existsSync(resolve(root, '.claude/settings.json'))) {
    try {
      const settings = JSON.parse(readFileSync(resolve(root, '.claude/settings.json'), 'utf8').replace(/^\uFEFF/, ''))
      const groups = settings.hooks?.Stop
      const present = Array.isArray(groups) && groups.some(group => Array.isArray(group?.hooks) &&
        group.hooks.some(hook => hook?.type === 'command' && hook.command === 'node .agent-standard/scripts/dod.mjs'))
      if (!present) note('.claude/settings.json is missing the managed Definition-of-Done hook')
    } catch (error) { note(`.claude/settings.json is invalid JSON: ${error.message}`) }
  }

  if (manifest.platform?.repository === 'github') {
    const codeownersPath = resolve(root, '.github/CODEOWNERS')
    if (existsSync(codeownersPath)) {
      const text = readFileSync(codeownersPath, 'utf8').replace(/^\uFEFF/, '')
      if (!text.includes('# agent-standard:start') || !text.includes('# agent-standard:end')) note('CODEOWNERS is missing the managed agent-standard block')
      for (const pattern of ['/.github/workflows/', '/.agent-standard/', '/.ruler/', '/AGENTS.md', '/SECURITY.md']) {
        if (!text.split(/\r?\n/).some(line => line.startsWith(`${pattern} `) && line.includes(owner))) note(`CODEOWNERS is missing managed ownership for ${pattern}`)
      }
    }

    if (!setup && existsSync(resolve(root, '.github/dependabot.yml'))) {
      const text = readFileSync(resolve(root, '.github/dependabot.yml'), 'utf8')
      const hasEcosystem = ecosystem => new RegExp(`package-ecosystem:\\s*["']?${ecosystem}["']?`).test(text)
      if (!hasEcosystem('github-actions')) note('Dependabot must update GitHub Actions')
      const expected = manifest.project?.packageManager === 'uv' ? 'pip' : 'npm'
      if (!hasEcosystem(expected)) note(`Dependabot must update the ${expected} ecosystem`)
    }

    const pullRequestPath = resolve(root, '.github/pull_request_template.md')
    if (existsSync(pullRequestPath)) {
      const text = readFileSync(pullRequestPath, 'utf8')
      if (!text.includes('<!-- agent-standard:start -->') || !text.includes('<!-- agent-standard:end -->')) {
        note('pull request template is missing the managed agent-standard checklist')
      }
    }

    const workflows = [
      ...(manifest.qualityGate?.ci ? ['dod.yml', 'dependency-review.yml'] : []),
      ...(manifest.qualityGate?.ci && manifest.supplyChain?.securityProfile === 'hardened' ? ['codeql.yml'] : []),
      ...(manifest.supplyChain?.releaseAttestations ? ['release-attest.yml'] : [])
    ]
    for (const name of workflows) {
      const path = resolve(root, '.github/workflows', name)
      if (!existsSync(path)) continue
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
        if (!/^[a-f0-9]{40}$/.test(match[1])) note(`.github/workflows/${name} uses a mutable Action reference: ${match[0]}`)
      }
    }
    return
  }

  if (manifest.platform?.repository !== 'azure-devops') return
  const adapter = json('.agent-standard/platforms/azure-devops.json')
  if (adapter) {
    if (adapter.$schema !== './azure-devops.schema.json') note('Azure DevOps adapter must reference its committed schema')
    if (adapter.schemaVersion !== 1) note('Azure DevOps adapter schemaVersion must be 1')
    if (adapter.service !== 'azure-devops-services') note('Azure DevOps adapter service must be azure-devops-services')
    if (typeof adapter.defaultBranch !== 'string' || !adapter.defaultBranch || adapter.defaultBranch.startsWith('/') || adapter.defaultBranch.startsWith('-') || adapter.defaultBranch.endsWith('/') || /[\s~^:\\]/.test(adapter.defaultBranch) || adapter.defaultBranch.includes('..')) {
      note('Azure DevOps adapter defaultBranch is invalid')
    }
    const aliases = owner?.split(/\s+/).filter(Boolean) || []
    if (!Array.isArray(adapter.ownership?.aliases) || adapter.ownership.aliases.join('\n') !== aliases.join('\n')) {
      note('Azure DevOps adapter ownership aliases must match manifest governance.owners')
    }
    if (!Array.isArray(adapter.ownership?.requiredReviewerIds) ||
        adapter.ownership.requiredReviewerIds.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) ||
        new Set(adapter.ownership?.requiredReviewerIds || []).size !== adapter.ownership?.requiredReviewerIds?.length) {
      note('Azure DevOps adapter requiredReviewerIds must be a unique array of Azure identity UUIDs')
    }
    if (adapter.pipeline?.mode !== manifest.platform.pipelineMode) note('Azure DevOps adapter pipeline mode does not match the manifest')
    if (adapter.pipeline?.path !== 'azure-pipelines.yml') note('Azure DevOps adapter pipeline path must be azure-pipelines.yml')
    if (adapter.pipeline?.definitionId !== null && (!Number.isInteger(adapter.pipeline?.definitionId) || adapter.pipeline.definitionId < 1)) {
      note('Azure DevOps adapter pipeline definitionId must be null before creation or a positive integer')
    }
    if (adapter.pipeline?.mode === 'extends') {
      const template = adapter.pipeline.template
      if (!template || !/^[^/:\\]+\/[^/:\\]+$/.test(template.repository || '') || !/^[a-f0-9]{40}$/.test(template.ref || '') || /^0{40}$/.test(template.ref) ||
          typeof template.path !== 'string' || template.path.startsWith('/') || template.path.includes('..') || template.path.includes('\\') || !/\.ya?ml$/.test(template.path)) {
        note('Azure DevOps extends mode requires safe template coordinates and an immutable 40-character ref')
      }
    } else if (adapter.pipeline?.template !== null) note('Azure DevOps adapter template must be null outside extends mode')
    const policies = adapter.branchPolicies || {}
    if (!Number.isInteger(policies.minimumReviewers) || policies.minimumReviewers < 1) note('Azure DevOps requires at least one reviewer')
    if (policies.creatorVoteCounts !== false) note('Azure DevOps must not count the creator vote')
    if (policies.allowDownvotes !== false) note('Azure DevOps must not allow completion while reviewers reject or wait')
    if (policies.resetVotesOnPush !== true) note('Azure DevOps must reset reviewer votes on new pushes')
    if (policies.requireDesignatedReviewers !== true) note('Azure DevOps must require a designated owner or security reviewer')
    if (policies.requireLinkedWorkItems !== true) note('Azure DevOps must require linked work items')
    if (policies.requireCommentResolution !== true) note('Azure DevOps must require comment resolution')
    if (policies.buildValidation?.required !== Boolean(manifest.qualityGate?.ci)) note('Azure DevOps build validation policy must match CI enablement')
    if (policies.buildValidation?.manualQueueOnly !== false || policies.buildValidation?.queueOnSourceUpdateOnly !== false || policies.buildValidation?.validDurationMinutes !== 0) {
      note('Azure DevOps build validation must queue automatically and expire immediately after protected-branch changes')
    }
    const statusCheck = policies.securityStatusCheck
    if (statusCheck?.required !== Boolean(manifest.qualityGate?.ci) || statusCheck?.genre !== 'AdvancedSecurity' ||
        !['NewHighAndCritical', 'AllHighAndCritical'].includes(statusCheck?.name) ||
        statusCheck?.invalidateOnSourceUpdate !== true || statusCheck?.applicability !== 'default') {
      note('Azure DevOps must require an Advanced Security high/critical status check with safe defaults')
    }
    const hardened = manifest.supplyChain?.securityProfile === 'hardened'
    const expectedSecurity = {
      codeSecurity: Boolean(manifest.qualityGate?.ci),
      dependencyScanning: Boolean(manifest.qualityGate?.ci),
      codeql: hardened,
      secretProtection: hardened,
      secretPushProtection: hardened
    }
    for (const [feature, required] of Object.entries(expectedSecurity)) {
      if (adapter.advancedSecurity?.[feature] !== required) note(`Azure DevOps ${feature} must match the CI/security profile`)
    }
  }

  const pullRequestPath = resolve(root, '.azuredevops/pull_request_template.md')
  if (existsSync(pullRequestPath)) {
    const text = readFileSync(pullRequestPath, 'utf8')
    if (!text.includes('<!-- agent-standard:start -->') || !text.includes('<!-- agent-standard:end -->')) {
      note('Azure DevOps pull request template is missing the managed agent-standard checklist')
    }
  }

  const pipelinePath = resolve(root, 'azure-pipelines.yml')
  if (!manifest.qualityGate?.ci || !existsSync(pipelinePath) || (setup && manifest.project?.mode === 'adopt')) return
  const pipeline = readFileSync(pipelinePath, 'utf8')
  if (!/^pr:\s*none\s*$/m.test(pipeline)) note('azure-pipelines.yml must disable unsupported Azure Repos YAML PR triggers')
  if (!/^\s*batch:\s*true\s*$/m.test(pipeline)) note('azure-pipelines.yml must batch protected-branch CI updates')
  if (manifest.platform.pipelineMode === 'standalone') {
    for (const required of [
      'fetchDepth: 0',
      'fetchTags: false',
      'persistCredentials: false',
      'timeoutInMinutes: 30',
      'clean: all',
      'node .agent-standard/scripts/verify.mjs',
      'node .agent-standard/scripts/dod.mjs --ci --policy-only',
      'DOD_BASE: HEAD^1',
      'version: 22.x'
    ]) if (!pipeline.includes(required)) note(`azure-pipelines.yml is missing ${required}`)
    for (const relative of manifest.supplyChain?.bom?.files || []) {
      if (!pipeline.includes(`targetPath: ${relative}`)) note(`azure-pipelines.yml does not publish ${relative}`)
    }
    if (!pipeline.includes('AdvancedSecurity-Dependency-Scanning@1')) note('azure-pipelines.yml is missing AdvancedSecurity-Dependency-Scanning@1')
    if (manifest.supplyChain?.securityProfile === 'hardened') {
      for (const task of ['AdvancedSecurity-Codeql-Init@1', 'AdvancedSecurity-Codeql-Analyze@1']) {
        if (!pipeline.includes(task)) note(`azure-pipelines.yml is missing ${task}`)
      }
      if (!/AdvancedSecurity-Codeql-Analyze@1[\s\S]*?WaitForProcessing:\s*true/.test(pipeline)) {
        note('azure-pipelines.yml must wait for Advanced Security CodeQL result processing')
      }
    }
  } else if (manifest.platform.pipelineMode === 'extends' && adapter) {
    const template = adapter.pipeline?.template
    if (template && typeof template.repository === 'string' && typeof template.path === 'string' && /^[a-f0-9]{40}$/.test(template.ref || '') && !/^0{40}$/.test(template.ref)) {
      for (const required of ['extends:', template.repository, template.ref, `${template.path}@agent_standard_templates`]) {
        if (!pipeline.includes(required)) note(`azure-pipelines.yml is missing extends contract value ${required}`)
      }
    }
  }
}

function checkGateCommands (manifest, gate) {
  // The rendered gate references npm scripts that only exist in a greenfield
  // package.json. On adoption the team must map them to the repository's real
  // commands; catch a missed mapping with an actionable message instead of npm's
  // opaque "Missing script" at first verify/CI. Deferred to a setup advisory so
  // it never fails the initial bootstrap, then enforced by normal verification.
  if (!gate) return
  const packagePath = resolve(root, 'package.json')
  if (!existsSync(packagePath)) return
  let scripts
  try { const text = readFileSync(packagePath, 'utf8'); scripts = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).scripts || {} } catch { return }
  const deferred = setup && manifest.project?.mode === 'adopt'
  for (const key of ['unitCommand', 'fullCommand']) {
    const command = gate[key]
    if (typeof command !== 'string') continue
    for (const match of command.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
      const script = match[1]
      if (script in scripts) continue
      const message = `gate.${key} runs \`npm run ${script}\`, but package.json defines no ${script} script; map .agent-standard/gate.json to this repository's real command`
      if (deferred) console.warn(`[agent-standard setup] ${message}.`)
      else note(`${message}.`)
    }
  }
}

function checkOrphanSkills (manifest) {
  // sync-skills prunes stale copies, but a repository can drift if it was not
  // re-run after a skill was removed or renamed. Flag any copy this standard
  // previously placed that is no longer a current skill.
  const path = resolve(root, '.agent-standard/managed-skills.json')
  if (!existsSync(path)) return
  let tracker
  try { const text = readFileSync(path, 'utf8'); tracker = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) } catch { note('.agent-standard/managed-skills.json is invalid JSON'); return }
  // Orphan condition mirrors sync-skills' own prune: recorded, still on disk, and
  // no longer a source skill. Union the manifest with the actual .ruler/skills
  // listing so a team-added skill that is not yet declared is never mis-flagged.
  const current = new Set(manifest.skills || [])
  const source = resolve(root, '.ruler/skills')
  if (existsSync(source)) {
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(resolve(source, entry.name, 'SKILL.md'))) current.add(entry.name)
    }
  }
  const knownTargets = ['.claude/skills', '.agents/skills', '.github/skills']
  for (const target of tracker.targets || []) {
    if (!knownTargets.includes(target)) continue
    for (const name of tracker.skills || []) {
      const relative = `${target}/${name}/SKILL.md`
      if (!current.has(name) && existsSync(resolve(root, relative))) {
        note(`${relative} is an orphaned standard skill; run .agent-standard/scripts/sync-skills.mjs to prune it`)
      }
    }
  }
}

function main () {
  const manifest = json('.agent-standard/manifest.json')
  if (!manifest) return 1
  const gate = json('.agent-standard/gate.json')
  if (manifest.schemaVersion !== 1) note('manifest schemaVersion must be 1')
  const targetLevel = manifest.conformance?.target || manifest.conformanceLevel
  if (!['AS-1', 'AS-2', 'AS-3', 'AS-4'].includes(targetLevel)) note('manifest conformance target is invalid')
  if (!['adopting', 'pending-remote', 'conformant', 'drifted'].includes(manifest.conformance?.status)) note('manifest conformance status is invalid')
  checkManifest(manifest, gate)
  const required = [
    'AGENTS.md', '.agent-standard/manifest.schema.json', '.agent-standard/gate.json', '.agent-standard/waivers.json',
    '.agent-standard/scripts/doctor.mjs', '.agent-standard/scripts/dod.mjs', '.agent-standard/scripts/verify.mjs',
    '.agent-standard/scripts/merge-config.mjs', '.agent-standard/scripts/sbom.mjs', '.agent-standard/scripts/sync-skills.mjs',
    '.agent-standard/copier-answers.yml',
    ...(Array.isArray(manifest.documents) ? manifest.documents.filter(safeRelative) : [])
  ]
  if (manifest.platform?.repository === 'github') {
    required.push('.github/CODEOWNERS', '.github/dependabot.yml', '.github/pull_request_template.md')
    if (manifest.qualityGate?.ci) required.push('.github/workflows/dod.yml', '.github/workflows/dependency-review.yml')
    if (manifest.qualityGate?.ci && manifest.supplyChain?.securityProfile === 'hardened') required.push('.github/workflows/codeql.yml')
    if (manifest.supplyChain?.releaseAttestations) required.push('.github/workflows/release-attest.yml')
  } else if (manifest.platform?.repository === 'azure-devops') {
    required.push(
      '.agent-standard/platforms/azure-devops.json',
      '.agent-standard/platforms/azure-devops.schema.json',
      '.agent-standard/evidence/azure-devops-audit.schema.json',
      '.agent-standard/scripts/audit-azure-devops.mjs',
      '.azuredevops/pull_request_template.md'
    )
    if (manifest.qualityGate?.ci) required.push('azure-pipelines.yml')
  }
  if (manifest.agents?.includes('claude')) required.push('CLAUDE.md', '.claude/settings.json')
  if (!setup) required.push(manifest.project?.packageManager === 'uv' ? 'uv.lock' : 'package-lock.json')
  for (const relative of new Set(required)) {
    if (!existsSync(resolve(root, relative))) note(`${relative} is missing`)
    else if (!setup && existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
  }
  checkSkills(manifest.skills)
  checkPropagatedSkills(manifest)
  checkOrphanSkills(manifest)
  checkWorkflowArtifacts(manifest)
  checkToolchain(manifest)
  checkManagedConfiguration(manifest)
  checkGateCommands(manifest, gate)
  // Existing governed documents are deliberately preserved during adoption.
  // Bootstrap may therefore complete before a team adds standard metadata or
  // repairs legacy links; the normal verification command still enforces both.
  if (!setup || manifest.project?.mode !== 'adopt') {
    checkDocumentMetadata(manifest.documents)
    checkLinks(manifest.documents)
  }
  const sbom = spawnSync(process.execPath, [resolve(root, '.agent-standard/scripts/sbom.mjs'), '--check'], { cwd: root, encoding: 'utf8' })
  if (sbom.status !== 0) note((sbom.stderr || sbom.stdout || 'SBOM check failed').trim())

  const result = {
    ok: findings.length === 0,
    targetLevel,
    status: manifest.conformance?.status,
    localEnforcement: manifest.conformance?.localEnforcement,
    remoteEnforcement: manifest.conformance?.remoteEnforcement,
    findings
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else if (result.ok) console.log(`agent-standard doctor: local controls pass; target ${targetLevel}; status ${result.status}; remote ${result.remoteEnforcement}`)
  else console.error(`agent-standard doctor findings:\n- ${findings.join('\n- ')}`)
  return result.ok ? 0 : 1
}

process.exitCode = main()
