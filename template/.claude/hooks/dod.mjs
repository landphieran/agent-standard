#!/usr/bin/env node
/**
 * agent-standard — definition-of-done gate.
 *
 * One script, two entry points that must reach the SAME verdict:
 *   - Claude Code Stop hook (local, default): reads the hook JSON on stdin and,
 *     in strict mode, blocks the model from stopping via {"decision":"block"}.
 *   - CI (`--ci`): compares a base..head range and exits non-zero on any finding,
 *     which is what actually enforces the standard (the local hook is bypassable).
 *
 * It reads `.agent-standard/gate.json` for the stack's globs and commands, so the
 * logic here is stack-agnostic — the conventions are data, not code.
 *
 * Design rules (see docs/architecture.md):
 *   - It must pass trivially when there is nothing to check (clean tree, docs-only
 *     change, or a freshly rendered repo). Enforcement only kicks in once source
 *     changed.
 *   - Local runs check unit tests only (fast — a slow hook gets disabled); CI runs
 *     the full suite.
 *   - `advisory` mode never blocks; it reports and exits 0.
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const isCI = args.includes('--ci')
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const argVal = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

function sh (cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function shOk (cmd) { try { sh(cmd); return true } catch { return false } }

/** Minimal path-aware glob → RegExp: supports **, *, ?. Zero deps on purpose. */
function globToRe (glob) {
  let re = '^'
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { re += '(?:[^/]*/)*'; i += 2 } else { re += '.*'; i += 1 }
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c
    else re += c
  }
  return new RegExp(re + '$')
}
const matchesAny = (path, globs) => (globs || []).some(g => globToRe(g).test(path))

/** Files changed in the range under scrutiny (normalised to forward slashes). */
function changedFiles () {
  let out
  if (isCI) {
    const base = argVal('--base') || process.env.DOD_BASE || 'origin/main'
    const head = argVal('--head') || process.env.DOD_HEAD || 'HEAD'
    out = [sh(`git diff --name-only ${base} ${head}`)]
  } else {
    // local: working tree + staged vs HEAD, plus new untracked files
    out = [sh('git diff --name-only HEAD'), sh('git ls-files --others --exclude-standard')]
  }
  return [...new Set(out.join('\n').split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean))]
}

const isTestPath = f => /(\.test\.|\.spec\.|(^|\/)test_[^/]*\.py$|_test\.py$)/.test(f)

/** True if a commit under scrutiny opts out of the test requirement. */
function hasSkipTrailer () {
  try {
    const range = isCI
      ? `${argVal('--base') || process.env.DOD_BASE || 'origin/main'}..${argVal('--head') || process.env.DOD_HEAD || 'HEAD'}`
      : '-1'
    return /no-tests-needed/i.test(sh(`git log --format=%B ${range}`))
  } catch { return false }
}

function main () {
  // Loop guard: Claude re-invokes the Stop hook after a block; never re-block.
  if (!isCI) {
    const stdin = (() => { try { return readFileSync(0, 'utf8') } catch { return '' } })()
    if (stdin) { try { if (JSON.parse(stdin).stop_hook_active) return 0 } catch { /* ignore */ } }
  }

  const cfgPath = resolve(root, '.agent-standard/gate.json')
  if (!existsSync(cfgPath)) return 0 // not configured here → do nothing
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  const mode = cfg.mode || 'strict'

  const changed = changedFiles()
  const source = changed.filter(f => matchesAny(f, cfg.sourceGlobs) && !isTestPath(f) &&
    !matchesAny(f, cfg.unitTestGlobs) && !matchesAny(f, cfg.integrationTestGlobs))

  // Precondition: no source changes → nothing to gate. Passes trivially.
  if (source.length === 0) return 0

  const findings = []
  const unit = cfg.unitTestGlobs || []
  const integ = cfg.integrationTestGlobs || []

  // Escape hatch for legitimate no-test changes (pure plumbing, generated code):
  // env DOD_ALLOW_NO_TESTS=1, or a `no-tests-needed` trailer in the change's commits.
  const overridden = process.env.DOD_ALLOW_NO_TESTS === '1' || hasSkipTrailer()

  // 1. Tests accompany the source change.
  const testsChanged = changed.filter(f => matchesAny(f, unit) || matchesAny(f, integ))
  if (!overridden && testsChanged.length === 0) {
    findings.push(`Source changed (${source.slice(0, 3).join(', ')}${source.length > 3 ? ', …' : ''}) but no test was added or updated. ` +
      `Add a unit test (${unit[0] || 'unit location'}) or an integration test (${integ[0] || 'integration location'}).`)
  }

  // 2. Any changed test file sits in a recognised location/type.
  const misplaced = changed.filter(f => isTestPath(f) && !matchesAny(f, unit) && !matchesAny(f, integ))
  if (misplaced.length) {
    findings.push(`Test(s) not in a recognised location/type: ${misplaced.join(', ')}. ` +
      `Unit → ${unit.join(' | ') || '(none)'}; integration → ${integ.join(' | ') || '(none)'}.`)
  }

  // 3. OpenSpec change is valid — only when wired and a change is in flight.
  if (cfg.openspec && existsSync(resolve(root, 'openspec/changes'))) {
    const active = readdirSync(resolve(root, 'openspec/changes'), { withFileTypes: true })
      .some(d => d.isDirectory() && d.name !== 'archive')
    if (active && !shOk(cfg.openspecValidateCmd || 'npx --no-install openspec validate --strict')) {
      findings.push('OpenSpec change is missing or invalid — run `openspec validate --strict`.')
    }
  }

  // 4. Tests pass. Structure first (fast fail); run only if structure is sound.
  const testCmd = isCI ? (cfg.fullCommand || cfg.unitCommand) : (cfg.unitCommand || cfg.fullCommand)
  if (testCmd && findings.length === 0 && !shOk(testCmd)) {
    findings.push(`Tests failed: \`${testCmd}\`. Green tests are part of "done".`)
  }

  if (findings.length === 0) return 0

  const reason = 'Definition-of-done gate — not done yet:\n- ' + findings.join('\n- ')
  if (isCI) { console.error(reason); return 1 }
  if (mode === 'advisory') { console.error('[agent-standard · advisory]\n' + reason); return 0 }
  console.log(JSON.stringify({ decision: 'block', reason })) // strict local → keep Claude working
  return 0
}

process.exit(main())
