#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  rmdirSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

const cliArgs = process.argv.slice(2)
const command = cliArgs.shift()
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const standardVersion = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version
const FULL_SHA = /^[0-9a-f]{40}$/i
const OWNER = /^@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?:\s+@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)*$/
export const TOOL_VERSIONS = Object.freeze({ copier: '9.17.2' })
export const uvxToolArgs = (tool, args = []) => {
  const version = TOOL_VERSIONS[tool]
  if (!version) throw new Error(`unsupported uvx tool: ${tool}`)
  return ['--from', `${tool}==${version}`, tool, ...args]
}
const ARCHITECTURES = ['service-based', 'clean-layered']
const STANDARD_SKILLS = ['plan-change', 'create-adr', 'maintain-docs', 'self-review', 'security-review']
const CLIENT_SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills']
const PRESERVED_PATHS = [
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.gitignore',
  '.claude/settings.json',
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  '.github/pull_request_template.md',
  '.azuredevops/pull_request_template.md',
  'azure-pipelines.yml',
  'docs/README.md',
  'docs/decisions/README.md',
  'docs/decisions/0000-template.md',
  'docs/runbooks/README.md',
  'docs/testing.md',
  'docs/topology.md',
  'docs/changes/README.md',
  'docs/changes/0000-template.md'
]
const MANAGED_TEXT = new Map([
  ['.github/CODEOWNERS', ['# agent-standard:start', '# agent-standard:end']],
  ['.github/pull_request_template.md', ['<!-- agent-standard:start -->', '<!-- agent-standard:end -->']],
  ['.azuredevops/pull_request_template.md', ['<!-- agent-standard:start -->', '<!-- agent-standard:end -->']]
])

function usage () {
  console.log(`Usage:
  agent-standard init   [path] --owner @org/team [options]
  agent-standard update [path] --ref <full-sha> [--dry-run]
  agent-standard verify [path] [-- passthrough]
  agent-standard doctor [path] [--json]

The default init action is a read-only assessment. In an interactive terminal
the installer asks before applying; non-interactive mutation requires --apply.

init options:
  --source <template>       Copier source (default: gh:landphieran/agent-standard)
  --ref <full-sha>          Immutable template revision (required for release use)
  --development            Permit a mutable/local ref and record development
  --owner <aliases>         One or more portable @org/team owner aliases
  --name <project-name>     Project name; otherwise detected from the destination
  --stack <stack>           ts-node, ts-next, or py-fastapi; otherwise detected
  --scm <provider>          github or azure-devops; otherwise detected from origin
  --architecture <style>    service-based or clean-layered; explicit before apply
  --workflow <profile>      lightweight or spec-driven (default: lightweight)
  --advanced                Use the advanced Copier profile with safe defaults
  --apply                   Apply a freshly assessed, blocker-free plan
  --dry-run                 Assess and render only; never change the destination

update applies a template bump through the same staged, atomic, rollback-safe
transaction as init. Mutable update refs require --development. verify and
doctor run the repository's own pinned scripts.
`)
}

