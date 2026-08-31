import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
