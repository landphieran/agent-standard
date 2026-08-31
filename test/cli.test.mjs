import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assessRevision,
  assertSupportedToolchain,
  changedFiles,
  classifyAdoptionChanges,
  copyAtomically,
  detectRepositoryPlatform,
  ownershipBlockers,
  snapshotPaths,
  snapshotsEqual,
  TOOL_VERSIONS,
  uvxToolArgs
} from '../bin/agent-standard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

const write = (root, relative, body) => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

test('transaction plan preserves the leading dot on the first modified hidden path', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-status-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  git(['config', 'user.email', 'agent-standard@example.invalid'])
  git(['config', 'user.name', 'agent-standard verifier'])
  write(root, '.claude/settings.json', '{}\n')
  git(['add', '-A'])
  git(['commit', '-qm', 'fixture'])

  write(root, '.claude/settings.json', '{"hooks":{}}\n')
  write(root, '.agents/skills/example/SKILL.md', '# example\n')

  assert.deepEqual(changedFiles(root), [
    '.agents/skills/example/SKILL.md',
    '.claude/settings.json'
  ])
})

test('adoption fails closed for package managers without lockfile-aware BOM support', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-toolchain-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, 'package.json', JSON.stringify({ name: 'fixture', packageManager: 'pnpm@10.0.0' }))
  write(root, 'pnpm-lock.yaml', 'lockfileVersion: 9\n')

  assert.throws(
    () => assertSupportedToolchain(root, 'ts-node'),
    /currently uses npm.*pnpm-lock\.yaml.*packageManager=pnpm@10\.0\.0/
  )
})

test('npm and uv toolchains pass the minimum-standard preflight', t => {
  const npmRoot = mkdtempSync(join(tmpdir(), 'agent-standard-cli-toolchain-'))
  const uvRoot = mkdtempSync(join(tmpdir(), 'agent-standard-cli-toolchain-'))
  t.after(() => {
    rmSync(npmRoot, { recursive: true, force: true })
    rmSync(uvRoot, { recursive: true, force: true })
  })
  write(npmRoot, 'package.json', JSON.stringify({ name: 'fixture', packageManager: 'npm@11.0.0' }))
  write(npmRoot, 'package-lock.json', '{}')
  write(uvRoot, 'pyproject.toml', '[project]\nname = "fixture"\n')
  write(uvRoot, 'uv.lock', 'version = 1\n')

  assert.doesNotThrow(() => assertSupportedToolchain(npmRoot, 'ts-node'))
  assert.doesNotThrow(() => assertSupportedToolchain(uvRoot, 'py-fastapi'))
})

const BIN = join(REPO, 'bin', 'agent-standard.mjs')

test('Copier execution is pinned to the reviewed bootstrap version', () => {
  assert.equal(TOOL_VERSIONS.copier, '9.17.2')
  assert.deepEqual(uvxToolArgs('copier', ['copy']), ['--from', 'copier==9.17.2', 'copier', 'copy'])
  assert.throws(() => uvxToolArgs('unknown'), /unsupported uvx tool/)
})

test('repository platform detection recognizes Azure DevOps and permits an explicit override', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-platform-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  git(['remote', 'add', 'origin', 'https://dev.azure.com/acme/platform/_git/service'])

  assert.equal(detectRepositoryPlatform(root), 'azure-devops')
  assert.equal(detectRepositoryPlatform(root, 'github'), 'github')
  assert.throws(() => detectRepositoryPlatform(root, 'gitlab'), /unsupported repository platform/)

  git(['remote', 'set-url', 'origin', 'git@ssh.dev.azure.com:v3/acme/platform/service'])
  assert.equal(detectRepositoryPlatform(root), 'azure-devops')

  git(['remote', 'set-url', 'origin', 'git@github.com:acme/service.git'])
  assert.equal(detectRepositoryPlatform(root), 'github')
})

test('verify fails with a clear error outside an agent-standard repository', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-verify-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const r = spawnSync(process.execPath, [BIN, 'verify', root], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /not an agent-standard repository/)
})

