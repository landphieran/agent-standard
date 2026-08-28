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
  const lockPath = resolve(root, 'package-lock.json')
  if (!existsSync(lockPath)) return null
  const lock = readJson(lockPath)
  return Object.entries(lock.packages || {})
    .filter(([path, value]) => path && value?.version)
    .map(([path, value]) => ({
      name: value.name || path.split('node_modules/').at(-1),
      version: value.version,
      type: 'npm'
    }))
    .filter(item => item.name)
}

function fromPackageJson () {
  const path = resolve(root, 'package.json')
  if (!existsSync(path)) return null
  const pkg = readJson(path)
  const groups = [pkg.dependencies || {}, pkg.devDependencies || {}, pkg.optionalDependencies || {}]
  return groups.flatMap(group => Object.entries(group).map(([name, version]) => ({ name, version, type: 'npm' })))
}

function fromUvLock () {
  const path = resolve(root, 'uv.lock')
  if (!existsSync(path)) return null
  const blocks = readFileSync(path, 'utf8').split(/^\[\[package\]\]\s*$/m).slice(1)
  return blocks.flatMap(block => {
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
    return name && version ? [{ name, version, type: 'pypi' }] : []
  })
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
  const raw = manifest.project?.packageManager === 'uv'
    ? (fromUvLock() || fromPyproject() || [])
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
  const name = item.name.startsWith('@')
    ? item.name.split('/').map(encodeURIComponent).join('/')
    : encodeURIComponent(item.name)
  return `pkg:${item.type}/${name}@${encodeURIComponent(item.version)}`
}

function cycloneDx (manifest, deps) {
  return {
    $schema: 'https://cyclonedx.org/schema/bom-1.7.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
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
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${manifest.project.name}-sbom`,
    documentNamespace: `https://spdx.org/spdxdocs/${encodeURIComponent(manifest.project.packageName)}-${randomUUID()}`,
    creationInfo: { created: new Date().toISOString(), creators: [`Tool: agent-standard-${manifest.standardVersion}`] },
    packages: deps.map((item, index) => ({
      name: item.name,
      SPDXID: `SPDXRef-Package-${slug(item.name)}-${index + 1}`,
      versionInfo: item.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      externalRefs: [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: purl(item) }]
    }))
  }
}

function identities (format, value) {
  if (format === 'cyclonedx-json') {
    if (value?.bomFormat !== 'CycloneDX' || !['1.4', '1.5', '1.6', '1.7'].includes(value?.specVersion) ||
        !Number.isInteger(value?.version) || value.version < 1 || !Array.isArray(value?.components)) {
      throw new Error('expected CycloneDX JSON with a supported specVersion and components array')
    }
    if (value.components.some(item => !item || typeof item.name !== 'string' || !item.name ||
      typeof item.version !== 'string' || !item.version || typeof item.type !== 'string' || !item.type ||
      typeof item.purl !== 'string' || !item.purl.startsWith('pkg:'))) {
      throw new Error('CycloneDX components must contain type, name, version, and Package URL identities')
    }
    return value.components.map(item => `${item.name}@${item.version || 'NOASSERTION'}`).sort()
  }
  if (value?.spdxVersion !== 'SPDX-2.3' || value?.SPDXID !== 'SPDXRef-DOCUMENT' || value?.dataLicense !== 'CC0-1.0' ||
      typeof value?.name !== 'string' || !value.name || typeof value?.documentNamespace !== 'string' ||
      !/^https?:\/\//.test(value.documentNamespace) || typeof value?.creationInfo?.created !== 'string' ||
      !Array.isArray(value?.creationInfo?.creators) || !value.creationInfo.creators.length || !Array.isArray(value?.packages)) {
    throw new Error('expected SPDX 2.3 JSON with SPDXRef-DOCUMENT and packages array')
  }
  const ids = new Set()
  for (const item of value.packages) {
    const purl = item?.externalRefs?.some(reference => reference?.referenceCategory === 'PACKAGE-MANAGER' &&
      reference?.referenceType === 'purl' && typeof reference?.referenceLocator === 'string' && reference.referenceLocator.startsWith('pkg:'))
    if (!item || typeof item.name !== 'string' || !item.name || typeof item.versionInfo !== 'string' || !item.versionInfo ||
        !/^SPDXRef-[A-Za-z0-9.-]+$/.test(item.SPDXID || '') || ids.has(item.SPDXID) ||
        typeof item.downloadLocation !== 'string' || item.filesAnalyzed !== false || !purl) {
      throw new Error('SPDX packages must contain unique IDs, names, versions, download locations, filesAnalyzed=false, and Package URL references')
    }
    ids.add(item.SPDXID)
  }
  return value.packages.map(item => `${item.name}@${item.versionInfo || 'NOASSERTION'}`).sort()
}

function main () {
  if (!existsSync(manifestPath)) throw new Error('.agent-standard/manifest.json is missing')
  const manifest = readJson(manifestPath)
  const bom = manifest.supplyChain?.bom
  const fileFor = { 'cyclonedx-json': 'bom.cdx.json', 'spdx-json': 'bom.spdx.json' }
  if (!bom || !['strict', 'advisory'].includes(bom.mode) || !Array.isArray(bom.formats) || !Array.isArray(bom.files) ||
      bom.formats.length !== bom.files.length || !bom.formats.length ||
      bom.formats.some((format, index) => !fileFor[format] || bom.files[index] !== fileFor[format])) {
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
      if (existsSync(path)) {
        try {
          const actual = identities(format, readJson(path))
          if (JSON.stringify(actual) === JSON.stringify(expected)) {
            console.log(`${relative} is current (${deps.length} packages)`)
            continue
          }
        } catch { /* replace malformed or wrong-format files below */ }
      }
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(generated, null, 2) + '\n')
      console.log(`wrote ${relative} (${deps.length} packages)`)
      continue
    }
    try {
      if (!existsSync(path)) throw new Error('file is missing')
      const actual = identities(format, readJson(path))
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('package identities do not match the current dependency manifest/lockfile')
      }
    } catch (error) {
      findings.push(`${relative}: ${error.message}`)
    }
  }

  if (!args.has('--write') && findings.length) {
    const message = `SBOM gate findings:\n- ${findings.join('\n- ')}\nRun: node .agent-standard/scripts/sbom.mjs --write`
    if (bom.mode === 'advisory') { console.warn(`[advisory] ${message}`); return 0 }
    console.error(message)
    return 1
  }
  return 0
}

try { process.exitCode = main() } catch (error) { console.error(`SBOM gate: ${error.message}`); process.exitCode = 1 }
