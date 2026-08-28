#!/usr/bin/env node
/**
 * Cross-client definition-of-done gate. Claude invokes it as a Stop hook; CI
 * invokes the same file with --ci. Configuration is data in gate.json.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const isCI = args.includes('--ci')
const root = process.env.CLAUDE_PROJECT_DIR || process.env.AGENT_STANDARD_ROOT || process.cwd()
const argValue = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null }

function git (gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function gitOk (gitArgs) {
  try { git(gitArgs); return true } catch { return false }
}

function commandOk (command) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' })
  return result.status === 0
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

function usableBase (candidate, head) {
  if (!candidate || /^0+$/.test(candidate) || !gitOk(['cat-file', '-e', `${candidate}^{commit}`])) {
    try { return git(['rev-list', '--max-parents=0', head]).split('\n')[0] } catch { return null }
  }
  return candidate
}

function range () {
  const head = argValue('--head') || process.env.DOD_HEAD || 'HEAD'
  const base = usableBase(argValue('--base') || process.env.DOD_BASE || 'origin/main', head)
  return { base, head }
}

function changedFiles () {
  if (!gitOk(['rev-parse', '--is-inside-work-tree'])) return null
  if (isCI) {
    const { base, head } = range()
    if (!base) return null
    return [...new Set(normalise(git(['diff', '--name-only', base, head])))]
  }
  if (!gitOk(['rev-parse', 'HEAD'])) return null
  return [...new Set([...normalise(git(['diff', '--name-only', 'HEAD'])), ...normalise(git(['ls-files', '--others', '--exclude-standard']))])]
}

const isTestPath = path => /(\.test\.|\.spec\.|(^|\/)test_[^/]*\.py$|_test\.py$)/.test(path)

function activeWaiver (cfg, source) {
  const path = resolve(root, cfg.waiversFile || '.agent-standard/waivers.json')
  if (!existsSync(path)) return false
  try {
    const entries = JSON.parse(readFileSync(path, 'utf8')).noTests || []
    return entries.some(entry => {
      const complete = entry.id && entry.owner && entry.reason && entry.expires && Array.isArray(entry.paths)
      const current = Date.parse(entry.expires) >= Date.now()
      return complete && current && source.every(file => matchesAny(file, entry.paths))
    })
  } catch { return false }
}

function baselineFindings (cfg) {
  const findings = []
  if (cfg.doctorCommand && !commandOk(cfg.doctorCommand)) findings.push(`Repository conformance failed: \`${cfg.doctorCommand}\`.`)
  return findings
}

function main () {
  if (!isCI) {
    const stdin = (() => { try { return readFileSync(0, 'utf8') } catch { return '' } })()
    if (stdin) { try { if (JSON.parse(stdin).stop_hook_active) return 0 } catch { /* malformed hook input is ignored */ } }
  }

  const configPath = resolve(root, '.agent-standard/gate.json')
  if (!existsSync(configPath)) return 0
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
  const mode = cfg.mode || 'strict'
  const findings = isCI ? baselineFindings(cfg) : []
  const changed = changedFiles()
  if (changed === null) return finish(findings, mode)

  const source = changed.filter(file => matchesAny(file, cfg.sourceGlobs) && !isTestPath(file) &&
    !matchesAny(file, cfg.unitTestGlobs) && !matchesAny(file, cfg.integrationTestGlobs))

  if (source.length) {
    const unit = cfg.unitTestGlobs || []
    const integration = cfg.integrationTestGlobs || []
    const testsChanged = changed.filter(file => matchesAny(file, unit) || matchesAny(file, integration))
    if (!activeWaiver(cfg, source) && testsChanged.length === 0) {
      findings.push(`Source changed (${source.slice(0, 3).join(', ')}${source.length > 3 ? ', ...' : ''}) but no recognised test changed. Add a test or a time-bounded waiver with owner and reason.`)
    }
    const misplaced = changed.filter(file => isTestPath(file) && !matchesAny(file, unit) && !matchesAny(file, integration))
    if (misplaced.length) findings.push(`Tests are outside recognised locations: ${misplaced.join(', ')}.`)

    if (cfg.openspec && existsSync(resolve(root, 'openspec/changes'))) {
      const active = readdirSync(resolve(root, 'openspec/changes'), { withFileTypes: true })
        .some(entry => entry.isDirectory() && entry.name !== 'archive')
      if (active && cfg.openspecValidateCommand && !commandOk(cfg.openspecValidateCommand)) {
        findings.push(`OpenSpec validation failed: \`${cfg.openspecValidateCommand}\`.`)
      }
    }

    const testCommand = isCI ? (cfg.fullCommand || cfg.unitCommand) : (cfg.unitCommand || cfg.fullCommand)
    if (testCommand && findings.length === 0 && !commandOk(testCommand)) findings.push(`Verification failed: \`${testCommand}\`.`)
  }

  return finish(findings, mode)
}

function finish (findings, mode) {
  if (!findings.length) return 0
  const reason = `Definition-of-done gate findings:\n- ${findings.join('\n- ')}`
  if (mode === 'advisory') { console.error(`[agent-standard advisory]\n${reason}`); return 0 }
  if (isCI) { console.error(reason); return 1 }
  console.log(JSON.stringify({ decision: 'block', reason }))
  return 0
}

process.exitCode = main()
