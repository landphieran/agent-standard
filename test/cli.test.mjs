import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSupportedToolchain, changedFiles } from '../bin/agent-standard.mjs'

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
