import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.claude', 'hooks', 'dod.mjs')

const GATE_CFG = {
  mode: 'strict',
  sourceGlobs: ['src/**/*.ts'],
  unitTestGlobs: ['src/**/*.test.ts', 'tests/unit/**/*.ts'],
  integrationTestGlobs: ['tests/integration/**/*.ts'],
  unitCommand: 'node -e "process.exit(0)"',
  fullCommand: 'node -e "process.exit(0)"',
  openspec: false
}

/** Make a temp git repo with one initial commit and a gate.json. Returns its path. */
function makeRepo (cfg = GATE_CFG) {
  const dir = mkdtempSync(join(tmpdir(), 'dod-'))
  const git = a => execFileSync('git', a, { cwd: dir, stdio: 'ignore' })
  git(['init', '-q'])
  git(['config', 'user.email', 't@t']); git(['config', 'user.name', 't'])
  mkdirSync(join(dir, '.agent-standard'), { recursive: true })
  writeFileSync(join(dir, '.agent-standard', 'gate.json'), JSON.stringify(cfg))
  writeFileSync(join(dir, 'README.md'), '# seed\n')
  git(['add', '-A']); git(['commit', '-qm', 'seed'])
  return dir
}
const write = (dir, rel, body = 'export const x = 1\n') => {
  mkdirSync(join(dir, dirname(rel)), { recursive: true }); writeFileSync(join(dir, rel), body)
}
/** Run the gate as a local Stop hook. Returns {code, stdout, stderr}. */
function runHook (dir, stdin = '{}') {
  const r = spawnSync('node', [GATE], { cwd: dir, input: stdin, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir } })
  return { code: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
/** Run the gate in CI mode over base..head. Returns {code, stdout, stderr}. */
function runCI (dir, base) {
  const r = spawnSync('node', [GATE, '--ci', '--base', base, '--head', 'HEAD'],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } })
  return { code: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
const blocks = r => { try { return JSON.parse(r.stdout.trim()).decision === 'block' } catch { return false } }
const cleanup = dir => rmSync(dir, { recursive: true, force: true })

test('clean tree — nothing to check — passes', () => {
  const d = makeRepo()
  const r = runHook(d)
  assert.equal(r.code, 0); assert.equal(blocks(r), false)
  cleanup(d)
})

test('stop_hook_active — never re-blocks (loop guard)', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts') // a source change is present…
  const r = runHook(d, JSON.stringify({ stop_hook_active: true }))
  assert.equal(blocks(r), false) // …but the loop guard wins
  cleanup(d)
})

test('source changed, no test — BLOCKS', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts')
  const r = runHook(d)
  assert.equal(blocks(r), true)
  assert.match(r.stdout, /no test was added/)
  cleanup(d)
})

test('source + a test in the wrong place — BLOCKS on location', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts'); write(d, 'wrong/foo.test.ts', 'test\n')
  const r = runHook(d)
  assert.equal(blocks(r), true)
  assert.match(r.stdout, /not in a recognised location/)
  cleanup(d)
})

test('source + colocated unit test + green suite — passes', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts'); write(d, 'src/foo.test.ts', 'test\n')
  const r = runHook(d)
  assert.equal(r.code, 0); assert.equal(blocks(r), false)
  cleanup(d)
})

test('source + test present but suite RED — BLOCKS', () => {
  const d = makeRepo({ ...GATE_CFG, unitCommand: 'node -e "process.exit(1)"' })
  write(d, 'src/foo.ts'); write(d, 'src/foo.test.ts', 'test\n')
  const r = runHook(d)
  assert.equal(blocks(r), true)
  assert.match(r.stdout, /Tests failed/)
  cleanup(d)
})

test('advisory mode — reports but NEVER blocks', () => {
  const d = makeRepo({ ...GATE_CFG, mode: 'advisory' })
  write(d, 'src/foo.ts') // would block in strict
  const r = runHook(d)
  assert.equal(r.code, 0); assert.equal(blocks(r), false)
  assert.match(r.stderr, /advisory/)
  cleanup(d)
})

test('override DOD_ALLOW_NO_TESTS — source without test — passes', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts')
  const r = spawnSync('node', [GATE], { cwd: d, input: '{}', encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: d, DOD_ALLOW_NO_TESTS: '1' } })
  assert.equal(r.status ?? 0, 0)
  assert.doesNotMatch(r.stdout ?? '', /decision/)
  cleanup(d)
})

test('docs-only change — not source — passes', () => {
  const d = makeRepo()
  write(d, 'docs/notes.md', '# notes\n')
  const r = runHook(d)
  assert.equal(r.code, 0); assert.equal(blocks(r), false)
  cleanup(d)
})

test('CI mode — source without test over a range — EXITS NON-ZERO', () => {
  const d = makeRepo()
  const git = a => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim()
  write(d, 'src/foo.ts'); git(['add', '-A']); git(['commit', '-qm', 'add source, no test'])
  const r = runCI(d, base)
  assert.equal(r.code, 1)
  assert.match(r.stderr, /no test was added/)
  cleanup(d)
})

test('CI mode — source WITH test and green suite — passes', () => {
  const d = makeRepo()
  const git = a => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim()
  write(d, 'src/foo.ts'); write(d, 'src/foo.test.ts', 'test\n')
  git(['add', '-A']); git(['commit', '-qm', 'source + test'])
  const r = runCI(d, base)
  assert.equal(r.code, 0)
  cleanup(d)
})
