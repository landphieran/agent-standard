#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const setup = process.argv.includes('--setup')

function runFile (file, args = []) {
  const result = spawnSync(process.execPath, [resolve(root, file), ...args], { cwd: root, stdio: 'inherit' })
  return result.status === 0
}

function runCommand (command) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' })
  return result.status === 0
}

function hasActiveOpenSpecChange () {
  const path = resolve(root, 'openspec/changes')
  return existsSync(path) && readdirSync(path, { withFileTypes: true })
    .some(entry => entry.isDirectory() && entry.name !== 'archive')
}

function main () {
  const gate = JSON.parse(readFileSync(resolve(root, '.agent-standard/gate.json'), 'utf8'))
  if (!runFile('.agent-standard/scripts/doctor.mjs', setup ? ['--setup'] : [])) return 1
  if (gate.fullCommand && !runCommand(gate.fullCommand)) return 1
  if (gate.openspec && hasActiveOpenSpecChange() && gate.openspecValidateCommand && !runCommand(gate.openspecValidateCommand)) return 1
  console.log('agent-standard verification: passed')
  return 0
}

try { process.exitCode = main() } catch (error) { console.error(`agent-standard verification failed: ${error.message}`); process.exitCode = 1 }
