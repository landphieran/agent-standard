#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const root = process.cwd()
const required = [
  'AGENTS.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'copier.yml',
  'template/.agent-standard/manifest.json.jinja',
  'template/.agent-standard/manifest.schema.json',
  'template/.agent-standard/scripts/bootstrap.mjs',
  'template/.agent-standard/scripts/dod.mjs',
  'template/.agent-standard/scripts/doctor.mjs',
  'template/.agent-standard/scripts/merge-config.mjs',
  'template/.agent-standard/scripts/sbom.mjs',
  'template/.agent-standard/scripts/sync-skills.mjs',
  'template/.agent-standard/scripts/verify.mjs',
  'modules/azure-devops/README.md',
  'modules/azure-devops/enterprise-baseline.json',
  'modules/azure-devops/enterprise-baseline.schema.json',
  'modules/azure-devops/templates/agent-standard.yml',
  "template/.agent-standard/platforms/{% if repository_platform == 'azure-devops' %}azure-devops.json{% endif %}.jinja",
  "template/.agent-standard/platforms/{% if repository_platform == 'azure-devops' %}azure-devops.schema.json{% endif %}",
  "template/.agent-standard/evidence/{% if repository_platform == 'azure-devops' %}azure-devops-audit.schema.json{% endif %}",
  "template/.agent-standard/scripts/{% if repository_platform == 'azure-devops' %}audit-azure-devops.mjs{% endif %}",
  "template/.azuredevops/{% if repository_platform == 'azure-devops' %}pull_request_template.md{% endif %}.jinja",
  "template/{% if ci and repository_platform == 'azure-devops' %}azure-pipelines.yml{% endif %}.jinja",
  'template/{{ _copier_conf.answers_file }}.jinja',
  'bin/agent-standard.mjs',
  'scripts/run-render-verifier.mjs',
  'docs/release-evidence-v1.0.0.md',
  'pilot/agent-standard-pilot.ps1',
  'pilot/pilot-settings.psd1',
  'pilot/README.md'
]
const findings = required.filter(path => !existsSync(resolve(root, path))).map(path => `${path} is missing`)
let product
try {
  product = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  if (!/^\d+\.\d+\.\d+$/.test(product.version || '')) findings.push('package.json must contain the canonical stable product version')
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
  if (lock.version !== product.version || lock.packages?.['']?.version !== product.version) findings.push('package-lock.json product version must match package.json')
} catch (error) {
  findings.push(`package metadata is invalid JSON: ${error.message}`)
}

function filesBelow (relative) {
  const directory = resolve(root, relative)
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = `${relative}/${entry.name}`
    return entry.isDirectory() ? filesBelow(child) : [child]
  })
}

let manifest
try {
  manifest = JSON.parse(readFileSync(resolve(root, '.agent-standard/manifest.json'), 'utf8'))
} catch (error) {
  findings.push(`.agent-standard/manifest.json is invalid JSON: ${error.message}`)
}

if (manifest) {
  if (manifest.schemaVersion !== 1 || !['AS-1', 'AS-2', 'AS-3', 'AS-4'].includes(manifest.conformanceLevel)) {
    findings.push('source manifest has an unsupported schema or conformance level')
  }
  if (!manifest.conformance?.target || !manifest.conformance?.status || !manifest.governance?.owners || !manifest.workflow?.profile || !manifest.project?.packageManager || !['github', 'azure-devops'].includes(manifest.platform?.repository)) {
    findings.push('source manifest must declare conformance state, governance ownership, workflow profile, and repository platform')
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) findings.push('source manifest must declare its generated skill catalog')
  if (product && manifest.standardVersion !== product.version) findings.push('source manifest standardVersion must match the canonical package.json version')
  if (manifest.standardRevision !== 'development' && !/^[0-9a-f]{40}$/.test(manifest.standardRevision || '')) {
    findings.push('source manifest standardRevision must be development or a full lowercase commit SHA')
  }
  for (const path of manifest.documents || []) if (!existsSync(resolve(root, path))) findings.push(`manifest document ${path} is missing`)
  for (const skill of manifest.skills || []) {
    if (!existsSync(resolve(root, `template/.ruler/skills/${skill}/SKILL.md`))) findings.push(`manifest skill ${skill} is missing from the template`)
  }
  const bom = manifest.supplyChain?.bom
  if (!bom || !['strict', 'advisory'].includes(bom.mode) || bom.formats?.length !== bom.files?.length) {
    findings.push('source manifest BOM configuration is invalid')
  }
}

const azureAuditPath = "template/.agent-standard/scripts/{% if repository_platform == 'azure-devops' %}audit-azure-devops.mjs{% endif %}"
if (existsSync(resolve(root, azureAuditPath))) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    encoding: 'utf8',
    input: readFileSync(resolve(root, azureAuditPath), 'utf8')
  })
  if (result.status !== 0) findings.push(`${azureAuditPath} has invalid JavaScript: ${(result.stderr || '').trim()}`)
}

