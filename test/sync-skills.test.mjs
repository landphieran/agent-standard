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
