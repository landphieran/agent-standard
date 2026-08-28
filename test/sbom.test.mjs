import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.agent-standard', 'scripts', 'sbom.mjs')

function fixture (mode = 'strict') {
  const root = mkdtempSync(join(tmpdir(), 'sbom-'))
  mkdirSync(join(root, '.agent-standard'))
  writeFileSync(join(root, '.agent-standard', 'manifest.json'), JSON.stringify({
    standardVersion: 'test',
    project: { name: 'fixture', packageName: 'fixture' },
    supplyChain: { bom: { mode, formats: ['cyclonedx-json', 'spdx-json'], files: ['bom.cdx.json', 'bom.spdx.json'] } }
  }))
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'fixture', version: '1.0.0' },
      'node_modules/alpha': { version: '2.0.0' },
      'node_modules/@scope/beta': { version: '3.0.0' }
    }
  }))
  return root
}

function run (root, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, AGENT_STANDARD_ROOT: root }
  })
}

test('writes and verifies both supported SBOM formats from package-lock identities', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const cdx = JSON.parse(readFileSync(join(root, 'bom.cdx.json'), 'utf8'))
  const spdx = JSON.parse(readFileSync(join(root, 'bom.spdx.json'), 'utf8'))
  assert.deepEqual(cdx.components.map(value => value.name), ['@scope/beta', 'alpha'])
  assert.deepEqual(spdx.packages.map(value => value.name), ['@scope/beta', 'alpha'])
  assert.equal(run(root, '--check').status, 0)
  const beforeUpdate = readFileSync(join(root, 'bom.cdx.json'), 'utf8')
  assert.equal(run(root, '--write').status, 0)
  assert.equal(readFileSync(join(root, 'bom.cdx.json'), 'utf8'), beforeUpdate)
  rmSync(root, { recursive: true, force: true })
})

test('strict mode rejects a BOM stale against the lockfile', () => {
  const root = fixture()
  run(root, '--write')
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  lock.packages['node_modules/gamma'] = { version: '4.0.0' }
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock))
  const result = run(root, '--check')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /do not match/)
  rmSync(root, { recursive: true, force: true })
})

test('advisory mode reports stale BOMs without blocking', () => {
  const root = fixture('advisory')
  run(root, '--write')
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }))
  const result = run(root, '--check')
  assert.equal(result.status, 0)
  assert.match(result.stderr, /advisory/)
  rmSync(root, { recursive: true, force: true })
})