for (const path of [
  'bin/agent-standard.mjs',
  'template/.agent-standard/scripts/bootstrap.mjs',
  'template/.agent-standard/scripts/dod.mjs',
  'template/.agent-standard/scripts/doctor.mjs',
  'template/.agent-standard/scripts/merge-config.mjs',
  'template/.agent-standard/scripts/sbom.mjs',
  'template/.agent-standard/scripts/sync-skills.mjs',
  'template/.agent-standard/scripts/verify.mjs',
  'scripts/run-render-verifier.mjs'
]) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, path)], { encoding: 'utf8' })
  if (result.status !== 0) findings.push(`${path} has invalid JavaScript: ${(result.stderr || '').trim()}`)
}

const copier = readFileSync(resolve(root, 'copier.yml'), 'utf8')
const cli = readFileSync(resolve(root, 'bin/agent-standard.mjs'), 'utf8')
const renderVerifier = readFileSync(resolve(root, 'scripts/verify-render.ps1'), 'utf8')
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
const bootstrap = readFileSync(resolve(root, 'template/.agent-standard/scripts/bootstrap.mjs'), 'utf8')
const manifestTemplate = readFileSync(resolve(root, 'template/.agent-standard/manifest.json.jinja'), 'utf8')
const manifestSchema = JSON.parse(readFileSync(resolve(root, 'template/.agent-standard/manifest.schema.json'), 'utf8'))
const conformance = readFileSync(resolve(root, 'docs/conformance.md'), 'utf8')
const azurePipeline = readFileSync(resolve(root, "template/{% if ci and repository_platform == 'azure-devops' %}azure-pipelines.yml{% endif %}.jinja"), 'utf8')
const azureCentralTemplate = readFileSync(resolve(root, 'modules/azure-devops/templates/agent-standard.yml'), 'utf8')
if (!copier.includes('_answers_file: .agent-standard/copier-answers.yml')) findings.push('Copier answers must be namespaced under .agent-standard')
if (!copier.includes('repository_platform:')) findings.push('Copier must expose a repository platform selection')
if (!copier.includes('azure_pipeline_mode:')) findings.push('Copier must expose the Azure Pipeline governance mode')
if (!copier.includes('standard_revision:') || !copier.includes('default: development')) findings.push('Copier must carry the selected standard revision into rendered repositories')
if (!copier.includes('agent-standard update . --ref <FULL_SHA> --dry-run')) findings.push('Update guidance must assess and record the same immutable revision')
if (!cli.includes("copier: '9.17.2'") || !cli.includes("`${tool}==${version}`")) findings.push('CLI Copier execution must use the reviewed exact version')
for (const tool of ['copier==9.17.2', 'check-jsonschema==0.38.0', 'yamllint==1.38.0']) {
  if (!renderVerifier.includes(tool)) findings.push(`Render verification must pin ${tool}`)
}
for (const [variable, module] of [['jsonSchemaTool', 'python -m check_jsonschema'], ['yamlLintTool', 'python -m yamllint']]) {
  if (!renderVerifier.includes(`uv run --no-project --with $${variable} ${module}`)) {
    findings.push(`Render verification must use the Windows-compatible pinned module entry point: ${module}`)
  }
}
if (!readme.includes('npx.cmd --yes "--package=github:landphieran/agent-standard#<FULL_SHA>"')) findings.push('README must provide a PowerShell-safe package invocation')
if (!copier.includes("azure_template_ref | length != 40")) findings.push('Azure Pipeline template refs must require an immutable 40-character commit')
if (product && !manifestTemplate.includes(`"standardVersion": "${product.version}"`)) findings.push('rendered manifest version must match the canonical package.json version')
if (!manifestTemplate.includes('"standardRevision": "{{ standard_revision }}"')) findings.push('rendered manifest must record the selected standard revision')
if (!manifestSchema.required?.includes('standardRevision')) findings.push('manifest schema must require standardRevision')
if (manifestSchema.properties?.schemaVersion?.const !== 1) findings.push('manifest schema version changed without an independently justified schema migration')
for (const control of ['AS-BASE-001', 'AS-ADOPT-001', 'AS-OWN-001', 'AS-RECOVER-001', 'AS-AGENT-001', 'AS-SKILL-001', 'AS-DOC-001', 'AS-QUAL-001', 'AS-QUAL-002', 'AS-SUPPLY-001', 'AS-SUPPLY-002', 'AS-REMOTE-001', 'AS-PROV-001']) {
  if (!conformance.includes(`| ${control} |`)) findings.push(`Layer 1 control catalog is missing stable control ${control}`)
}
if (!bootstrap.includes('--gitignore=false')) findings.push('Ruler must keep generated agent files trackable')
if (!bootstrap.includes('--no-skills')) findings.push('Ruler must not own client skill directories')
if (!bootstrap.includes("'.agent-standard/scripts/sbom.mjs', '--write'")) findings.push('Bootstrap must refresh the configured SBOM')
if (!/@fission-ai\/openspec@\d+\.\d+\.\d+/.test(bootstrap)) findings.push('OpenSpec bootstrap must use an exact version')
if (!/@intellectronica\/ruler@\d+\.\d+\.\d+/.test(bootstrap)) findings.push('Ruler bootstrap must use an exact version')
for (const required of ['pr: none', 'batch: true', 'fetchDepth: 0', 'fetchTags: false', 'persistCredentials: false', 'timeoutInMinutes: 30', 'clean: all', 'node .agent-standard/scripts/verify.mjs', 'node .agent-standard/scripts/dod.mjs --ci --policy-only', 'AdvancedSecurity-Codeql-Init@1', 'WaitForProcessing: true', 'PublishPipelineArtifact@1', 'extends:']) {
  if (!azurePipeline.includes(required)) findings.push(`Azure Pipeline template is missing ${required}`)
}
for (const required of ['parameters:', 'stages:', 'fetchDepth: 0', 'fetchTags: false', 'persistCredentials: false', 'timeoutInMinutes: 30', 'clean: all', 'node .agent-standard/scripts/verify.mjs', 'node .agent-standard/scripts/dod.mjs --ci --policy-only', 'AdvancedSecurity-Codeql-Init@1', 'AdvancedSecurity-Dependency-Scanning@1', 'AdvancedSecurity-Codeql-Analyze@1', 'WaitForProcessing: true', 'PublishPipelineArtifact@1']) {
  if (!azureCentralTemplate.includes(required)) findings.push(`Azure central template is missing ${required}`)
}
if (/\b(?:script|bash|powershell):\s*\$\{\{\s*parameters\./.test(azureCentralTemplate)) findings.push('Azure central template must not interpolate parameters into shell commands')

for (const relative of [
  'template/.agent-standard/manifest.schema.json',
  "template/.agent-standard/platforms/{% if repository_platform == 'azure-devops' %}azure-devops.schema.json{% endif %}",
  "template/.agent-standard/evidence/{% if repository_platform == 'azure-devops' %}azure-devops-audit.schema.json{% endif %}",
  'modules/azure-devops/enterprise-baseline.json',
  'modules/azure-devops/enterprise-baseline.schema.json'
]) {
  try { JSON.parse(readFileSync(resolve(root, relative), 'utf8')) } catch (error) { findings.push(`${relative} is invalid JSON: ${error.message}`) }
}

for (const path of [...filesBelow('.github'), ...filesBelow('template/.github')].filter(path => ['.yml', '.jinja'].includes(extname(path)))) {
  const workflow = readFileSync(resolve(root, path), 'utf8')
  for (const match of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
    if (!/^[a-f0-9]{40}$/.test(match[1])) findings.push(`${path} uses a mutable Action reference: ${match[0]}`)
  }
}

const examples = filesBelow('examples').filter(path => /^examples\/\d+-.+\.yml$/.test(path))
  .map(path => ({ path, text: readFileSync(resolve(root, path), 'utf8') }))
const answer = (example, name, fallback = null) => example.text.match(new RegExp(`^${name}:\\s*([^\\s#]+)\\s*$`, 'm'))?.[1] || fallback
for (const stack of ['ts-node', 'ts-next', 'py-fastapi']) {
  for (const mode of ['greenfield', 'adopt']) {
    if (!examples.some(example => answer(example, 'language_stack') === stack && answer(example, 'mode') === mode)) {
      findings.push(`render matrix is missing ${stack} × ${mode} coverage`)
    }
  }
}
if (!examples.some(example => answer(example, 'repository_platform', 'github') === 'github')) findings.push('render matrix is missing the GitHub provider')
for (const pipelineMode of ['standalone', 'extends']) {
  if (!examples.some(example => answer(example, 'repository_platform', 'github') === 'azure-devops' && answer(example, 'azure_pipeline_mode', 'standalone') === pipelineMode)) {
    findings.push(`render matrix is missing Azure DevOps ${pipelineMode} pipeline coverage`)
  }
}
for (const workflow of ['lightweight', 'spec-driven']) {
  if (!examples.some(example => answer(example, 'workflow_profile', 'lightweight') === workflow)) findings.push(`render matrix is missing ${workflow} workflow coverage`)
}
for (const bom of ['cyclonedx-json', 'spdx-json']) {
  if (!examples.some(example => [answer(example, 'bom_format', 'cyclonedx-json'), 'both'].includes(bom) || answer(example, 'bom_format') === 'both')) {
    findings.push(`render matrix is missing ${bom} SBOM coverage`)
  }
}

for (const path of [...filesBelow('docs'), ...filesBelow('template/docs'), ...filesBelow('template')]
  .filter(path => !path.includes('/node_modules/') && ['.md', '.jinja'].includes(extname(path)))) {
  if (readFileSync(resolve(root, path), 'utf8').includes('agent-standard-0.6.0-dev')) findings.push(`${path} carries a stale product version`)
}

const sbom = spawnSync(process.execPath, [resolve(root, 'template/.agent-standard/scripts/sbom.mjs'), '--check'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, AGENT_STANDARD_ROOT: root }
})
if (sbom.status !== 0) findings.push((sbom.stderr || sbom.stdout || 'root SBOM check failed').trim())

if (findings.length) {
  console.error(`source verification findings:\n- ${findings.join('\n- ')}`)
  process.exitCode = 1
} else console.log('source verification: passed')
