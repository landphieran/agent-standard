#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

const root = process.env.AGENT_STANDARD_ROOT || process.cwd()
const findings = []
const note = message => findings.push(message)

function json (relative) {
  const path = resolve(root, relative)
  if (!existsSync(path)) { note(`${relative} is missing`); return null }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { note(`${relative} is invalid JSON: ${error.message}`); return null }
}

function tracked (relative) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relative], { cwd: root, stdio: 'ignore' })
    return true
  } catch { return false }
}

function markdownFiles (dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? markdownFiles(path) : extname(entry.name) === '.md' ? [path] : []
  })
}

function checkLinks () {
  for (const path of markdownFiles(root)) {
    if (['node_modules', '.git', '.venv', '.next'].some(name => path.includes(`${resolve(root, name)}`))) continue
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0]
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      if (!existsSync(resolve(dirname(path), decodeURIComponent(target)))) note(`${path.slice(root.length + 1)} links to missing ${target}`)
    }
  }
}

function checkSkills (names) {
  for (const name of names || []) {
    const relative = `.ruler/skills/${name}/SKILL.md`
    if (!existsSync(resolve(root, relative))) { note(`${relative} is missing`); continue }
    if (existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
    const text = readFileSync(resolve(root, relative), 'utf8').replace(/\r\n/g, '\n')
    if (!text.startsWith('---\n') || !new RegExp(`^name: ${name}$`, 'm').test(text) || !/^description: .+/m.test(text)) {
      note(`${relative} needs valid name and description frontmatter`)
    }
  }
}

function checkDocumentMetadata (documents) {
  const fields = ['id', 'type', 'status', 'owner', 'scope', 'last_verified', 'verified_against']
  for (const relative of documents || []) {
    if (!relative.startsWith('docs/')) continue
    const path = resolve(root, relative)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    if (!text.startsWith('---\n')) { note(`${relative} is missing governance frontmatter`); continue }
    const frontmatter = text.split('\n---\n', 1)[0]
    for (const field of fields) if (!new RegExp(`^${field}:\\s*\\S+`, 'm').test(frontmatter)) note(`${relative} is missing metadata field ${field}`)
  }
}

function checkPropagatedSkills (manifest) {
  const targets = new Set()
  if (manifest.agents?.includes('claude') || manifest.agents?.includes('copilot')) targets.add('.claude/skills')
  if (manifest.agents?.includes('codex')) targets.add('.agents/skills')
  for (const target of targets) {
    for (const name of manifest.skills || []) {
      const relative = `${target}/${name}/SKILL.md`
      if (!existsSync(resolve(root, relative))) note(`${relative} was not propagated by Ruler`)
      else if (existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
    }
  }
}

function main () {
  const manifest = json('.agent-standard/manifest.json')
  if (!manifest) return 1
  if (manifest.schemaVersion !== 1) note('manifest schemaVersion must be 1')
  if (!['AS-1', 'AS-2', 'AS-3', 'AS-4'].includes(manifest.conformanceLevel)) note('manifest conformanceLevel is invalid')
  const required = [
    'AGENTS.md', '.agent-standard/manifest.schema.json', '.agent-standard/gate.json', '.agent-standard/waivers.json',
    '.agent-standard/scripts/doctor.mjs', '.agent-standard/scripts/sbom.mjs', '.agent-standard/scripts/sync-skills.mjs',
    ...(manifest.documents || [])
  ]
  if (manifest.agents?.includes('claude')) required.push('CLAUDE.md')
  for (const relative of new Set(required)) {
    if (!existsSync(resolve(root, relative))) note(`${relative} is missing`)
    else if (existsSync(resolve(root, '.git')) && !tracked(relative)) note(`${relative} is not tracked by git`)
  }
  checkSkills(manifest.skills)
  checkPropagatedSkills(manifest)
  checkDocumentMetadata(manifest.documents)
  checkLinks()
  const sbom = spawnSync(process.execPath, [resolve(root, '.agent-standard/scripts/sbom.mjs'), '--check'], { cwd: root, encoding: 'utf8' })
  if (sbom.status !== 0) note((sbom.stderr || sbom.stdout || 'SBOM check failed').trim())

  const result = { ok: findings.length === 0, conformanceLevel: manifest.conformanceLevel, findings }
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else if (result.ok) console.log(`agent-standard doctor: ${manifest.conformanceLevel} conformant`)
  else console.error(`agent-standard doctor findings:\n- ${findings.join('\n- ')}`)
  return result.ok ? 0 : 1
}

process.exitCode = main()
