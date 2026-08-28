param(
  [string[]]$Example = @(
    'examples/0-ts-node-standard.yml',
    'examples/1-py-fastapi-adopt-advisory.yml',
    'examples/2-ts-node-service-strict.yml',
    'examples/3-ts-next-clean-strict.yml',
    'examples/4-py-fastapi-clean-strict.yml',
    'examples/5-ts-node-azure-devops-standard.yml',
    'examples/6-ts-node-azure-devops-extends.yml'
  ),
  [string]$SourceRef = 'HEAD',
  [switch]$UpdateRoundTrip
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path '.').Path
$npmCommand = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
$npxCommand = if ($env:OS -eq 'Windows_NT') { 'npx.cmd' } else { 'npx' }

foreach ($examplePath in $Example) {
  $renderRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agent-standard-render-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $renderRoot | Out-Null
  try {
    $answerText = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $sourceRoot $examplePath)
    $isAdopt = $answerText -match '(?m)^mode:\s*adopt\s*$'
    $isPavedPath = $examplePath -eq 'examples/0-ts-node-standard.yml'
    $isAzureDevOps = $answerText -match '(?m)^repository_platform:\s*azure-devops\s*$'
    $isAzureExtends = $answerText -match '(?m)^azure_pipeline_mode:\s*extends\s*$'
    $isHardened = -not ($answerText -match '(?m)^security_profile:\s*baseline\s*$')
    if ($isAdopt) {
      $fixtureRoot = Join-Path $sourceRoot 'test/fixtures/adopt-py-fastapi'
      Get-ChildItem -LiteralPath $fixtureRoot -Force | Copy-Item -Destination $renderRoot -Recurse -Force
      & git -C $renderRoot init --quiet
      & git -C $renderRoot config user.email 'agent-standard@example.invalid'
      & git -C $renderRoot config user.name 'agent-standard verifier'
      & git -C $renderRoot add -A
      & git -C $renderRoot commit --quiet -m 'existing repository fixture'
    }

    if ($isPavedPath) {
      & node (Join-Path $sourceRoot 'bin/agent-standard.mjs') init $renderRoot --source $sourceRoot --ref $SourceRef --name catalog-service --stack ts-node --owner '@example/catalog'
      if ($LASTEXITCODE -ne 0) { throw "Transactional init failed for $examplePath" }
    } else {
      & uvx copier copy --trust --defaults --answers-file .agent-standard/copier-answers.yml --vcs-ref $SourceRef --data-file (Join-Path $sourceRoot $examplePath) $sourceRoot $renderRoot
      if ($LASTEXITCODE -ne 0) { throw "Copier render failed for $examplePath" }
    }
    Push-Location $renderRoot
    try {
      if (-not (Test-Path '.git')) {
        & git init --quiet
        & git config user.email 'agent-standard@example.invalid'
        & git config user.name 'agent-standard verifier'
      }

      if ($isAdopt) {
        if (Test-Path 'claude/settings.json') { throw 'Adoption rendered an invalid non-hidden Claude settings path' }
        if ((Get-Content -Raw -Encoding utf8 README.md) -notmatch 'Existing payments API') { throw 'Adoption overwrote README.md' }
        if ((Get-Content -Raw -Encoding utf8 SECURITY.md) -notmatch 'Existing security policy') { throw 'Adoption overwrote SECURITY.md' }
        if ((Get-Content -Raw -Encoding utf8 CONTRIBUTING.md) -notmatch 'Existing contribution guide') { throw 'Adoption overwrote CONTRIBUTING.md' }
        if ((Get-Content -Raw -Encoding utf8 docs/README.md) -notmatch 'Existing documentation index') { throw 'Adoption overwrote docs/README.md' }
        if ((Get-Content -Raw -Encoding utf8 docs/testing.md) -notmatch 'Existing testing strategy') { throw 'Adoption overwrote docs/testing.md' }
        if ((Get-Content -Raw -Encoding utf8 docs/topology.md) -notmatch 'Existing deployment topology') { throw 'Adoption overwrote docs/topology.md' }
        if ((Get-Content -Raw -Encoding utf8 docs/decisions/README.md) -notmatch 'Existing decision index') { throw 'Adoption overwrote the decision index' }
        if ((Get-Content -Raw -Encoding utf8 docs/decisions/0000-template.md) -notmatch 'Existing decision template') { throw 'Adoption overwrote the decision template' }
        if ((Get-Content -Raw -Encoding utf8 docs/runbooks/README.md) -notmatch 'Existing runbook index') { throw 'Adoption overwrote the runbook index' }
        if ((Get-Content -Raw -Encoding utf8 docs/changes/README.md) -notmatch 'Existing change-plan index') { throw 'Adoption overwrote the change-plan index' }
        if ((Get-Content -Raw -Encoding utf8 docs/changes/0000-template.md) -notmatch 'Existing change-plan template') { throw 'Adoption overwrote the change-plan template' }
        if ((Get-Content -Raw -Encoding utf8 .copier-answers.yml) -notmatch 'preserve-me') { throw 'Adoption overwrote another Copier template answers file' }
        if (-not (Test-Path '.agent-standard/copier-answers.yml')) { throw 'Adoption did not write namespaced agent-standard Copier answers' }
        if ((Get-Content -Raw -Encoding utf8 .github/dependabot.yml) -notmatch 'existing-dependabot-policy') { throw 'Adoption overwrote dependabot.yml' }
        if ((Get-Content -Raw -Encoding utf8 .github/pull_request_template.md) -notmatch 'existing-pull-request-template') { throw 'Adoption overwrote the pull request template' }
        if ((Get-Content -Raw -Encoding utf8 .github/pull_request_template.md) -notmatch 'agent-standard:start') { throw 'Adoption did not merge the pull request checklist' }
        $settings = Get-Content -Raw -Encoding utf8 .claude/settings.json | ConvertFrom-Json
        if ($settings.permissions.allow -notcontains 'Read') { throw 'Adoption removed existing Claude permissions' }
        if ((Get-Content -Raw -Encoding utf8 .claude/settings.json) -notmatch '\.agent-standard/scripts/dod\.mjs') { throw 'Adoption did not merge the Claude hook' }
        $owners = Get-Content -Raw -Encoding utf8 .github/CODEOWNERS
        if ($owners -notmatch '@legacy/payments' -or $owners -notmatch '# agent-standard:start') { throw 'Adoption did not preserve and extend CODEOWNERS' }
      }

      if ($isAzureDevOps) {
        foreach ($required in @(
          '.agent-standard/platforms/azure-devops.json',
          '.agent-standard/platforms/azure-devops.schema.json',
          '.agent-standard/scripts/audit-azure-devops.mjs',
          '.azuredevops/pull_request_template.md',
          'azure-pipelines.yml'
        )) {
          if (-not (Test-Path -LiteralPath $required)) { throw "Azure DevOps render is missing $required" }
        }
        foreach ($githubOnly in @(
          '.github/CODEOWNERS',
          '.github/dependabot.yml',
          '.github/pull_request_template.md',
          '.github/workflows/dod.yml',
          '.github/workflows/dependency-review.yml',
          '.github/workflows/codeql.yml',
          '.github/workflows/release-attest.yml'
        )) {
          if (Test-Path -LiteralPath $githubOnly) { throw "Azure DevOps render unexpectedly contains GitHub-only control $githubOnly" }
        }
        $adapter = Get-Content -Raw -Encoding utf8 '.agent-standard/platforms/azure-devops.json' | ConvertFrom-Json
        if ($adapter.service -ne 'azure-devops-services' -or $adapter.pipeline.path -ne 'azure-pipelines.yml') { throw 'Azure DevOps adapter metadata is invalid' }
        if (-not $adapter.branchPolicies.securityStatusCheck.required -or $adapter.branchPolicies.securityStatusCheck.genre -ne 'AdvancedSecurity' -or $adapter.branchPolicies.securityStatusCheck.name -ne 'NewHighAndCritical') { throw 'Azure DevOps adapter is missing the default Advanced Security merge gate' }
        $pipeline = Get-Content -Raw -Encoding utf8 'azure-pipelines.yml'
        if ($pipeline -notmatch '(?m)^pr:\s*none\s*$') { throw 'Azure Pipeline did not disable unsupported Azure Repos YAML PR triggers' }
        if ($isAzureExtends) {
          if ($adapter.pipeline.mode -ne 'extends') { throw 'Azure DevOps extends answer did not reach the adapter manifest' }
          foreach ($contract in @('extends:', 'PlatformEngineering/secure-pipelines', '0123456789abcdef0123456789abcdef01234567', 'templates/agent-standard.yml@agent_standard_templates')) {
            if (-not $pipeline.Contains($contract)) { throw "Azure Pipeline extends contract is missing $contract" }
          }
        } else {
          if ($adapter.pipeline.mode -ne 'standalone') { throw 'Azure DevOps standalone default did not reach the adapter manifest' }
          foreach ($contract in @('fetchDepth: 0', 'node .agent-standard/scripts/verify.mjs', 'node .agent-standard/scripts/dod.mjs --ci --policy-only', 'PublishPipelineArtifact@1')) {
            if (-not $pipeline.Contains($contract)) { throw "Standalone Azure Pipeline is missing $contract" }
          }
          if ($isHardened -and -not $pipeline.Contains('AdvancedSecurity-Codeql-Init@1')) { throw 'Hardened Azure Pipeline is missing CodeQL initialization' }
          if ($isHardened -and -not ($pipeline -match 'AdvancedSecurity-Codeql-Analyze@1[\s\S]*?WaitForProcessing:\s*true')) { throw 'Hardened Azure Pipeline does not wait for CodeQL result processing' }
        }
      } else {
        foreach ($azureOnly in @(
          '.agent-standard/platforms/azure-devops.json',
          '.agent-standard/scripts/audit-azure-devops.mjs',
          '.azuredevops/pull_request_template.md',
          'azure-pipelines.yml'
        )) {
          if (Test-Path -LiteralPath $azureOnly) { throw "GitHub render unexpectedly contains Azure-only control $azureOnly" }
        }
      }

      & uvx check-jsonschema --schemafile '.agent-standard/manifest.schema.json' '.agent-standard/manifest.json'
      if ($LASTEXITCODE -ne 0) { throw "Rendered manifest schema validation failed for $examplePath" }
      if ($isAzureDevOps) {
        & uvx check-jsonschema --schemafile '.agent-standard/platforms/azure-devops.schema.json' '.agent-standard/platforms/azure-devops.json'
        if ($LASTEXITCODE -ne 0) { throw "Azure DevOps adapter schema validation failed for $examplePath" }
        & uvx yamllint -d relaxed 'azure-pipelines.yml'
        if ($LASTEXITCODE -ne 0) { throw "Azure Pipeline YAML validation failed for $examplePath" }
      }

      if (Test-Path 'package.json') {
        & $npmCommand install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed for $examplePath" }
        & $npmCommand run sbom
      } elseif (Test-Path 'pyproject.toml') {
        & uv sync
        if ($LASTEXITCODE -ne 0) { throw "uv sync failed for $examplePath" }
        & node .agent-standard/scripts/sbom.mjs --write
      }

      & git add -A
      & git commit --quiet -m 'render fixture'

      if (Test-Path 'package.json') {
        if (Test-Path 'playwright.config.ts') { & $npxCommand playwright install chromium }
      }
      & node .agent-standard/scripts/verify.mjs
      if ($LASTEXITCODE -ne 0) { throw "manifest verification failed for $examplePath" }
      if ($answerText -match '(?m)^language_stack:\s*ts-node\s*$' -and (Test-Path 'dist')) {
        $compiledTests = Get-ChildItem -LiteralPath 'dist' -Recurse -File | Where-Object { $_.Name -match 'test\.js$' }
        if ($compiledTests) { throw "TypeScript build emitted test files for $examplePath" }
      }

      if ($UpdateRoundTrip) {
        & uvx copier update --trust --defaults --answers-file .agent-standard/copier-answers.yml --vcs-ref $SourceRef
        if ($LASTEXITCODE -ne 0) { throw "Copier update failed for $examplePath" }
        & node .agent-standard/scripts/verify.mjs
        if ($LASTEXITCODE -ne 0) { throw "manifest verification failed after Copier update for $examplePath" }
        $updateStatus = & git status --porcelain=v1 --untracked-files=all
        if ($LASTEXITCODE -ne 0 -or $updateStatus) { throw "Copier update was not idempotent for $examplePath`n$updateStatus" }
      }
    } finally {
      Pop-Location
    }
  } finally {
    if (Test-Path -LiteralPath $renderRoot) {
      $resolvedRender = (Resolve-Path -LiteralPath $renderRoot).Path
      $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
      if (-not $resolvedRender.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove render outside temp: $resolvedRender"
      }
      Remove-Item -LiteralPath $resolvedRender -Recurse -Force
    }
  }
}
