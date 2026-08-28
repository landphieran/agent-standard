#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'
const result = spawnSync(shell, ['-NoProfile', '-File', resolve('scripts/verify-render.ps1'), ...process.argv.slice(2)], {
  stdio: 'inherit'
})

if (result.error) console.error(`render verifier could not start ${shell}: ${result.error.message}`)
process.exitCode = result.status ?? 1
