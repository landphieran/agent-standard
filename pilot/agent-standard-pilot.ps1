param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{40}$')]
  [string]$Revision,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^@[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)?( +@[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)?)*$')]
  [string]$Owner,

  [string]$Path = '.',
  [ValidateSet('service-based', 'clean-layered')]
  [string]$Architecture,
  [ValidateSet('lightweight', 'spec-driven')]
  [string]$Workflow,
  [ValidateSet('github', 'azure-devops')]
  [string]$Scm,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$settings = Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot 'pilot-settings.psd1')
if (-not $Architecture) { $Architecture = $settings.DefaultArchitecture }
if (-not $Workflow) { $Workflow = $settings.DefaultWorkflow }
$policyUrl = "$($settings.PolicyRepository.TrimEnd('/'))/blob/$Revision/$($settings.PolicyPath.TrimStart('/'))"

Write-Host "Policy: $policyUrl"
Write-Host "Support: $($settings.SupportContact)"
Write-Host "Pinned standard revision: $Revision"

$arguments = @(
  '--yes',
  "--package=github:landphieran/agent-standard#$Revision",
  '--',
  'agent-standard',
  'init',
  $Path,
  '--ref', $Revision,
  '--owner', $Owner,
  '--architecture', $Architecture,
  '--workflow', $Workflow
)
if ($Scm) { $arguments += @('--scm', $Scm) }
if ($Apply) { $arguments += '--apply' }

$npx = if ($env:OS -eq 'Windows_NT') { 'npx.cmd' } else { 'npx' }
& $npx @arguments
exit $LASTEXITCODE
