param(
  [string[]]$Example = @(
    'examples/0-ts-node-standard.yml',
    'examples/1-py-fastapi-adopt-advisory.yml',
    'examples/2-ts-node-service-strict.yml',
    'examples/3-ts-next-clean-strict.yml',
    'examples/4-py-fastapi-clean-strict.yml'
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
