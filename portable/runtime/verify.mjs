#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const findings = []

function readJson (relative) {
  const path = resolve(root, relative)
  if (!existsSync(path)) {
    findings.push(`${relative} is missing`)
    return null
  }
  try { return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) } catch (error) {
    findings.push(`${relative} is invalid JSON: ${error.message}`)
    return null
  }
}

function commandOk (command) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' })
  if (result.error) findings.push(`${command} could not start: ${result.error.message}`)
  return result.status === 0
}

function main () {
  const manifest = readJson('.agent-standard/manifest.json')
  const gate = readJson('.agent-standard/gate.json')
  if (!manifest || !gate) return 1

  if (manifest.workflow?.profile !== 'lightweight' || manifest.workflow?.engine !== 'native') {
    findings.push('portable bundles support the lightweight workflow only')
  }
  if (!['npm', 'pip'].includes(manifest.project?.packageManager)) {
    findings.push('portable bundles require npm or pip as the project package manager')
  }
  if (!existsSync(resolve(root, 'AGENTS.md'))) findings.push('AGENTS.md is missing')
  if (manifest.agents?.includes('claude') && !existsSync(resolve(root, 'CLAUDE.md'))) findings.push('CLAUDE.md is missing')
  for (const name of ['bootstrap.mjs', 'sync-skills.mjs', 'merge-config.mjs', 'doctor.mjs']) {
    if (existsSync(resolve(root, '.agent-standard/scripts', name))) findings.push(`unsupported setup script is present: ${name}`)
  }
  if (manifest.project?.packageManager === 'pip' && !existsSync(resolve(root, 'requirements.txt'))) {
    findings.push('requirements.txt is missing for the Python bundle')
  }

  if (findings.length) return finish()
  if (gate.fullCommand && !commandOk(gate.fullCommand)) findings.push(`verification command failed: ${gate.fullCommand}`)
  const sbom = spawnSync(process.execPath, [resolve(root, '.agent-standard/scripts/sbom.mjs'), '--check'], { cwd: root, stdio: 'inherit' })
  if (sbom.status !== 0) findings.push('SBOM verification failed')
  return finish()
}

function finish () {
  if (!findings.length) {
    console.log('agent-standard portable verification: passed')
    return 0
  }
  console.error(`agent-standard portable verification failed:\n- ${findings.join('\n- ')}`)
  return 1
}

process.exitCode = main()
