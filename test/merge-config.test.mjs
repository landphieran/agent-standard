import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MERGE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.agent-standard', 'scripts', 'merge-config.mjs')
const write = (root, relative, body) => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}
const run = root => spawnSync(process.execPath, [MERGE], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, AGENT_STANDARD_ROOT: root }
})

test('configuration merge preserves project settings and updates one managed ownership block', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-merge-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.agent-standard/manifest.json', JSON.stringify({
    agents: ['claude', 'codex'],
    governance: { codeowners: '@acme/platform @acme/security' },
    workflow: { profile: 'lightweight' }
  }))
  write(root, '.claude/settings.json', `\uFEFF${JSON.stringify({
    permissions: { allow: ['Read'] },
    hooks: { Stop: [
      { hooks: [{ type: 'command', command: 'node existing-hook.mjs' }] },
      { hooks: [{ type: 'command', command: 'node .claude/hooks/dod.mjs' }] }
    ] }
  })}`)
  write(root, '.github/CODEOWNERS', [
    '# project ownership',
    '/payments/ @legacy/payments',
    '',
    '# agent-standard:start',
    '/.agent-standard/ @old/owner',
    '# agent-standard:end',
    ''
  ].join('\n'))
  write(root, '.github/pull_request_template.md', '<!-- existing-template -->\n\nDescribe the change.\n')

  const first = run(root)
  assert.equal(first.status, 0, first.stderr)
  const second = run(root)
  assert.equal(second.status, 0, second.stderr)

  const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'))
  assert.deepEqual(settings.permissions, { allow: ['Read'] })
  const commands = settings.hooks.Stop.flatMap(group => group.hooks || []).map(hook => hook.command)
  assert.deepEqual(commands, ['node existing-hook.mjs', 'node .agent-standard/scripts/dod.mjs'])

  const codeowners = readFileSync(join(root, '.github/CODEOWNERS'), 'utf8')
  assert.match(codeowners, /\/payments\/ @legacy\/payments/)
  assert.equal((codeowners.match(/# agent-standard:start/g) || []).length, 1)
  assert.match(codeowners, /\/\.github\/workflows\/ @acme\/platform @acme\/security/)
  assert.doesNotMatch(codeowners, /@old\/owner/)
  const pullRequest = readFileSync(join(root, '.github/pull_request_template.md'), 'utf8')
  assert.match(pullRequest, /existing-template/)
  assert.match(pullRequest, /Acceptance criteria are stated and satisfied/)
  assert.equal((pullRequest.match(/<!-- agent-standard:start -->/g) || []).length, 1)
})

test('non-Claude configurations do not create Claude settings', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-merge-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.agent-standard/manifest.json', JSON.stringify({
    agents: ['codex'],
    governance: { codeowners: '@acme/platform' },
    workflow: { profile: 'lightweight' }
  }))

  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(join(root, '.claude/settings.json')), false)
  assert.match(readFileSync(join(root, '.github/CODEOWNERS'), 'utf8'), /@acme\/platform/)
  assert.match(readFileSync(join(root, '.github/pull_request_template.md'), 'utf8'), /Agent-standard checks/)
})

test('malformed managed markers fail closed instead of consuming project content', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-merge-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.agent-standard/manifest.json', JSON.stringify({
    agents: ['codex'],
    governance: { codeowners: '@acme/platform' },
    workflow: { profile: 'lightweight' }
  }))
  const original = '# agent-standard:start\n/project/ @product/team\n'
  write(root, '.github/CODEOWNERS', original)

  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /malformed or duplicate agent-standard markers/)
  assert.equal(readFileSync(join(root, '.github/CODEOWNERS'), 'utf8'), original)
})
