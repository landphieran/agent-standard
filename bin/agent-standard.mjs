#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const command = argv.shift()

function usage () {
  console.log(`Usage:
  agent-standard init [path] --owner @org/team [options]

Options:
  --source <template>       Copier source (default: gh:landphieran/agent-standard)
  --ref <git-ref>           Template ref (default: HEAD during pre-release)
  --name <project-name>     Project name; otherwise detected from the destination
  --stack <stack>           ts-node, ts-next, or py-fastapi; otherwise detected
  --architecture <style>    service-based or clean-layered (default: service-based)
  --workflow <profile>      lightweight or spec-driven (default: lightweight)
  --advanced                Expose the advanced Copier profile using safe defaults
  --dry-run                 Render and verify without changing the destination
`)
}

function option (name) {
  const index = argv.indexOf(name)
  if (index < 0) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  argv.splice(index, 2)
  return value
}

function flag (name) {
  const index = argv.indexOf(name)
  if (index < 0) return false
  argv.splice(index, 1)
  return true
}

function run (program, args, options = {}) {
  const { capture = false, raw = false, ...spawnOptions } = options
  const result = spawnSync(program, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', ...spawnOptions })
  if (result.status !== 0) {
    const detail = capture ? (result.stderr || result.stdout || '').trim() : ''
    throw new Error(`${program} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
  return capture ? (raw ? result.stdout : result.stdout.trim()) : ''
}

function git (root, args, capture = true, raw = false) {
  return run('git', ['-C', root, ...args], { capture, raw })
}

function readJson (path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
}

function detectStack (root, requested) {
  if (requested) {
    if (!['ts-node', 'ts-next', 'py-fastapi'].includes(requested)) throw new Error(`unsupported stack: ${requested}`)
    return requested
  }
  const packagePath = join(root, 'package.json')
  if (existsSync(packagePath)) {
    const pkg = readJson(packagePath)
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
    return dependencies.next ? 'ts-next' : 'ts-node'
  }
  const pyproject = join(root, 'pyproject.toml')
  if (existsSync(pyproject)) {
    if (/\bfastapi\b/i.test(readFileSync(pyproject, 'utf8'))) return 'py-fastapi'
    throw new Error('pyproject.toml was found, but the supported FastAPI stack was not detected; pass --stack after mapping the repository')
  }
  return 'ts-node'
}

function detectName (root) {
  const packagePath = join(root, 'package.json')
  if (existsSync(packagePath)) {
    const declared = readJson(packagePath).name
    if (declared) return declared.startsWith('@') && declared.includes('/') ? declared.split('/').at(-1) : declared
  }
  const pyproject = join(root, 'pyproject.toml')
  if (existsSync(pyproject)) return readFileSync(pyproject, 'utf8').match(/^name\s*=\s*["']([^"']+)/m)?.[1] || basename(root)
  return basename(root)
}

export function assertSupportedToolchain (root, stack) {
  if (stack === 'py-fastapi') {
    const unsupported = ['poetry.lock', 'pdm.lock', 'Pipfile.lock'].filter(path => existsSync(join(root, path)))
    if (unsupported.length) {
      throw new Error(`the minimum standard currently uses uv, but found ${unsupported.join(', ')}; add that package manager to the standard before adopting this repository`)
    }
    return
  }

  const packagePath = join(root, 'package.json')
  const declared = existsSync(packagePath) ? readJson(packagePath).packageManager : null
  const unsupported = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'].filter(path => existsSync(join(root, path)))
  if (declared && !/^npm@/i.test(declared)) unsupported.push(`packageManager=${declared}`)
  if (unsupported.length) {
    throw new Error(`the minimum standard currently uses npm, but found ${[...new Set(unsupported)].join(', ')}; add that package manager and its lockfile/SBOM support before adopting this repository`)
  }
}

function filesBelow (root, relative = '') {
  const directory = join(root, relative)
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (!relative && entry.name === '.git') return []
    const child = relative ? `${relative}/${entry.name}` : entry.name
    return entry.isDirectory() ? filesBelow(root, child) : [child]
  })
}

export function changedFiles (worktree) {
  // Do not trim porcelain output: a leading space is part of the first XY status
  // and trimming it corrupts hidden paths such as `.claude/settings.json`.
  const output = git(worktree, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], true, true)
  if (!output) return []
  const records = output.split('\0').filter(Boolean)
  const paths = []
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    const status = record.slice(0, 2)
    const path = record.slice(3).replace(/\\/g, '/')
    paths.push(path)
    if (status.includes('R') || status.includes('C')) index++
  }
  return [...new Set(paths)].sort()
}

function copyAtomically (stage, target, files, backupRoot) {
  const applied = []
  try {
    for (const relative of files) {
      const source = join(stage, relative)
      const destination = join(target, relative)
      const backup = join(backupRoot, relative)
      const existed = existsSync(destination)
      if (existed) {
        mkdirSync(dirname(backup), { recursive: true })
        copyFileSync(destination, backup)
      }
      mkdirSync(dirname(destination), { recursive: true })
      if (existsSync(source)) copyFileSync(source, destination)
      else if (existed) rmSync(destination, { force: true })
      applied.push({ relative, existed })
    }
  } catch (error) {
    for (const item of applied.reverse()) {
      const destination = join(target, item.relative)
      const backup = join(backupRoot, item.relative)
      if (item.existed) copyFileSync(backup, destination)
      else rmSync(destination, { force: true })
    }
    throw error
  }
}

function init () {
  const source = option('--source') || 'gh:landphieran/agent-standard'
  const ref = option('--ref') || 'HEAD'
  const requestedName = option('--name')
  const requestedStack = option('--stack')
  const architecture = option('--architecture') || 'service-based'
  const requestedOwner = option('--owner')
  const workflow = option('--workflow') || 'lightweight'
  const advanced = flag('--advanced')
  const dryRun = flag('--dry-run')
  if (!['lightweight', 'spec-driven'].includes(workflow)) throw new Error(`unsupported workflow profile: ${workflow}`)
  if (!['service-based', 'clean-layered'].includes(architecture)) throw new Error(`unsupported architecture: ${architecture}`)
  const targetArgument = argv.shift() || '.'
  if (argv.length) throw new Error(`unexpected arguments: ${argv.join(' ')}`)

  const target = resolve(targetArgument)
  const existing = existsSync(target) && readdirSync(target).length > 0
  let initialHead = null
  if (existing) {
    const repositoryRoot = resolve(git(target, ['rev-parse', '--show-toplevel']))
    const sameRoot = process.platform === 'win32'
      ? repositoryRoot.toLowerCase() === target.toLowerCase()
      : repositoryRoot === target
    if (!sameRoot) throw new Error('existing-project adoption must target the Git repository root')
    if (git(target, ['status', '--porcelain'])) throw new Error('existing-project adoption requires a clean worktree; commit or stash current changes')
    initialHead = git(target, ['rev-parse', 'HEAD'])
  }

  const owner = requestedOwner
  if (!owner || !/^@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?:\s+@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)*$/.test(owner)) {
    throw new Error('provide --owner with one or more GitHub users/teams, for example --owner @acme/platform')
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'agent-standard-init-'))
  const stage = join(tempRoot, 'stage')
  const backup = join(tempRoot, 'backup')
  let worktree = false
  try {
    if (existing) {
      git(target, ['worktree', 'add', '--detach', stage, 'HEAD'], false)
      worktree = true
    } else mkdirSync(stage, { recursive: true })

    const stack = detectStack(stage, requestedStack)
    assertSupportedToolchain(stage, stack)
    const name = requestedName || detectName(stage)
    const data = {
      setup_profile: advanced ? 'advanced' : 'standard',
      project_name: name,
      language_stack: stack,
      mode: existing ? 'adopt' : 'greenfield',
      codeowners: owner,
      architecture,
      workflow_profile: workflow
    }
    const copierArgs = ['copier', 'copy', '--trust', '--force', '--answers-file', '.agent-standard/copier-answers.yml', '--vcs-ref', ref]
    for (const [key, value] of Object.entries(data)) copierArgs.push('--data', `${key}=${value}`)
    copierArgs.push(source, stage)
    run('uvx', copierArgs)

    const files = existing ? changedFiles(stage) : filesBelow(stage).sort()
    console.log(`\nagent-standard plan (${existing ? 'adopt' : 'greenfield'}): ${files.length} files`)
    for (const path of files) console.log(`  ${path}`)
    if (dryRun) {
      console.log('\nDry run complete; destination was not changed.')
      return
    }

    if (existing && (git(target, ['status', '--porcelain']) || git(target, ['rev-parse', 'HEAD']) !== initialHead)) {
      throw new Error('destination changed during staging; no files were applied')
    }
    if (!existing && existsSync(target) && readdirSync(target).length > 0) {
      throw new Error('destination became non-empty during staging; no files were applied')
    }
    if (!existsSync(target)) mkdirSync(target, { recursive: true })
    copyAtomically(stage, target, files, backup)
    console.log(`\nApplied agent-standard to ${target}.`)
    console.log('Next: install dependencies, refresh the SBOM, stage generated files, and run the manifest verification command.')
  } finally {
    if (worktree) {
      try { git(target, ['worktree', 'remove', '--force', stage], false) } catch { console.warn(`warning: remove temporary worktree manually: ${stage}`) }
    }
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true })
  }
}

const invokedAsScript = (() => {
  if (!process.argv[1]) return false
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false }
})()

if (invokedAsScript) {
  try {
    if (command === 'init') init()
    else { usage(); if (command && !['help', '--help', '-h'].includes(command)) process.exitCode = 1 }
  } catch (error) {
    console.error(`agent-standard: ${error.message}`)
    process.exitCode = 1
  }
}
