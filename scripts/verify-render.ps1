param(
  [string[]]$Example = @(
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
    & uvx copier copy --trust --defaults --vcs-ref $SourceRef --data-file (Join-Path $sourceRoot $examplePath) $sourceRoot $renderRoot
    if ($LASTEXITCODE -ne 0) { throw "Copier render failed for $examplePath" }
    Push-Location $renderRoot
    try {
      & git init --quiet
      & git config user.email 'agent-standard@example.invalid'
      & git config user.name 'agent-standard verifier'

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
      & node .agent-standard/scripts/doctor.mjs
      if ($LASTEXITCODE -ne 0) { throw "doctor failed for $examplePath" }

      if (Test-Path 'package.json') {
        if (Test-Path 'playwright.config.ts') { & $npxCommand playwright install chromium }
        & $npmCommand run verify:code
        if ($LASTEXITCODE -ne 0) { throw "code verification failed for $examplePath" }
      } elseif (Test-Path 'pyproject.toml') {
        & uv run ruff format --check .
        if ($LASTEXITCODE -ne 0) { throw "Ruff format failed for $examplePath" }
        & uv run ruff check .
        if ($LASTEXITCODE -ne 0) { throw "Ruff lint failed for $examplePath" }
        & uv run mypy src
        if ($LASTEXITCODE -ne 0) { throw "mypy failed for $examplePath" }
        & uv run pytest -q
        if ($LASTEXITCODE -ne 0) { throw "Python verification failed for $examplePath" }
      }

      if ($UpdateRoundTrip) {
        & uvx copier update --trust --defaults --vcs-ref $SourceRef
        if ($LASTEXITCODE -ne 0) { throw "Copier update failed for $examplePath" }
        & node .agent-standard/scripts/doctor.mjs
        if ($LASTEXITCODE -ne 0) { throw "doctor failed after Copier update for $examplePath" }
        & git diff --exit-code
        if ($LASTEXITCODE -ne 0) { throw "Copier update was not idempotent for $examplePath" }
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
