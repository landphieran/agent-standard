#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const manifest = JSON.parse(readFileSync(resolve(root, '.agent-standard/manifest.json'), 'utf8'))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function run (command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message || `exit code ${result.status ?? 'unknown'}`}`)
}

function main () {
  if (!Array.isArray(manifest.agents) || !manifest.agents.length || manifest.agents.some(agent => !['claude', 'codex', 'copilot'].includes(agent))) {
    throw new Error('manifest agents must contain supported client names')
  }
  if (!['lightweight', 'spec-driven'].includes(manifest.workflow?.profile)) throw new Error('manifest workflow profile is invalid')
  const agents = ['agentsmd', ...(manifest.agents || [])].join(',')
  run(npx, ['--yes', '@intellectronica/ruler@0.3.44', 'apply', '--local-only', '--no-skills', '--no-backup', '--gitignore=false', '--agents', agents])
  run(process.execPath, ['.agent-standard/scripts/sync-skills.mjs'])

  if (manifest.workflow?.profile === 'spec-driven') {
    const tools = manifest.agents.map(agent => agent === 'copilot' ? 'github-copilot' : agent).join(',')
    run(npx, ['--yes', '@fission-ai/openspec@1.11.0', 'init', '--tools', tools, '--force', '--no-animation'])
  }

  run(process.execPath, ['.agent-standard/scripts/merge-config.mjs'])
  run(process.execPath, ['.agent-standard/scripts/sbom.mjs', '--write'])
  run(process.execPath, ['.agent-standard/scripts/doctor.mjs', '--setup'])
  console.log('agent-standard bootstrap: complete')
}

try { main() } catch (error) { console.error(`agent-standard bootstrap failed: ${error.message}`); process.exitCode = 1 }
