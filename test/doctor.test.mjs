import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCTOR = join(REPO, 'template', '.agent-standard', 'scripts', 'doctor.mjs')
const SBOM = join(REPO, 'template', '.agent-standard', 'scripts', 'sbom.mjs')
const write = (root, relative, body = '') => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function manifest (workflow = 'lightweight') {
  return {
    schemaVersion: 1,
    standardVersion: 'test',
    conformanceLevel: 'AS-3',
    conformance: {
      target: 'AS-3',
      status: 'pending-remote',
      localEnforcement: 'strict',
      remoteEnforcement: 'unverified'
    },
    project: {
      name: 'fixture', packageName: 'fixture', stack: 'ts-node', packageManager: 'npm',
      architecture: 'service-based', topology: 'single-deployable', mode: 'greenfield'
    },
    platform: { repository: 'github', ci: 'github-actions', pipelineMode: 'standalone' },
    governance: { owners: '@example/platform' },
    agents: ['codex'],
    workflow: { profile: workflow, engine: workflow === 'spec-driven' ? 'openspec' : 'native' },
    commands: { install: 'npm install', verify: 'node verify.mjs', updateBom: 'node sbom.mjs' },
    documents: ['README.md'],
    skills: ['example'],
    qualityGate: { mode: 'strict', ci: true, waivers: '.agent-standard/waivers.json' },
    supplyChain: {
      securityProfile: 'baseline',
      releaseAttestations: false,
      bom: { mode: 'strict', formats: ['cyclonedx-json'], files: ['bom.cdx.json'] }
    }
  }
}

function fixture (workflow = 'lightweight') {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-doctor-'))
  write(root, '.agent-standard/manifest.json', JSON.stringify(manifest(workflow)))
  write(root, '.agent-standard/manifest.schema.json', '{}')
  write(root, '.agent-standard/gate.json', JSON.stringify({
    mode: 'strict',
    waiversFile: '.agent-standard/waivers.json',
    openspec: workflow === 'spec-driven',
    doctorCommand: 'node .agent-standard/scripts/doctor.mjs',
    unitCommand: 'npm test',
    fullCommand: 'npm test'
  }))
  write(root, '.agent-standard/waivers.json', '{}')
  for (const name of ['doctor.mjs', 'dod.mjs', 'verify.mjs', 'merge-config.mjs', 'sync-skills.mjs']) {
    write(root, `.agent-standard/scripts/${name}`, '')
  }
  mkdirSync(join(root, '.agent-standard', 'scripts'), { recursive: true })
  copyFileSync(SBOM, join(root, '.agent-standard', 'scripts', 'sbom.mjs'))
  write(root, 'AGENTS.md', '# fixture\n')
  write(root, 'README.md', '# fixture\n')
  write(root, '.agent-standard/copier-answers.yml', '_src_path: fixture\n')
  write(root, '.github/CODEOWNERS', [
    '# agent-standard:start',
    '/.github/workflows/ @example/platform',
    '/.agent-standard/ @example/platform',
    '/.ruler/ @example/platform',
    '/AGENTS.md @example/platform',
    '/SECURITY.md @example/platform',
    '# agent-standard:end',
    ''
  ].join('\n'))
  write(root, '.github/dependabot.yml', [
    'version: 2',
    'updates:',
    '  - package-ecosystem: github-actions',
    '    directory: /',
    '  - package-ecosystem: npm',
    '    directory: /',
    ''
  ].join('\n'))
  write(root, '.github/pull_request_template.md', [
    '<!-- agent-standard:start -->',
    '## Agent-standard checks',
    '<!-- agent-standard:end -->',
    ''
  ].join('\n'))
  write(root, '.github/workflows/dod.yml', 'name: dod\n')
  write(root, '.github/workflows/dependency-review.yml', 'name: dependency-review\n')
  write(root, '.ruler/skills/example/SKILL.md', '---\nname: example\ndescription: Example fixture skill.\n---\n')
  write(root, '.agents/skills/example/SKILL.md', '---\nname: example\ndescription: Example fixture skill.\n---\n')
  write(root, 'bom.cdx.json', JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.7', version: 1, components: [] }))
  return root
}

function runDoctor (root, ...args) {
  return spawnSync(process.execPath, [DOCTOR, '--json', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, AGENT_STANDARD_ROOT: root }
  })
}