test('update requires a Git repository', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-update-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const r = spawnSync(process.execPath, [BIN, 'update', root], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Git repository/)
})

test('release updates require a full immutable revision', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-update-ref-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  git(['config', 'user.email', 'agent-standard@example.invalid'])
  git(['config', 'user.name', 'agent-standard verifier'])
  write(root, '.agent-standard/copier-answers.yml', '_src_path: fixture\n')
  git(['add', '-A'])
  git(['commit', '-qm', 'fixture'])

  const result = spawnSync(process.execPath, [BIN, 'update', root, '--ref', 'main', '--dry-run'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /full 40-character Git commit SHA/)
})

test('help lists the update, verify, and doctor verbs', () => {
  const r = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' })
  assert.equal(r.status, 0)
  for (const verb of ['agent-standard init', 'agent-standard update', 'agent-standard verify', 'agent-standard doctor']) {
    assert.match(r.stdout, new RegExp(verb.replace(/[-]/g, '\\$&')))
  }
})

test('the npm-installed bin entry point executes through its package shim', () => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['exec', '--yes', '--package=.', '--', 'agent-standard', '--help'], {
    cwd: REPO,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  assert.equal(result.status, 0, result.error?.message || result.stderr)
  assert.match(result.stdout, /agent-standard init/)
})

test('release assessment rejects mutable refs and development mode is explicit', () => {
  const immutable = '0123456789abcdef0123456789abcdef01234567'
  assert.deepEqual(assessRevision(immutable, false), { ref: immutable, revision: immutable, blocker: null })
  assert.equal(assessRevision('main', false).blocker.code, 'mutable-revision')
  assert.equal(assessRevision(undefined, false).blocker.code, 'mutable-revision')
  assert.deepEqual(assessRevision(undefined, true), { ref: 'HEAD', revision: 'development', blocker: null })
})

test('read-only assessment reports dirty and missing decisions without mutation', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-assess-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  git(['config', 'user.email', 'agent-standard@example.invalid'])
  git(['config', 'user.name', 'agent-standard verifier'])
  write(root, 'README.md', '# project\n')
  git(['add', '-A'])
  git(['commit', '-qm', 'fixture'])
  write(root, 'README.md', '# dirty project\n')
  const before = readFileSync(join(root, 'README.md'), 'utf8')

  const assessment = spawnSync(process.execPath, [join(REPO, 'bin', 'agent-standard.mjs'), 'init', root], { encoding: 'utf8' })
  assert.equal(assessment.status, 0, assessment.stderr)
  assert.match(assessment.stdout, /clean worktree/i)
  assert.match(assessment.stdout, /application requires one or more portable owner aliases/i)
  assert.match(assessment.stdout, /full 40-character Git commit SHA/i)
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), before)
  assert.equal(existsSync(join(root, '.agent-standard')), false)

  const apply = spawnSync(process.execPath, [join(REPO, 'bin', 'agent-standard.mjs'), 'init', root, '--apply'], { encoding: 'utf8' })
  assert.equal(apply.status, 2, apply.stderr)
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), before)
})

test('ownership assessment inventories agent, standard, OpenSpec, and client-skill collisions', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-ownership-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '-q'])
  write(root, '.gitignore', 'packages/ignored/\n')
  write(root, '.agent-standard/custom.json', '{}\n')
  write(root, '.ruler/00-project.md', '# existing rules\n')
  write(root, 'AGENTS.md', '# root rules\n')
  write(root, 'packages/api/CLAUDE.md', '# nested rules\n')
  write(root, 'packages/ignored/AGENTS.md', '# ignored nested rules\n')
  write(root, '.agents/skills/plan-change/SKILL.md', '# project skill\n')
  write(root, 'openspec/config.yml', 'schema: spec-driven\n')

  const blockers = ownershipBlockers(root, { workflow: 'spec-driven' })
  const keys = blockers.map(blocker => `${blocker.code}:${blocker.path}`).sort()
  assert.deepEqual(keys, [
    'existing-agent-instructions:AGENTS.md',
    'existing-agent-instructions:packages/api/CLAUDE.md',
    'existing-agent-instructions:packages/ignored/AGENTS.md',
    'existing-client-skill:.agents/skills/plan-change',
    'existing-openspec:openspec',
    'existing-ruler:.ruler',
    'existing-standard:.agent-standard'
  ])
})

