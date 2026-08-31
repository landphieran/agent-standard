#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(process.env.AGENT_STANDARD_ROOT || process.cwd())
const args = new Set(process.argv.slice(2))
const manifestPath = resolve(root, '.agent-standard/manifest.json')

function readJson (path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
}

function fromPackageLock () {
  const path = resolve(root, 'package-lock.json')
  if (!existsSync(path)) return null
  const lock = readJson(path)
  return Object.entries(lock.packages || {})
    .filter(([location, value]) => location && value?.version)
    .map(([location, value]) => ({ name: value.name || location.split('node_modules/').at(-1), version: value.version, type: 'npm' }))
    .filter(item => item.name)
}

function fromPackageJson () {
  const path = resolve(root, 'package.json')
  if (!existsSync(path)) return null
  const pkg = readJson(path)
  return [pkg.dependencies || {}, pkg.devDependencies || {}, pkg.optionalDependencies || {}]
    .flatMap(group => Object.entries(group).map(([name, version]) => ({ name, version, type: 'npm' })))
}

function fromRequirements () {
  const path = resolve(root, 'requirements.txt')
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8').split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
    .map(line => line.match(/^([A-Za-z0-9_.-]+)\s*==\s*([A-Za-z0-9_.+!:-]+)$/))
    .filter(Boolean)
    .map(match => ({ name: match[1], version: match[2], type: 'pypi' }))
}

function fromPyproject () {
  const path = resolve(root, 'pyproject.toml')
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  const bodies = [...text.matchAll(/(?:dependencies|dev)\s*=\s*\[([^\]]*)\]/gs)].map(match => match[1])
  return bodies.flatMap(body => [...body.matchAll(/["']([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?([^"']*)["']/g)]
    .map(match => ({ name: match[1], version: match[2].trim().replace(/^[~^<>=! ]+/, '') || 'NOASSERTION', type: 'pypi' })))
}

function dependencies (manifest) {
  const raw = manifest.project?.packageManager === 'pip'
    ? (fromRequirements() || fromPyproject() || [])
    : (fromPackageLock() || fromPackageJson() || [])
  const projectNames = new Set([manifest.project?.name, manifest.project?.packageName]
    .filter(Boolean).map(value => value.toLowerCase().replace(/[-_.]+/g, '-')))
  const unique = new Map(raw.map(item => [`${item.type}:${item.name}@${item.version}`, item]))
  return [...unique.values()]
    .filter(item => !projectNames.has(item.name.toLowerCase().replace(/[-_.]+/g, '-')))
    .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
}

function slug (value) {
  return value.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'package'
}

function purl (item) {
  const name = item.name.startsWith('@') ? item.name.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(item.name)
  return `pkg:${item.type}/${name}@${encodeURIComponent(item.version)}`
}

function cycloneDx (manifest, deps) {
  return {
    $schema: 'https://cyclonedx.org/schema/bom-1.7.schema.json',
    bomFormat: 'CycloneDX', specVersion: '1.7', serialNumber: `urn:uuid:${randomUUID()}`, version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: { components: [{ type: 'application', name: 'agent-standard', version: manifest.standardVersion }] },
      component: { type: 'application', name: manifest.project.name, version: '0.1.0' }
    },
    components: deps.map(item => ({ type: 'library', name: item.name, version: item.version, purl: purl(item) }))
  }
}

function spdx (manifest, deps) {
  return {
    spdxVersion: 'SPDX-2.3', dataLicense: 'CC0-1.0', SPDXID: 'SPDXRef-DOCUMENT',
    name: `${manifest.project.name}-sbom`,
    documentNamespace: `https://spdx.org/spdxdocs/${encodeURIComponent(manifest.project.packageName)}-${randomUUID()}`,
    creationInfo: { created: new Date().toISOString(), creators: [`Tool: agent-standard-${manifest.standardVersion}`] },
    packages: deps.map((item, index) => ({
      name: item.name, SPDXID: `SPDXRef-Package-${slug(item.name)}-${index + 1}`, versionInfo: item.version,
      downloadLocation: 'NOASSERTION', filesAnalyzed: false, licenseConcluded: 'NOASSERTION', licenseDeclared: 'NOASSERTION',
      externalRefs: [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: purl(item) }]
    }))
  }
}

function identities (format, value) {
  if (format === 'cyclonedx-json') {
    if (value?.bomFormat !== 'CycloneDX' || !Array.isArray(value?.components)) throw new Error('expected CycloneDX JSON with a components array')
    return value.components.map(item => `${item.name}@${item.version}`).sort()
  }
  if (value?.spdxVersion !== 'SPDX-2.3' || !Array.isArray(value?.packages)) throw new Error('expected SPDX 2.3 JSON with a packages array')
  return value.packages.map(item => `${item.name}@${item.versionInfo}`).sort()
}

function main () {
  if (!existsSync(manifestPath)) throw new Error('.agent-standard/manifest.json is missing')
  const manifest = readJson(manifestPath)
  const bom = manifest.supplyChain?.bom
  const fileFor = { 'cyclonedx-json': 'bom.cdx.json', 'spdx-json': 'bom.spdx.json' }
  if (!bom || !['strict', 'advisory'].includes(bom.mode) || !Array.isArray(bom.formats) || !Array.isArray(bom.files) ||
      bom.formats.length !== bom.files.length || !bom.formats.length || bom.formats.some((format, index) => fileFor[format] !== bom.files[index])) {
    throw new Error('manifest supplyChain.bom configuration is invalid')
  }
  const deps = dependencies(manifest)
  const expected = deps.map(item => `${item.name}@${item.version}`).sort()
  const findings = []
  for (let index = 0; index < bom.formats.length; index++) {
    const format = bom.formats[index]
    const relative = bom.files[index]
    const path = resolve(root, relative)
    const generated = format === 'cyclonedx-json' ? cycloneDx(manifest, deps) : spdx(manifest, deps)
    if (args.has('--write')) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(generated, null, 2) + '\n')
      console.log(`wrote ${relative} (${deps.length} packages)`)
      continue
    }
    try {
      if (!existsSync(path)) throw new Error('file is missing')
      if (JSON.stringify(identities(format, readJson(path))) !== JSON.stringify(expected)) throw new Error('package identities do not match the current dependency files')
    } catch (error) { findings.push(`${relative}: ${error.message}`) }
  }
  if (!findings.length) return 0
  const message = `SBOM gate findings:\n- ${findings.join('\n- ')}`
  if (bom.mode === 'advisory') { console.warn(`[advisory] ${message}`); return 0 }
  console.error(message)
  return 1
}

try { process.exitCode = main() } catch (error) { console.error(`SBOM gate: ${error.message}`); process.exitCode = 1 }
