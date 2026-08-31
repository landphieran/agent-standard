import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const write = (root, relative, body) => {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

test('documented clean-commit recovery restores tracked files and removes adoption output', t => {
  const root = mkdtempSync(join(tmpdir(), 'agent-standard-recovery-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  git(['init', '-q'])
  git(['config', 'core.autocrlf', 'false'])
  git(['config', 'user.email', 'agent-standard@example.invalid'])
  git(['config', 'user.name', 'agent-standard verifier'])
  write(root, 'README.md', '# project\n')
  git(['add', '-A'])
  git(['commit', '-qm', 'clean starting point'])

  write(root, 'README.md', '# adopted project\n')
  write(root, '.agent-standard/manifest.json', '{}\n')
  write(root, 'AGENTS.md', '# generated\n')
  assert.match(git(['status', '--short']), /README\.md/)
  assert.match(git(['clean', '-nd']), /.agent-standard/)

  git(['restore', '--worktree', '--', '.'])
  git(['clean', '-fd'])

  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), '# project\n')
  assert.equal(existsSync(join(root, '.agent-standard')), false)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false)
  assert.equal(git(['status', '--short']), '')
})
