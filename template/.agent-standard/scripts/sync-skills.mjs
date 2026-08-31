#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const readJson = path => {
  const text = readFileSync(path, 'utf8')
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
}
const manifest = readJson(resolve(root, '.agent-standard/manifest.json'))
const source = resolve(root, '.ruler/skills')
const trackerPath = resolve(root, '.agent-standard/managed-skills.json')

const targetFor = { claude: '.claude/skills', codex: '.agents/skills', copilot: '.github/skills' }
const knownTargets = new Set(Object.values(targetFor))
const targets = []
for (const agent of manifest.agents || []) {
  const target = targetFor[agent]
  if (target && !targets.includes(target)) targets.push(target)
}

const currentSkills = existsSync(source)
  ? readdirSync(source, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(resolve(source, entry.name, 'SKILL.md')))
      .map(entry => entry.name)
  : []

// Prune copies a previous run placed that no longer belong: a renamed or removed
// skill, or a target whose agent is no longer enabled. Only names this script
// recorded as managed are ever deleted, so user- and OpenSpec-owned skills are safe.
const prior = existsSync(trackerPath)
  ? (() => { try { return readJson(trackerPath) } catch { return { skills: [], targets: [] } } })()
  : { skills: [], targets: [] }
for (const priorTarget of prior.targets || []) {
  if (!knownTargets.has(priorTarget)) continue
  for (const priorSkill of prior.skills || []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(priorSkill)) continue // never resolve a tampered path
    const stillManaged = targets.includes(priorTarget) && currentSkills.includes(priorSkill)
    if (!stillManaged) rmSync(resolve(root, priorTarget, priorSkill), { recursive: true, force: true })
  }
}

for (const target of targets) {
  for (const name of currentSkills) {
    const destination = resolve(root, target, name)
    mkdirSync(destination, { recursive: true })
    cpSync(resolve(source, name), destination, { recursive: true, force: true })
  }
  console.log(`synchronized repository skills to ${target}`)
}

mkdirSync(resolve(root, '.agent-standard'), { recursive: true })
writeFileSync(trackerPath, `${JSON.stringify({ skills: currentSkills, targets }, null, 2)}\n`)
