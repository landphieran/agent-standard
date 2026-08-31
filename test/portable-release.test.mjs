import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fingerprintBundle, validateReleaseSource } from '../scripts/build-portable-release.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const portable = join(root, 'portable')
const excludedTools = ['copier', 'uv', 'ruler', 'openspec']

test('portable distribution defines every supported static greenfield profile', () => {
  const expected = [
    'azure-py-fastapi.yml', 'azure-ts-next.yml', 'azure-ts-node.yml',
    'github-py-fastapi.yml', 'github-ts-next.yml', 'github-ts-node.yml'
  ]
  assert.deepEqual(readdirSync(join(portable, 'profiles')).sort(), expected)
  for (const profile of expected) {
    const contents = readFileSync(join(portable, 'profiles', profile), 'utf8')
    assert.match(contents, /^mode: greenfield$/m)
    assert.match(contents, /^workflow_profile: lightweight$/m)
    assert.match(contents, /^ci: true$/m)
  }
})

test('portable runtime and documentation do not name excluded setup tools', () => {
  const sourceFiles = [
    'README.md',
    ...readdirSync(join(portable, 'runtime')).map(name => join('runtime', name))
  ]
  for (const file of sourceFiles) {
    const contents = readFileSync(join(portable, file), 'utf8')
    for (const tool of excludedTools) {
      assert.doesNotMatch(contents, new RegExp(`\\b${tool}\\b`, 'i'), `${file} must not refer to ${tool}`)
    }
  }
})

test('portable release build is a supported maintainer command', () => {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts['verify:portable'], 'node scripts/build-portable-release.mjs')
  assert.equal(existsSync(join(root, 'scripts', 'build-portable-release.mjs')), true)
  assert.equal(existsSync(join(root, 'docs', 'portable-distribution.md')), true)
})

test('portable bundle fingerprints bind file paths and content boundaries', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-standard-portable-digest-'))
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const first = join(fixture, 'first')
  const second = join(fixture, 'second')
  mkdirSync(first)
  mkdirSync(second)
  writeFileSync(join(first, 'a.txt'), 'ab')
  writeFileSync(join(first, 'b.txt'), 'c')
  writeFileSync(join(second, 'a.txt'), 'a')
  writeFileSync(join(second, 'b.txt'), 'bc')

  const firstFingerprint = fingerprintBundle(first)
  const secondFingerprint = fingerprintBundle(second)
  assert.notEqual(firstFingerprint.sha256, secondFingerprint.sha256)
  assert.deepEqual(firstFingerprint.files.map(file => file.path), ['a.txt', 'b.txt'])
})

test('portable releases require an immutable revision and clean source checkout', () => {
  assert.doesNotThrow(() => validateReleaseSource('a'.repeat(40), ''))
  assert.throws(() => validateReleaseSource('HEAD', ''), /full source revision/)
  assert.throws(() => validateReleaseSource('a'.repeat(40), ' M README.md'), /clean source checkout/)
})

test('portable archive verification is a required CI job', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
  assert.doesNotMatch(workflow, /-SourceRef HEAD/)
  assert.match(workflow, /-SourceRef "\$\{\{ github\.sha \}\}"/)
  assert.match(workflow, /^  portable:\s*$/m)
  assert.match(workflow, /python-version: "3\.11"/)
  assert.match(workflow, /version: "0\.10\.8"/)
  assert.match(workflow, /npm run verify:portable/)
})