function azureFixture () {
  const root = fixture()
  const azureManifest = manifest()
  azureManifest.platform = { repository: 'azure-devops', ci: 'azure-pipelines', pipelineMode: 'standalone' }
  write(root, '.agent-standard/manifest.json', JSON.stringify(azureManifest))
  write(root, '.agent-standard/platforms/azure-devops.schema.json', '{}')
  write(root, '.agent-standard/evidence/azure-devops-audit.schema.json', '{}')
  write(root, '.agent-standard/platforms/azure-devops.json', JSON.stringify({
    $schema: './azure-devops.schema.json',
    schemaVersion: 1,
    service: 'azure-devops-services',
    defaultBranch: 'main',
    pipeline: { mode: 'standalone', path: 'azure-pipelines.yml', definitionId: null, template: null },
    ownership: { aliases: ['@example/platform'], requiredReviewerIds: [] },
    branchPolicies: {
      minimumReviewers: 1,
      creatorVoteCounts: false,
      allowDownvotes: false,
      resetVotesOnPush: true,
      requireDesignatedReviewers: true,
      requireLinkedWorkItems: true,
      requireCommentResolution: true,
      buildValidation: { required: true, manualQueueOnly: false, queueOnSourceUpdateOnly: false, validDurationMinutes: 0 },
      securityStatusCheck: {
        required: true,
        genre: 'AdvancedSecurity',
        name: 'NewHighAndCritical',
        invalidateOnSourceUpdate: true,
        applicability: 'default'
      }
    },
    advancedSecurity: {
      codeSecurity: true,
      dependencyScanning: true,
      codeql: false,
      secretProtection: false,
      secretPushProtection: false
    }
  }))
  write(root, '.agent-standard/scripts/audit-azure-devops.mjs', '')
  write(root, '.azuredevops/pull_request_template.md', '<!-- agent-standard:start -->\n## Agent-standard checks\n<!-- agent-standard:end -->\n')
  write(root, 'azure-pipelines.yml', [
    'trigger:',
    '  batch: true',
    'pr: none',
    'jobs:',
    '  - job: verify',
    '    timeoutInMinutes: 30',
    '    workspace:',
    '      clean: all',
    '    steps:',
    '      - checkout: self',
    '        fetchDepth: 0',
    '        fetchTags: false',
    '        persistCredentials: false',
    '      - script: node .agent-standard/scripts/verify.mjs',
    '      - script: node .agent-standard/scripts/dod.mjs --ci --policy-only',
    '        env:',
    '          DOD_BASE: HEAD^1',
    '      - task: UseNode@1',
    '        inputs:',
    '          version: 22.x',
    '      - task: AdvancedSecurity-Dependency-Scanning@1',
    '      - task: PublishPipelineArtifact@1',
    '        inputs:',
    '          targetPath: bom.cdx.json',
    ''
  ].join('\n'))
  return root
}

test('setup validation permits generated files before the first commit', t => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  execFileSync('git', ['init', '-q'], { cwd: root })

  const setup = runDoctor(root, '--setup')
  assert.equal(setup.status, 0, `${setup.stderr}\n${setup.stdout}`)
  const normal = runDoctor(root)
  assert.equal(normal.status, 1)
  assert.match(normal.stdout, /is not tracked by git/)
})

test('adoption setup preserves legacy governed docs and defers normalization to full verification', t => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const adopted = manifest()
  adopted.project.mode = 'adopt'
  adopted.conformance.status = 'adopting'
  adopted.documents.push('docs/testing.md')
  write(root, '.agent-standard/manifest.json', JSON.stringify(adopted))
  write(root, 'docs/testing.md', '# Existing testing guide without standard frontmatter\n')

  const setup = runDoctor(root, '--setup')
  assert.equal(setup.status, 0, `${setup.stderr}\n${setup.stdout}`)
  const normal = runDoctor(root)
  assert.equal(normal.status, 1)
  assert.match(normal.stdout, /docs\/testing\.md is missing governance frontmatter/)
})