test('change classification permits only no-op, create, and validated managed merges', t => {
  const target = mkdtempSync(join(tmpdir(), 'agent-standard-cli-target-'))
  const stage = mkdtempSync(join(tmpdir(), 'agent-standard-cli-stage-'))
  t.after(() => {
    rmSync(target, { recursive: true, force: true })
    rmSync(stage, { recursive: true, force: true })
  })
  write(target, 'same.txt', 'same\n')
  write(stage, 'same.txt', 'same\n')
  write(stage, '.agent-standard/new.txt', 'new\n')
  write(target, '.github/pull_request_template.md', '# Project review\n')
  write(stage, '.github/pull_request_template.md', [
    '# Project review',
    '',
    '<!-- agent-standard:start -->',
    '## Standard checks',
    '<!-- agent-standard:end -->',
    ''
  ].join('\n'))
  write(target, '.github/workflows/dod.yml', 'name: project workflow\n')
  write(stage, '.github/workflows/dod.yml', 'name: standard workflow\n')

  const plan = classifyAdoptionChanges(target, stage, [
    '.agent-standard/new.txt',
    '.github/pull_request_template.md',
    '.github/workflows/dod.yml',
    'same.txt'
  ])
  assert.deepEqual(plan.create, ['.agent-standard/new.txt'])
  assert.deepEqual(plan.merge, ['.github/pull_request_template.md'])
  assert.deepEqual(plan.noOp, ['same.txt'])
  assert.deepEqual(plan.blockers.map(blocker => `${blocker.code}:${blocker.path}`), [
    'unowned-collision:.github/workflows/dod.yml'
  ])
})

test('malformed managed markers block adoption before rendering', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-markers-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.github/CODEOWNERS', '# agent-standard:start\n/project @product/team\n')
  const blockers = ownershipBlockers(root)
  assert.deepEqual(blockers.map(blocker => `${blocker.code}:${blocker.path}`), [
    'malformed-managed-markers:.github/CODEOWNERS'
  ])
})

test('destination fingerprints detect collision-sensitive drift', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-cli-drift-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  write(root, '.github/workflows/dod.yml', 'name: first\n')
  const before = snapshotPaths(root, ['.github/workflows/dod.yml', '.agent-standard/manifest.json'])
  assert.equal(snapshotsEqual(before, snapshotPaths(root, ['.github/workflows/dod.yml', '.agent-standard/manifest.json'])), true)
  write(root, '.github/workflows/dod.yml', 'name: changed\n')
  assert.equal(snapshotsEqual(before, snapshotPaths(root, ['.github/workflows/dod.yml', '.agent-standard/manifest.json'])), false)
})

test('partial-copy failure restores replaced files and removes newly created paths', t => {
  const target = mkdtempSync(join(tmpdir(), 'agent-standard-cli-copy-target-'))
  const stage = mkdtempSync(join(tmpdir(), 'agent-standard-cli-copy-stage-'))
  const backup = mkdtempSync(join(tmpdir(), 'agent-standard-cli-copy-backup-'))
  t.after(() => {
    rmSync(target, { recursive: true, force: true })
    rmSync(stage, { recursive: true, force: true })
    rmSync(backup, { recursive: true, force: true })
  })
  write(target, 'existing.txt', 'project\n')
  write(stage, 'existing.txt', 'standard\n')
  write(stage, 'nested/new.txt', 'new\n')
  let copies = 0
  const injectedCopy = (source, destination) => {
    copies++
    if (copies === 2) throw new Error('injected copy failure')
    copyFileSync(source, destination)
  }

  assert.throws(
    () => copyAtomically(stage, target, ['existing.txt', 'nested/new.txt'], backup, { copyFile: injectedCopy }),
    /injected copy failure/
  )
  assert.equal(readFileSync(join(target, 'existing.txt'), 'utf8'), 'project\n')
  assert.equal(existsSync(join(target, 'nested')), false)
})
