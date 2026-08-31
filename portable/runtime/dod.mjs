#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const isCI = args.includes('--ci')
const policyOnly = args.includes('--policy-only')
const root = resolve(process.env.CLAUDE_PROJECT_DIR || process.env.AGENT_STANDARD_ROOT || process.cwd())
const argValue = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null }

function git (gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function gitOk (gitArgs) {
  try { git(gitArgs); return true } catch { return false }
}

function commandOk (command) {
  return spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' }).status === 0
}

function globToRegExp (glob) {
  let expression = '^'
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index]
    if (char === '*') {
      if (glob[index + 1] === '*') {
        if (glob[index + 2] === '/') { expression += '(?:[^/]*/)*'; index += 2 } else { expression += '.*'; index++ }
      } else expression += '[^/]*'
    } else if (char === '?') expression += '[^/]'
    else if ('.+^${}()|[]\\'.includes(char)) expression += `\\${char}`
    else expression += char
  }
  return new RegExp(`${expression}$`)
}

const matchesAny = (path, globs = []) => globs.some(glob => globToRegExp(glob).test(path))
const normalise = text => text.split('\n').map(value => value.trim().replace(/\\/g, '/')).filter(Boolean)
const isTestPath = path => /(\.test\.|\.spec\.|(^|\/)test_[^/]*\.py$|_test\.py$)/.test(path)

function usableBase (candidate, head) {
  if (!candidate || /^0+$/.test(candidate) || !gitOk(['cat-file', '-e', `${candidate}^{commit}`])) {
    try { return git(['rev-list', '--max-parents=0', head]).split('\n')[0] } catch { return null }
  }
  return candidate
}

function changedFiles () {
  if (!gitOk(['rev-parse', '--is-inside-work-tree'])) return null
  if (isCI) {
    const head = argValue('--head') || process.env.DOD_HEAD || 'HEAD'
    const base = usableBase(argValue('--base') || process.env.DOD_BASE || 'origin/main', head)
    if (!base) return null
    if (!gitOk(['rev-parse', '--verify', `${head}^`]) && git(['rev-parse', base]) === git(['rev-parse', head])) {
      return [...new Set(normalise(git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', head])))]
    }
    const from = (() => { try { return git(['merge-base', base, head]) } catch { return base } })()
    return [...new Set(normalise(git(['diff', '--name-only', from, head])))]
  }
  if (!gitOk(['rev-parse', 'HEAD'])) return null
  return [...new Set([...normalise(git(['diff', '--name-only', 'HEAD'])), ...normalise(git(['ls-files', '--others', '--exclude-standard']))])]
}

function activeWaiver (cfg, source) {
  const path = resolve(root, cfg.waiversFile || '.agent-standard/waivers.json')
  if (!existsSync(path)) return false
  try {
    const entries = JSON.parse(readFileSync(path, 'utf8')).noTests || []
    return entries.some(entry => entry.id && entry.owner && entry.reason && entry.expires && Array.isArray(entry.paths) &&
      Date.parse(entry.expires) >= Date.now() && source.every(file => matchesAny(file, entry.paths)))
  } catch { return false }
}

function main () {
  const configPath = resolve(root, '.agent-standard/gate.json')
  if (!existsSync(configPath)) return 0
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
  const mode = cfg.mode || 'strict'
  const changed = changedFiles()
  if (changed === null) return 0
  const findings = []
  const source = changed.filter(file => matchesAny(file, cfg.sourceGlobs) && !isTestPath(file) && !matchesAny(file, cfg.unitTestGlobs) && !matchesAny(file, cfg.integrationTestGlobs))
  if (source.length) {
    const testsChanged = changed.filter(file => matchesAny(file, cfg.unitTestGlobs) || matchesAny(file, cfg.integrationTestGlobs))
    if (!activeWaiver(cfg, source) && testsChanged.length === 0) findings.push(`Source changed (${source.slice(0, 3).join(', ')}) but no recognised test changed.`)
    const misplaced = changed.filter(file => isTestPath(file) && !matchesAny(file, cfg.unitTestGlobs) && !matchesAny(file, cfg.integrationTestGlobs))
    if (misplaced.length) findings.push(`Tests are outside recognised locations: ${misplaced.join(', ')}`)
    const command = isCI ? (cfg.fullCommand || cfg.unitCommand) : (cfg.unitCommand || cfg.fullCommand)
    if (!policyOnly && command && findings.length === 0 && !commandOk(command)) findings.push(`Verification failed: ${command}`)
  }
  if (!findings.length) return 0
  const reason = `Definition-of-done gate findings:\n- ${findings.join('\n- ')}`
  if (mode === 'advisory') { console.error(`[agent-standard advisory]\n${reason}`); return 0 }
  if (isCI) { console.error(reason); return 1 }
  console.log(JSON.stringify({ decision: 'block', reason }))
  return 0
}

process.exitCode = main()