function option (name) {
  const index = cliArgs.indexOf(name)
  if (index < 0) return null
  const value = cliArgs[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  cliArgs.splice(index, 2)
  if (cliArgs.includes(name)) throw new Error(`${name} may be provided only once`)
  return value
}

function flag (name) {
  const indexes = cliArgs.flatMap((value, index) => value === name ? [index] : [])
  if (indexes.length > 1) throw new Error(`${name} may be provided only once`)
  if (!indexes.length) return false
  cliArgs.splice(indexes[0], 1)
  return true
}

function run (program, args, options = {}) {
  const { capture = false, raw = false, ...spawnOptions } = options
  const result = spawnSync(program, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', ...spawnOptions })
  if (result.status !== 0) {
    const detail = capture ? (result.stderr || result.stdout || result.error?.message || '').trim() : result.error?.message || ''
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

export function detectRepositoryPlatform (root, requested) {
  if (requested) {
    if (!['github', 'azure-devops'].includes(requested)) throw new Error(`unsupported repository platform: ${requested}`)
    return requested
  }
  try {
    const remote = git(root, ['remote', 'get-url', 'origin']).toLowerCase()
    if (remote.includes('dev.azure.com') || remote.includes('visualstudio.com/')) return 'azure-devops'
    if (remote.includes('github.com')) return 'github'
  } catch { /* a greenfield destination might not have a Git remote yet */ }
  return 'github'
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
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (!relative && entry.name === '.git') return []
    const child = relative ? `${relative}/${entry.name}` : entry.name
    return entry.isDirectory() && !entry.isSymbolicLink() ? filesBelow(root, child) : [child]
  })
}

function agentInstructionFiles (root, relative = '') {
  const directory = join(root, relative)
  if (!existsSync(directory)) return []
  const excluded = new Set(['.git', '.next', '.tox', '.venv', 'build', 'coverage', 'dist', 'node_modules'])
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      return excluded.has(entry.name) ? [] : agentInstructionFiles(root, child)
    }
    return ['AGENTS.MD', 'CLAUDE.MD'].includes(entry.name.toUpperCase()) ? [child] : []
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

function hash (value) {
  return createHash('sha256').update(value).digest('hex')
}

export function pathFingerprint (path) {
  if (!existsSync(path)) return { kind: 'absent' }
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return { kind: 'symlink', hash: hash(readlinkSync(path)) }
  if (stat.isFile()) return { kind: 'file', hash: hash(readFileSync(path)), size: stat.size }
  if (stat.isDirectory()) return { kind: 'directory' }
  return { kind: 'other' }
}

export function snapshotPaths (root, paths) {
  return Object.fromEntries([...new Set(paths)].sort().map(relative => [relative, pathFingerprint(join(root, relative))]))
}

export function snapshotsEqual (left, right) {
  return isDeepStrictEqual(left, right)
}

function countToken (text, token) {
  return text.split(token).length - 1
}

function markerState (text, start, end) {
  const starts = countToken(text, start)
  const ends = countToken(text, end)
  return { starts, ends, valid: starts === ends && starts <= 1 }
}

function escapeRegex (text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function withoutManagedText (text, start, end) {
  const pattern = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`)
  return text.replace(pattern, '').trim()
}

function withoutManagedClaudeHook (settings) {
  const copy = structuredClone(settings)
  const stop = copy.hooks?.Stop
  if (Array.isArray(stop)) {
    copy.hooks.Stop = stop.flatMap(group => {
      if (!Array.isArray(group?.hooks)) return [group]
      const hooks = group.hooks.filter(hook => !(hook?.type === 'command' && [
        'node .agent-standard/scripts/dod.mjs',
        'node .claude/hooks/dod.mjs'
      ].includes(hook.command)))
      return hooks.length ? [{ ...group, hooks }] : []
    })
  }
  return copy
}

function isManagedMergeSafe (relative, destination, source) {
  if (relative === '.claude/settings.json') {
    try {
      const before = readJson(destination)
      const after = readJson(source)
      const commands = (after.hooks?.Stop || []).flatMap(group => group?.hooks || [])
        .filter(hook => hook?.type === 'command' && hook.command === 'node .agent-standard/scripts/dod.mjs')
      return commands.length === 1 && isDeepStrictEqual(withoutManagedClaudeHook(before), withoutManagedClaudeHook(after))
    } catch { return false }
  }

  const markers = MANAGED_TEXT.get(relative)
  if (!markers) return false
  const before = readFileSync(destination, 'utf8').replace(/^\uFEFF/, '')
  const after = readFileSync(source, 'utf8').replace(/^\uFEFF/, '')
  const beforeState = markerState(before, ...markers)
  const afterState = markerState(after, ...markers)
  return beforeState.valid && afterState.valid && afterState.starts === 1 &&
    withoutManagedText(before, ...markers) === withoutManagedText(after, ...markers)
}

function uniqueBlockers (blockers) {
  return [...new Map(blockers.map(blocker => [`${blocker.code}:${blocker.path || ''}`, blocker])).values()]
}

export function ownershipBlockers (target, { workflow = 'lightweight' } = {}) {
  const blockers = []
  if (!existsSync(target) || !lstatSync(target).isDirectory()) return blockers
  if (existsSync(join(target, '.agent-standard'))) blockers.push({
    code: 'existing-standard',
    path: '.agent-standard',
    message: 'an existing .agent-standard installation must be updated with Copier; init will not replace or migrate it'
  })
  if (existsSync(join(target, '.ruler'))) blockers.push({
    code: 'existing-ruler',
    path: '.ruler',
    message: 'existing canonical agent rules are project-owned; v1 does not migrate or replace them'
  })

  for (const relative of agentInstructionFiles(target)) {
    blockers.push({
      code: 'existing-agent-instructions',
      path: relative,
      message: 'existing root or nested agent instructions require an owner decision; v1 will not overwrite them'
    })
  }

  for (const skillRoot of CLIENT_SKILL_ROOTS) {
    for (const skill of STANDARD_SKILLS) {
      const relative = `${skillRoot}/${skill}`
      if (existsSync(join(target, relative))) blockers.push({
        code: 'existing-client-skill',
        path: relative,
        message: 'a same-named client skill is project-owned; v1 will not overwrite or migrate it'
      })
    }
  }

  if (workflow === 'spec-driven' && existsSync(join(target, 'openspec'))) blockers.push({
    code: 'existing-openspec',
    path: 'openspec',
    message: 'existing OpenSpec artifacts require explicit migration outside v1 adoption'
  })

  for (const [relative, markers] of MANAGED_TEXT) {
    const path = join(target, relative)
    if (!existsSync(path)) continue
    const state = markerState(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''), ...markers)
    if (!state.valid) blockers.push({
      code: 'malformed-managed-markers',
      path: relative,
      message: 'managed markers are malformed or duplicated; repair them before adoption'
    })
  }
  const claudeSettings = join(target, '.claude/settings.json')
  if (existsSync(claudeSettings)) {
    try { readJson(claudeSettings) } catch {
      blockers.push({ code: 'invalid-managed-json', path: '.claude/settings.json', message: 'Claude settings are not valid JSON and cannot be merged safely' })
    }
  }
  return uniqueBlockers(blockers)
}

export function classifyAdoptionChanges (target, stage, files) {
  const plan = { create: [], merge: [], noOp: [], preserved: [], blockers: [] }
  for (const relative of files) {
    if (!relative || relative.startsWith('/') || relative.split('/').includes('..')) {
      plan.blockers.push({ code: 'unsafe-generated-path', path: relative, message: 'the rendered plan contains an unsafe path' })
      continue
    }
    const source = join(stage, relative)
    const destination = join(target, relative)
    if (!existsSync(source)) {
      plan.blockers.push({ code: 'generated-delete', path: relative, message: 'initial adoption cannot delete project content' })
      continue
    }
    const sourceStat = lstatSync(source)
    if (!sourceStat.isFile()) {
      plan.blockers.push({ code: 'unsupported-generated-entry', path: relative, message: 'v1 adoption supports generated regular files only' })
      continue
    }
    if (!existsSync(destination)) {
      plan.create.push(relative)
      continue
    }
    const destinationStat = lstatSync(destination)
    if (destinationStat.isFile() && isDeepStrictEqual(pathFingerprint(source), pathFingerprint(destination))) {
      plan.noOp.push(relative)
      continue
    }
    if (destinationStat.isFile() && isManagedMergeSafe(relative, destination, source)) {
      plan.merge.push(relative)
      continue
    }
    plan.blockers.push({
      code: 'unowned-collision',
      path: relative,
      message: 'the rendered standard would replace project-owned content; v1 requires an explicit owner resolution'
    })
  }

  const changed = new Set(files)
  for (const relative of PRESERVED_PATHS) {
    if (!changed.has(relative) && existsSync(join(target, relative)) && existsSync(join(stage, relative))) plan.preserved.push(relative)
  }
  for (const key of ['create', 'merge', 'noOp', 'preserved']) plan[key].sort()
  plan.blockers = uniqueBlockers(plan.blockers)
  return plan
}

function removeEmptyParents (path, stop) {
  let current = dirname(path)
  while (current !== stop && current.startsWith(stop)) {
    try { rmdirSync(current) } catch { break }
    current = dirname(current)
  }
}

export function copyAtomically (stage, target, files, backupRoot, { copyFile = copyFileSync } = {}) {
  const touched = []
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
      touched.push({ relative, existed })
      mkdirSync(dirname(destination), { recursive: true })
      if (existsSync(source)) copyFile(source, destination)
      else if (existed) rmSync(destination, { force: true })
    }
  } catch (error) {
    for (const item of touched.reverse()) {
      const destination = join(target, item.relative)
      const backup = join(backupRoot, item.relative)
      if (item.existed) copyFileSync(backup, destination)
      else {
        rmSync(destination, { force: true })
        removeEmptyParents(destination, target)
      }
    }
    throw error
  }
}

export function assessRevision (requestedRef, development) {
  if (development) {
    const ref = requestedRef || 'HEAD'
    return { ref, revision: FULL_SHA.test(ref) ? ref.toLowerCase() : 'development', blocker: null }
  }
  if (!requestedRef || !FULL_SHA.test(requestedRef)) return {
    ref: requestedRef,
    revision: null,
    blocker: { code: 'mutable-revision', message: 'release use requires --ref with a full 40-character Git commit SHA; use --development only for explicit local work' }
  }
  return { ref: requestedRef.toLowerCase(), revision: requestedRef.toLowerCase(), blocker: null }
}

function inspectRepository (target, existing) {
  const state = { existing, repositoryRoot: null, head: null, dirty: false, blockers: [] }
  if (!existing) return state
  try {
    state.repositoryRoot = resolve(git(target, ['rev-parse', '--show-toplevel']))
    const sameRoot = process.platform === 'win32'
      ? state.repositoryRoot.toLowerCase() === target.toLowerCase()
      : state.repositoryRoot === target
    if (!sameRoot) state.blockers.push({ code: 'not-repository-root', message: 'existing-project adoption must target the Git repository root' })
  } catch {
    state.blockers.push({ code: 'not-git-repository', message: 'existing-project adoption requires a Git repository at the target root' })
    return state
  }
  try { state.head = git(target, ['rev-parse', 'HEAD']) } catch {
    state.blockers.push({ code: 'missing-commit', message: 'existing-project adoption requires at least one commit so staging and Git recovery are deterministic' })
  }
  try { state.dirty = Boolean(git(target, ['status', '--porcelain=v1', '--untracked-files=all'])) } catch {}
  if (state.dirty) state.blockers.push({
    code: 'dirty-worktree',
    message: 'assessment is allowed, but application requires a clean worktree so Git recovery is reliable'
  })
  return state
}

function addDecisionBlockers (blockers, owner, architecture, revision) {
  if (!owner || !OWNER.test(owner)) blockers.push({
    code: 'missing-owner',
    message: 'application requires one or more portable owner aliases, for example --owner @acme/platform'
  })
  if (!architecture || !ARCHITECTURES.includes(architecture)) blockers.push({
    code: 'missing-architecture',
    message: 'application requires an explicit --architecture service-based or --architecture clean-layered decision'
  })
  if (revision.blocker) blockers.push(revision.blocker)
}

async function promptForDecisions (owner, architecture) {
  if (!stdin.isTTY || !stdout.isTTY) return { owner, architecture }
  const prompt = createInterface({ input: stdin, output: stdout })
  try {
    while (!owner || !OWNER.test(owner)) {
      owner = (await prompt.question('Owner aliases (for example @acme/platform): ')).trim()
      if (!owner) break
      if (!OWNER.test(owner)) console.log('Enter one or more @owner aliases separated by spaces.')
    }
    while (!architecture || !ARCHITECTURES.includes(architecture)) {
      architecture = (await prompt.question('Architecture (service-based or clean-layered): ')).trim()
      if (!architecture) break
      if (!ARCHITECTURES.includes(architecture)) console.log('Choose service-based or clean-layered.')
    }
  } finally { prompt.close() }
  return { owner, architecture }
}

function printGroup (label, paths) {
  if (!paths.length) return
  console.log(`\n${label} (${paths.length})`)
  for (const path of paths) console.log(`  ${path}`)
}

function printAssessment ({ existing, target, revision, plan, blockers, rendered }) {
  console.log(`\nagent-standard assessment: ${existing ? 'adopt' : 'greenfield'}`)
  console.log(`  destination: ${target}`)
  console.log(`  product: ${standardVersion}`)
  console.log(`  revision: ${revision.revision || revision.ref || 'not supplied'}`)
  if (rendered) {
    printGroup('Create', plan.create)
    printGroup('Managed merge', plan.merge)
    printGroup('Preserve project-owned', plan.preserved)
    printGroup('Identical no-op', plan.noOp)
  } else console.log('  exact render plan: unavailable until the listed decisions/blockers are resolved')
  if (blockers.length) {
    console.log(`\nApply blockers (${blockers.length})`)
    for (const blocker of blockers) console.log(`  - ${blocker.path ? `${blocker.path}: ` : ''}${blocker.message}`)
  } else console.log('\nApply blockers: none')
}

async function confirmApply () {
  const prompt = createInterface({ input: stdin, output: stdout })
  try { return /^y(?:es)?$/i.test((await prompt.question('\nApply this freshly assessed plan? [y/N] ')).trim()) } finally { prompt.close() }
}

async function init () {
  const source = option('--source') || 'gh:landphieran/agent-standard'
  const requestedRef = option('--ref')
  const requestedName = option('--name')
  const requestedStack = option('--stack')
  const requestedPlatform = option('--scm')
  let architecture = option('--architecture')
  let owner = option('--owner')
  const workflow = option('--workflow') || 'lightweight'
  const advanced = flag('--advanced')
  const apply = flag('--apply')
  const dryRun = flag('--dry-run')
  const development = flag('--development')
  if (apply && dryRun) throw new Error('--apply and --dry-run are mutually exclusive')
  if (!['lightweight', 'spec-driven'].includes(workflow)) throw new Error(`unsupported workflow profile: ${workflow}`)
  if (architecture && !ARCHITECTURES.includes(architecture)) throw new Error(`unsupported architecture: ${architecture}`)
  const targetArgument = cliArgs.shift() || '.'
  if (cliArgs.length) throw new Error(`unexpected arguments: ${cliArgs.join(' ')}`)

  const target = resolve(targetArgument)
  const targetExists = existsSync(target)
  if (targetExists && !lstatSync(target).isDirectory()) throw new Error('destination must be a directory path')
  const existing = targetExists && readdirSync(target).length > 0
  const repository = inspectRepository(target, existing)
  const revision = assessRevision(requestedRef, development)

  ;({ owner, architecture } = await promptForDecisions(owner, architecture))
  const blockers = [...repository.blockers]
  addDecisionBlockers(blockers, owner, architecture, revision)
  if (existing) blockers.push(...ownershipBlockers(target, { workflow }))

  let plan = { create: [], merge: [], noOp: [], preserved: [], blockers: [] }
  let rendered = false
  let tempRoot = null
  let stage = null
  let backup = null
  let worktree = false
  let stack = null
  let repositoryPlatform = null
  let assessedDestinations = null
  const canRender = !blockers.some(blocker => [
    'not-repository-root',
    'not-git-repository',
    'missing-commit',
    'missing-owner',
    'missing-architecture',
    'mutable-revision',
    'existing-standard',
    'existing-ruler',
    'existing-agent-instructions',
    'existing-client-skill',
    'existing-openspec',
    'malformed-managed-markers',
    'invalid-managed-json'
  ].includes(blocker.code))

  try {
    if (canRender) {
      tempRoot = mkdtempSync(join(tmpdir(), 'agent-standard-init-'))
      stage = join(tempRoot, 'stage')
      backup = join(tempRoot, 'backup')
      if (existing) {
        git(target, ['worktree', 'add', '--detach', stage, repository.head], false)
        worktree = true
      } else mkdirSync(stage, { recursive: true })

      try {
        stack = detectStack(stage, requestedStack)
        assertSupportedToolchain(stage, stack)
      } catch (error) {
        blockers.push({ code: 'unsupported-toolchain', message: error.message })
      }
      if (!blockers.some(blocker => blocker.code === 'unsupported-toolchain')) {
        repositoryPlatform = detectRepositoryPlatform(stage, requestedPlatform)
        const name = requestedName || detectName(stage)
        const data = {
          setup_profile: advanced ? 'advanced' : 'standard',
          project_name: name,
          language_stack: stack,
          mode: existing ? 'adopt' : 'greenfield',
          repository_platform: repositoryPlatform,
          owners: owner,
          architecture,
          workflow_profile: workflow,
          standard_revision: revision.revision
        }
        const copierArgs = ['copy', '--trust', '--force', '--answers-file', '.agent-standard/copier-answers.yml', '--vcs-ref', revision.ref]
        for (const [key, value] of Object.entries(data)) copierArgs.push('--data', `${key}=${value}`)
        copierArgs.push(source, stage)
        run('uvx', uvxToolArgs('copier', copierArgs))

        const renderedManifest = readJson(join(stage, '.agent-standard/manifest.json'))
        if (renderedManifest.standardVersion !== standardVersion || renderedManifest.standardRevision !== revision.revision) {
          throw new Error('rendered manifest identity does not match the executing product version and requested revision')
        }
        const files = existing ? changedFiles(stage) : filesBelow(stage).sort()
        plan = classifyAdoptionChanges(target, stage, files)
        assessedDestinations = snapshotPaths(target, [...plan.create, ...plan.merge])
        blockers.push(...plan.blockers)
        rendered = true
        const unique = uniqueBlockers(blockers)
        blockers.length = 0
        blockers.push(...unique)
        printAssessment({ existing, target, revision, plan, blockers, rendered })

        if (dryRun || (!apply && (!stdin.isTTY || !stdout.isTTY))) {
          console.log('\nAssessment complete; destination was not changed.')
          return 0
        }
        if (blockers.length) {
          console.log('\nNo files were applied.')
          return apply ? 2 : 0
        }
        if (!apply && !(await confirmApply())) {
          console.log('\nDeclined; destination was not changed.')
          return 0
        }

        const filesToApply = [...plan.create, ...plan.merge].sort()
        if (existing) {
          const currentHead = git(target, ['rev-parse', 'HEAD'])
          const currentStatus = git(target, ['status', '--porcelain=v1', '--untracked-files=all'])
          if (currentHead !== repository.head || currentStatus) throw new Error('destination changed or is not clean immediately before application; no files were applied')
        } else if (existsSync(target) && readdirSync(target).length > 0) {
          throw new Error('destination became non-empty during staging; no files were applied')
        }
        if (!snapshotsEqual(assessedDestinations, snapshotPaths(target, filesToApply))) {
          throw new Error('a collision-sensitive destination changed immediately before application; no files were applied')
        }
        const refreshedPlan = classifyAdoptionChanges(target, stage, filesToApply)
        const refreshedOwnership = existing ? ownershipBlockers(target, { workflow }) : []
        if (refreshedPlan.blockers.length || refreshedOwnership.length) {
          console.log('\nApplication was blocked by a fresh collision assessment; no files were applied.')
          return 2
        }
        if (!existsSync(target)) mkdirSync(target, { recursive: true })
        copyAtomically(stage, target, filesToApply, backup)
        console.log(`\nApplied agent-standard ${standardVersion} (${revision.revision}) to ${target}.`)
        console.log('Next: install dependencies, refresh the SBOM, run verification, review the complete diff, and commit it as one change.')
        console.log('If immediate recovery is needed before committing, use the documented Git recovery procedure in docs/runbook.md.')
        return 0
      }
    }

    const unique = uniqueBlockers(blockers)
    printAssessment({ existing, target, revision, plan, blockers: unique, rendered })
    console.log('\nAssessment complete; destination was not changed.')
    return apply ? 2 : 0
  } finally {
    if (worktree && stage) {
      try { git(target, ['worktree', 'remove', '--force', stage], false) } catch { console.warn(`warning: remove temporary worktree manually: ${stage}`) }
    }
    if (tempRoot && existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true })
  }
}

function targetAndRest () {
  let target = '.'
  if (cliArgs[0] && !cliArgs[0].startsWith('-')) target = cliArgs.shift()
  return { target: resolve(target), rest: cliArgs.slice() }
}

function localScript (target, name) {
  const path = join(target, '.agent-standard', 'scripts', name)
  if (!existsSync(path)) {
    throw new Error(`${target} is not an agent-standard repository (missing .agent-standard/scripts/${name}); run from the repository root or pass its path`)
  }
  return path
}

function passthrough (name) {
  const { target, rest } = targetAndRest()
  const result = spawnSync(process.execPath, [localScript(target, name), ...rest], { cwd: target, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
}

function update () {
  const requestedRef = option('--ref')
  const development = flag('--development')
  const dryRun = flag('--dry-run')
  const targetArgument = cliArgs.shift() || '.'
  if (cliArgs.length) throw new Error(`unexpected arguments: ${cliArgs.join(' ')}`)

  const target = resolve(targetArgument)
  let repositoryRoot
  try { repositoryRoot = resolve(git(target, ['rev-parse', '--show-toplevel'])) }
  catch { throw new Error('update must run inside a Git repository; initialise Git or pass the repository path') }
  const sameRoot = process.platform === 'win32'
    ? repositoryRoot.toLowerCase() === target.toLowerCase()
    : repositoryRoot === target
  if (!sameRoot) throw new Error('update must target the Git repository root')
  if (!existsSync(join(target, '.agent-standard', 'copier-answers.yml'))) {
    throw new Error('no agent-standard answers file found; run "agent-standard init" first')
  }
  const revision = assessRevision(requestedRef, development)
  if (revision.blocker) throw new Error(revision.blocker.message)
  if (git(target, ['status', '--porcelain'])) throw new Error('update requires a clean worktree; commit or stash current changes')
  const initialHead = git(target, ['rev-parse', 'HEAD'])

  const tempRoot = mkdtempSync(join(tmpdir(), 'agent-standard-update-'))
  const stage = join(tempRoot, 'stage')
  const backup = join(tempRoot, 'backup')
  let worktree = false
  try {
    git(target, ['worktree', 'add', '--detach', stage, 'HEAD'], false)
    worktree = true
    run('uvx', uvxToolArgs('copier', [
      'update', '--trust', '--defaults',
      '--answers-file', '.agent-standard/copier-answers.yml',
      '--vcs-ref', revision.ref,
      '--data', `standard_revision=${revision.revision}`,
      stage
    ]))

    const files = changedFiles(stage)
    console.log(`\nagent-standard update: ${files.length} files`)
    for (const path of files) console.log(`  ${path}`)
    if (dryRun) {
      console.log('\nDry run complete; destination was not changed.')
      return
    }
    if (!files.length) {
      console.log('\nAlready up to date; nothing to apply.')
      return
    }
    if (git(target, ['status', '--porcelain']) || git(target, ['rev-parse', 'HEAD']) !== initialHead) {
      throw new Error('destination changed during staging; no files were applied')
    }
    copyAtomically(stage, target, files, backup)
    console.log(`\nUpdated agent-standard in ${target}.`)
    console.log('Next: review the diff, reinstall if dependency manifests changed, refresh the SBOM, and run "agent-standard verify".')
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
    if (command === 'init') process.exitCode = await init()
    else if (command === 'update') update()
    else if (command === 'verify') passthrough('verify.mjs')
    else if (command === 'doctor') passthrough('doctor.mjs')
    else { usage(); if (command && !['help', '--help', '-h'].includes(command)) process.exitCode = 1 }
  } catch (error) {
    console.error(`agent-standard: ${error.message}`)
    process.exitCode = 1
  }
}
