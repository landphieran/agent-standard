#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.env.AGENT_STANDARD_ROOT || process.cwd()
const manifest = JSON.parse(readFileSync(resolve(root, '.agent-standard/manifest.json'), 'utf8'))
const source = resolve(root, '.ruler/skills')
const targets = new Set()

if (manifest.agents.includes('claude') || manifest.agents.includes('copilot')) targets.add('.claude/skills')
if (manifest.agents.includes('codex')) targets.add('.agents/skills')

if (existsSync(source)) {
  for (const target of targets) {
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (!entry.isDirectory() || !existsSync(resolve(source, entry.name, 'SKILL.md'))) continue
      const destination = resolve(root, target, entry.name)
      mkdirSync(destination, { recursive: true })
      cpSync(resolve(source, entry.name), destination, { recursive: true, force: true })
    }
    console.log(`synchronized repository skills to ${target}`)
  }
}
