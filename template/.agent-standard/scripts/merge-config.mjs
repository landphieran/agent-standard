#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const manifest = readJson(resolve(root, '.agent-standard/manifest.json'))

function validateInputs () {
  if (!Array.isArray(manifest.agents) || !manifest.agents.length || manifest.agents.some(agent => !['claude', 'codex', 'copilot'].includes(agent))) {
    throw new Error('manifest agents must contain supported client names')
  }
  if (!/^@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?:\s+@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)*$/.test(manifest.governance?.codeowners || '')) {
    throw new Error('manifest governance.codeowners must contain GitHub users or teams')
  }
  if (!['lightweight', 'spec-driven'].includes(manifest.workflow?.profile)) throw new Error('manifest workflow profile is invalid')
  if (manifest.agents.includes('claude') && existsSync(resolve(root, '.claude/settings.json'))) readJson(resolve(root, '.claude/settings.json'))
  for (const [relative, start, end] of [
    ['.github/CODEOWNERS', '# agent-standard:start', '# agent-standard:end'],
    ['.github/pull_request_template.md', '<!-- agent-standard:start -->', '<!-- agent-standard:end -->']
  ]) {
    const path = resolve(root, relative)
    const text = existsSync(path) ? readFileSync(path, 'utf8') : ''
    const starts = text.split(start).length - 1
    const ends = text.split(end).length - 1
    if (starts !== ends || starts > 1) throw new Error(`${relative} has malformed or duplicate agent-standard markers`)
  }
}

function writeJson (relative, value) {
  const path = resolve(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function mergeClaudeSettings () {
  if (!manifest.agents.includes('claude')) return
  const relative = '.claude/settings.json'
  const path = resolve(root, relative)
  const settings = existsSync(path) ? readJson(path) : {}
  settings.hooks ||= {}
  settings.hooks.Stop = Array.isArray(settings.hooks.Stop) ? settings.hooks.Stop : []
  const command = 'node .agent-standard/scripts/dod.mjs'
  const legacyCommand = 'node .claude/hooks/dod.mjs'
  settings.hooks.Stop = settings.hooks.Stop.flatMap(group => {
    if (!Array.isArray(group?.hooks)) return [group]
    const hooks = group.hooks.filter(hook => !(hook?.type === 'command' && hook.command === legacyCommand))
    return hooks.length ? [{ ...group, hooks }] : []
  })
  const present = settings.hooks.Stop.some(group => Array.isArray(group?.hooks) &&
    group.hooks.some(hook => hook?.type === 'command' && hook.command === command))
  if (!present) settings.hooks.Stop.push({ hooks: [{ type: 'command', command }] })
  writeJson(relative, settings)
  console.log(`merged agent-standard hook into ${relative}`)
}

function mergeCodeowners () {
  const owner = manifest.governance?.codeowners
  const relative = '.github/CODEOWNERS'
  const path = resolve(root, relative)
  const start = '# agent-standard:start'
  const end = '# agent-standard:end'
  const block = [
    start,
    `/.github/CODEOWNERS ${owner}`,
    `/.github/dependabot.yml ${owner}`,
    `/.github/workflows/ ${owner}`,
    `/.github/skills/ ${owner}`,
    `/.github/prompts/ ${owner}`,
    `/.agent-standard/ ${owner}`,
    `/.ruler/ ${owner}`,
    `/.agents/ ${owner}`,
    `/.claude/ ${owner}`,
    `/openspec/ ${owner}`,
    `/AGENTS.md ${owner}`,
    `/CLAUDE.md ${owner}`,
    `/SECURITY.md ${owner}`,
    `/docs/agent-standard.md ${owner}`,
    `/docs/changes/ ${owner}`,
    end
  ].join('\n')
  let text = existsSync(path) ? readFileSync(path, 'utf8').replace(/^\uFEFF/, '') : ''
  const starts = text.split(start).length - 1
  const ends = text.split(end).length - 1
  if (starts !== ends || starts > 1) throw new Error(`${relative} has malformed or duplicate agent-standard markers`)
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  text = pattern.test(text) ? text.replace(pattern, block) : `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}\n`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`)
  console.log(`merged agent-standard ownership into ${relative}`)
}

function mergePullRequestTemplate () {
  const relative = '.github/pull_request_template.md'
  const path = resolve(root, relative)
  const start = '<!-- agent-standard:start -->'
  const end = '<!-- agent-standard:end -->'
  const workflowCheck = manifest.workflow?.profile === 'spec-driven'
    ? '- [ ] The OpenSpec change is linked and validates.'
    : '- [ ] Acceptance criteria are stated and satisfied.'
  const block = [
    start,
    '## Agent-standard checks',
    '',
    workflowCheck,
    '- [ ] Tests cover the behavior, or an owned expiring waiver is included.',
    '- [ ] Documentation and ADRs are current.',
    '- [ ] Dependency changes include the lockfile and refreshed SBOM.',
    '- [ ] The manifest verification command passes.',
    end
  ].join('\n')
  let text = existsSync(path) ? readFileSync(path, 'utf8').replace(/^\uFEFF/, '') : ''
  const starts = text.split(start).length - 1
  const ends = text.split(end).length - 1
  if (starts !== ends || starts > 1) throw new Error(`${relative} has malformed or duplicate agent-standard markers`)
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`)
  text = pattern.test(text) ? text.replace(pattern, block) : `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}\n`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`)
  console.log(`merged agent-standard checks into ${relative}`)
}

try {
  validateInputs()
  mergeClaudeSettings()
  mergeCodeowners()
  mergePullRequestTemplate()
} catch (error) {
  console.error(`agent-standard configuration merge failed: ${error.message}`)
  process.exitCode = 1
}
