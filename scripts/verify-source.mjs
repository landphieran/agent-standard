#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const root = process.cwd()
const required = [
  'AGENTS.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'copier.yml',
  'template/.agent-standard/manifest.json.jinja',
  'template/.agent-standard/manifest.schema.json',
  'template/.agent-standard/scripts/doctor.mjs',
  'template/.agent-standard/scripts/sbom.mjs',
  'template/.agent-standard/scripts/sync-skills.mjs',
  'template/.claude/hooks/dod.mjs'
]
const findings = required.filter(path => !existsSync(resolve(root, path))).map(path => `${path} is missing`)

function filesBelow (relative) {
  const directory = resolve(root, relative)
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = `${relative}/${entry.name}`
    return entry.isDirectory() ? filesBelow(child) : [child]
  })
}

let manifest
try {
  manifest = JSON.parse(readFileSync(resolve(root, '.agent-standard/manifest.json'), 'utf8'))
} catch (error) {
  findings.push(`.agent-standard/manifest.json is invalid JSON: ${error.message}`)
}

if (manifest) {
  if (manifest.schemaVersion !== 1 || !['AS-1', 'AS-2', 'AS-3', 'AS-4'].includes(manifest.conformanceLevel)) {
    findings.push('source manifest has an unsupported schema or conformance level')
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) findings.push('source manifest must declare its generated skill catalog')
  for (const path of manifest.documents || []) if (!existsSync(resolve(root, path))) findings.push(`manifest document ${path} is missing`)
  for (const skill of manifest.skills || []) {
    if (!existsSync(resolve(root, `template/.ruler/skills/${skill}/SKILL.md`))) findings.push(`manifest skill ${skill} is missing from the template`)
  }
  const bom = manifest.supplyChain?.bom
  if (!bom || !['strict', 'advisory'].includes(bom.mode) || bom.formats?.length !== bom.files?.length) {
    findings.push('source manifest BOM configuration is invalid')
  }
}

for (const path of ['template/.claude/hooks/dod.mjs', 'template/.agent-standard/scripts/doctor.mjs', 'template/.agent-standard/scripts/sbom.mjs', 'template/.agent-standard/scripts/sync-skills.mjs']) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, path)], { encoding: 'utf8' })
  if (result.status !== 0) findings.push(`${path} has invalid JavaScript: ${(result.stderr || '').trim()}`)
}

const copier = readFileSync(resolve(root, 'copier.yml'), 'utf8')
if (!copier.includes('--gitignore=false')) findings.push('Ruler must keep generated agent files trackable')
if (!copier.includes('node .agent-standard/scripts/sbom.mjs --write')) findings.push('Copier must refresh the configured SBOM')
if (!/@fission-ai\/openspec@\d+\.\d+\.\d+/.test(copier)) findings.push('OpenSpec bootstrap must use an exact version')
if (!/@intellectronica\/ruler@\d+\.\d+\.\d+/.test(copier)) findings.push('Ruler bootstrap must use an exact version')

for (const path of [...filesBelow('.github'), ...filesBelow('template/.github')].filter(path => ['.yml', '.jinja'].includes(extname(path)))) {
  const workflow = readFileSync(resolve(root, path), 'utf8')
  for (const match of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
    if (!/^[a-f0-9]{40}$/.test(match[1])) findings.push(`${path} uses a mutable Action reference: ${match[0]}`)
  }
}

const sbom = spawnSync(process.execPath, [resolve(root, 'template/.agent-standard/scripts/sbom.mjs'), '--check'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, AGENT_STANDARD_ROOT: root }
})
if (sbom.status !== 0) findings.push((sbom.stderr || sbom.stdout || 'root SBOM check failed').trim())

if (findings.length) {
  console.error(`source verification findings:\n- ${findings.join('\n- ')}`)
  process.exitCode = 1
} else console.log('source verification: passed')
