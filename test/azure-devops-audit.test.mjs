import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(REPO, 'template', '.agent-standard', 'scripts', "{% if repository_platform == 'azure-devops' %}audit-azure-devops.mjs{% endif %}")

async function loadEvaluator (t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-azure-audit-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const modulePath = join(root, 'audit-azure-devops.mjs')
  writeFileSync(modulePath, readFileSync(SOURCE, 'utf8'))
  return import(`${pathToFileURL(modulePath).href}?fixture=${Date.now()}`)
}

const config = {
  pipeline: { definitionId: 42 },
  ownership: { requiredReviewerIds: ['00000000-0000-0000-0000-000000000001'] },
  branchPolicies: {
    minimumReviewers: 2,
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
    codeql: true,
    secretProtection: true,
    secretPushProtection: true
  }
}

const policies = [
  {
    type: { displayName: 'Minimum number of reviewers' },
    isEnabled: true,
    isBlocking: true,
    settings: { minimumApproverCount: 2, creatorVoteCounts: false, allowDownvotes: false, resetOnSourcePush: true }
  },
  {
    type: { displayName: 'Required reviewers' },
    isEnabled: true,
    isBlocking: true,
    settings: { requiredReviewerIds: ['00000000-0000-0000-0000-000000000001'] }
  },
  { type: { displayName: 'Work item linking' }, isEnabled: true, isBlocking: true, settings: {} },
  { type: { displayName: 'Comment requirements' }, isEnabled: true, isBlocking: true, settings: {} },
  {
    type: { displayName: 'Build validation' },
    isEnabled: true,
    isBlocking: true,
    settings: { buildDefinitionId: 42, manualQueueOnly: false, queueOnSourceUpdateOnly: false, validDuration: 0 }
  },
  {
    type: { id: 'cbdc66da-9728-4af8-aada-9a5a32e4a226', displayName: 'Status' },
    isEnabled: true,
    isBlocking: true,
    settings: {
      statusGenre: 'AdvancedSecurity',
      statusName: 'NewHighAndCritical',
      invalidateOnSourceUpdate: true,
      policyApplicability: 0,
      authorId: null
    }
  }
]

test('Azure DevOps remote evaluator accepts the complete minimum policy baseline', async t => {
  const { advancedSecurityEndpoint, evaluateAzureDevOps } = await loadEvaluator(t)
  const result = evaluateAzureDevOps(config, policies, {
    codeSecurityFeatures: { codeSecurityEnabled: true },
    secretProtectionFeatures: { secretProtectionEnabled: true, blockPushes: true }
  })

  assert.equal(result.ok, true)
  assert.equal(result.controls.length, 14)
  assert.ok(result.controls.every(control => control.status === 'pass'))
  assert.match(advancedSecurityEndpoint('https://dev.azure.com/acme', 'Platform Team', 'repo/id'), /^https:\/\/advsec\.dev\.azure\.com\/acme\/Platform%20Team\//)
  assert.match(advancedSecurityEndpoint('https://acme.visualstudio.com', 'Platform', 'repo'), /^https:\/\/acme\.advsec\.visualstudio\.com\/Platform\//)
})

test('Azure DevOps remote evaluator requires the portable owners to be bound to Azure identities', async t => {
  const { evaluateAzureDevOps } = await loadEvaluator(t)
  const unbound = structuredClone(config)
  unbound.ownership.requiredReviewerIds = []
  const result = evaluateAzureDevOps(unbound, policies, {
    codeSecurityFeatures: { codeSecurityEnabled: true },
    secretProtectionFeatures: { secretProtectionEnabled: true, blockPushes: true }
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.controls.filter(control => control.status === 'fail').map(control => control.id),
    ['AS-ADO-OWNER-000', 'AS-ADO-OWNER-001']
  )
})

test('Azure DevOps remote evaluator rejects partial-path enforcement for repository-wide controls', async t => {
  const { evaluateAzureDevOps } = await loadEvaluator(t)
  const scoped = structuredClone(policies)
  for (const index of [1, 4, 5]) scoped[index].settings.filenamePatterns = ['/docs/*']
  const result = evaluateAzureDevOps(config, scoped, {
    codeSecurityFeatures: { codeSecurityEnabled: true },
    secretProtectionFeatures: { secretProtectionEnabled: true, blockPushes: true }
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.controls.filter(control => control.status === 'fail').map(control => control.id),
    ['AS-ADO-OWNER-001', 'AS-ADO-CI-001', 'AS-ADO-SEC-004']
  )
})

test('Azure DevOps remote evaluator reports policy and security drift by control ID', async t => {
  const { evaluateAzureDevOps } = await loadEvaluator(t)
  const drifted = structuredClone(policies)
  drifted[0].settings.resetOnSourcePush = false
  drifted[4].isBlocking = false
  drifted[5].settings.invalidateOnSourceUpdate = false
  const result = evaluateAzureDevOps(config, drifted, {
    codeSecurityFeatures: { codeSecurityEnabled: false },
    secretProtectionFeatures: { secretProtectionEnabled: true, blockPushes: false }
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.controls.filter(control => control.status === 'fail').map(control => control.id),
    ['AS-ADO-PR-004', 'AS-ADO-CI-001', 'AS-ADO-SEC-004', 'AS-ADO-SEC-001', 'AS-ADO-SEC-003']
  )
})