test('adoption defers, then enforces, gate commands whose npm scripts are absent', t => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const adopted = manifest()
  adopted.project.mode = 'adopt'
  adopted.conformance.status = 'adopting'
  write(root, '.agent-standard/manifest.json', JSON.stringify(adopted))
  write(root, '.agent-standard/gate.json', JSON.stringify({
    mode: 'strict',
    waiversFile: '.agent-standard/waivers.json',
    openspec: false,
    doctorCommand: 'node .agent-standard/scripts/doctor.mjs',
    unitCommand: 'npm run test:unit',
    fullCommand: 'npm run verify:code'
  }))
  write(root, 'package.json', JSON.stringify({ name: 'legacy', scripts: { build: 'tsc' } }))

  // Setup: an actionable advisory on stderr, but bootstrap is not failed.
  const setup = runDoctor(root, '--setup')
  assert.equal(setup.status, 0, `${setup.stderr}\n${setup.stdout}`)
  assert.match(setup.stderr, /\[agent-standard setup\][\s\S]*npm run test:unit/)

  // Normal verification: the unmapped command becomes a blocking finding.
  const normal = runDoctor(root)
  assert.equal(normal.status, 1)
  assert.match(normal.stdout, /gate\.unitCommand runs[\s\S]*npm run test:unit/)
})

test('doctor flags a managed skill copy left behind after removal, but not a team-added skill', t => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))

  // Tracker records a skill no longer in .ruler/skills whose copy still exists.
  write(root, '.agent-standard/managed-skills.json', JSON.stringify({ skills: ['example', 'gone'], targets: ['.agents/skills'] }))
  write(root, '.agents/skills/gone/SKILL.md', '---\nname: gone\ndescription: Removed skill.\n---\n')
  const stale = runDoctor(root, '--setup')
  assert.equal(stale.status, 1)
  assert.match(stale.stdout, /\.agents\/skills\/gone\/SKILL\.md is an orphaned standard skill/)

  // A skill present in source (even if not in manifest.skills) is not an orphan.
  write(root, '.agent-standard/managed-skills.json', JSON.stringify({ skills: ['example', 'custom'], targets: ['.agents/skills'] }))
  write(root, '.ruler/skills/custom/SKILL.md', '---\nname: custom\ndescription: Team skill.\n---\n')
  write(root, '.agents/skills/custom/SKILL.md', '---\nname: custom\ndescription: Team skill.\n---\n')
  rmSync(join(root, '.agents/skills/gone'), { recursive: true, force: true })
  const clean = runDoctor(root, '--setup')
  assert.equal(clean.status, 0, `${clean.stderr}\n${clean.stdout}`)
})

test('spec-driven validation requires an OpenSpec artifact for each selected client', t => {
  const root = fixture('spec-driven')
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const missing = runDoctor(root, '--setup')
  assert.equal(missing.status, 1)
  assert.match(missing.stdout, /codex is missing its OpenSpec propose workflow artifact/)

  write(root, '.agents/skills/openspec-propose/SKILL.md', '# propose\n')
  const complete = runDoctor(root, '--setup')
  assert.equal(complete.status, 0, `${complete.stderr}\n${complete.stdout}`)
  assert.doesNotMatch(complete.stdout, /AS-3 conformant/i)
  assert.deepEqual(JSON.parse(complete.stdout), {
    ok: true,
    targetLevel: 'AS-3',
    status: 'pending-remote',
    localEnforcement: 'strict',
    remoteEnforcement: 'unverified',
    findings: []
  })
})

test('Azure DevOps setup validates the adapter and standalone pipeline contract', t => {
  const root = azureFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const complete = runDoctor(root, '--setup')
  assert.equal(complete.status, 0, `${complete.stderr}\n${complete.stdout}`)

  write(root, 'azure-pipelines.yml', 'steps:\n  - script: node .agent-standard/scripts/verify.mjs\n')
  const incomplete = runDoctor(root, '--setup')
  assert.equal(incomplete.status, 1)
  assert.match(incomplete.stdout, /must disable unsupported Azure Repos YAML PR triggers/)
})
