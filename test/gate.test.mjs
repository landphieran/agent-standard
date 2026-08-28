import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.agent-standard', 'scripts', 'dod.mjs')

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
function runCI (dir, base, extra = []) {
  const r = spawnSync('node', [GATE, '--ci', '--base', base, '--head', 'HEAD', ...extra],
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
  assert.match(r.stdout, /no recognised test changed/)
  cleanup(d)
})

test('source + a test in the wrong place — BLOCKS on location', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts'); write(d, 'wrong/foo.test.ts', 'test\n')
  const r = runHook(d)
  assert.equal(blocks(r), true)
  assert.match(r.stdout, /outside recognised locations/)
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
  assert.match(r.stdout, /Verification failed/)
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

test('owned, unexpired path waiver — source without test — passes', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts')
  write(d, '.agent-standard/waivers.json', JSON.stringify({ noTests: [{
    id: 'WAIVER-1', owner: 'team@example.com', reason: 'generated source only',
    expires: '2999-01-01', paths: ['src/**/*.ts']
  }] }))
  const r = runHook(d)
  assert.equal(r.code, 0); assert.equal(blocks(r), false)
  cleanup(d)
})

test('expired waiver — source without test — BLOCKS', () => {
  const d = makeRepo()
  write(d, 'src/foo.ts')
  write(d, '.agent-standard/waivers.json', JSON.stringify({ noTests: [{
    id: 'WAIVER-1', owner: 'team@example.com', reason: 'expired',
    expires: '2000-01-01', paths: ['src/**/*.ts']
  }] }))
  assert.equal(blocks(runHook(d)), true)
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
  assert.match(r.stderr, /no recognised test changed/)
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

test('CI advisory mode reports findings but exits zero', () => {
  const d = makeRepo({ ...GATE_CFG, mode: 'advisory' })
  const git = a => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim()
  write(d, 'src/foo.ts'); git(['add', '-A']); git(['commit', '-qm', 'source without test'])
  const r = runCI(d, base)
  assert.equal(r.code, 0)
  assert.match(r.stderr, /advisory/)
  cleanup(d)
})

test('CI refs are passed to git as arguments, not executed by a shell', () => {
  const d = makeRepo()
  const marker = join(d, 'injected.txt')
  spawnSync('node', [GATE, '--ci', '--base', `HEAD;echo injected>${marker}`, '--head', 'HEAD'],
    { cwd: d, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: d } })
  assert.equal(existsSync(marker), false)
  cleanup(d)
})

test('CI mode — a source file that only advanced on the base branch is not attributed to the PR', () => {
  const d = makeRepo()
  const git = a => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  const rev = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim()
  const forkPoint = rev()
  // The base branch advances with an unrelated, untested source file.
  write(d, 'src/other.ts'); git(['add', '-A']); git(['commit', '-qm', 'base advances src/other.ts'])
  const baseTip = rev()
  // The PR branches from the fork point and changes only docs.
  git(['checkout', '-q', '-b', 'feature', forkPoint])
  write(d, 'docs/notes.md', '# notes\n'); git(['add', '-A']); git(['commit', '-qm', 'docs only'])
  // Evaluated against the current base tip, as GitHub passes pull_request.base.sha.
  const r = runCI(d, baseTip)
  assert.equal(r.code, 0, r.stdout || r.stderr) // two-dot would misattribute src/other.ts and block
  cleanup(d)
})

test('CI policy-only mode does not execute the full command twice', () => {
  const d = makeRepo({
    ...GATE_CFG,
    fullCommand: 'node -e "require(\'fs\').writeFileSync(\'full-command-ran.txt\', \'yes\')"'
  })
  const git = a => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim()
  write(d, 'src/foo.ts'); write(d, 'src/foo.test.ts', 'test\n')
  git(['add', '-A']); git(['commit', '-qm', 'source + test'])
  const r = runCI(d, base, ['--policy-only'])
  assert.equal(r.code, 0)
  assert.equal(existsSync(join(d, 'full-command-ran.txt')), false)
  cleanup(d)
})
