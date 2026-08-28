import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SYNC = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.agent-standard', 'scripts', 'sync-skills.mjs')

function runCase (agents) {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-sync-'))
  const source = join(root, '.ruler', 'skills', 'example', 'SKILL.md')
  mkdirSync(dirname(source), { recursive: true })
  writeFileSync(source, '---\nname: example\ndescription: Example skill.\n---\n')
  mkdirSync(join(root, '.agent-standard'), { recursive: true })
  writeFileSync(join(root, '.agent-standard', 'manifest.json'), JSON.stringify({ agents }))
  const result = spawnSync(process.execPath, [SYNC], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, AGENT_STANDARD_ROOT: root }
  })
  return { root, result }
}

test('renaming a skill prunes the stale propagated copy', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-sync-prune-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const addSkill = name => {
    const path = join(root, '.ruler', 'skills', name, 'SKILL.md')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `---\nname: ${name}\ndescription: Example skill.\n---\n`)
  }
  const runSync = () => spawnSync(process.execPath, [SYNC], { cwd: root, encoding: 'utf8', env: { ...process.env, AGENT_STANDARD_ROOT: root } })

  mkdirSync(join(root, '.agent-standard'), { recursive: true })
  writeFileSync(join(root, '.agent-standard', 'manifest.json'), JSON.stringify({ agents: ['claude'] }))
  addSkill('plan-change')
  assert.equal(runSync().status, 0)
  assert.equal(existsSync(join(root, '.claude', 'skills', 'plan-change', 'SKILL.md')), true)

  rmSync(join(root, '.ruler', 'skills', 'plan-change'), { recursive: true, force: true })
  addSkill('plan-changes')
  assert.equal(runSync().status, 0)
  assert.equal(existsSync(join(root, '.claude', 'skills', 'plan-changes', 'SKILL.md')), true)
  assert.equal(existsSync(join(root, '.claude', 'skills', 'plan-change')), false, 'the renamed skill copy must be pruned')
})

test('disabling an agent prunes its managed skill copies', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-sync-agent-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, '.ruler', 'skills', 'example', 'SKILL.md')
  mkdirSync(dirname(source), { recursive: true })
  writeFileSync(source, '---\nname: example\ndescription: Example skill.\n---\n')
  mkdirSync(join(root, '.agent-standard'), { recursive: true })
  const manifest = agents => writeFileSync(join(root, '.agent-standard', 'manifest.json'), JSON.stringify({ agents }))
  const runSync = () => spawnSync(process.execPath, [SYNC], { cwd: root, encoding: 'utf8', env: { ...process.env, AGENT_STANDARD_ROOT: root } })

  manifest(['claude', 'codex'])
  assert.equal(runSync().status, 0)
  assert.equal(existsSync(join(root, '.agents', 'skills', 'example', 'SKILL.md')), true)

  manifest(['claude'])
  assert.equal(runSync().status, 0)
  assert.equal(existsSync(join(root, '.claude', 'skills', 'example', 'SKILL.md')), true)
  assert.equal(existsSync(join(root, '.agents', 'skills', 'example')), false, 'the disabled agent copy must be pruned')
})

for (const [label, agents, claude, codex, copilot] of [
  ['Claude only', ['claude'], true, false, false],
  ['Codex only', ['codex'], false, true, false],
  ['Copilot only', ['copilot'], false, false, true],
  ['all clients', ['claude', 'codex', 'copilot'], true, true, true]
]) {
  test(`${label} receives skills only in supported discovery paths`, t => {
    const { root, result } = runCase(agents)
    t.after(() => rmSync(root, { recursive: true, force: true }))
    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(join(root, '.claude', 'skills', 'example', 'SKILL.md')), claude)
    assert.equal(existsSync(join(root, '.agents', 'skills', 'example', 'SKILL.md')), codex)
    assert.equal(existsSync(join(root, '.github', 'skills', 'example', 'SKILL.md')), copilot)
  })
}
