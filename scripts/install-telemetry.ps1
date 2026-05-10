<#
.SYNOPSIS
  Set / unset / inspect the User-scope OTEL env vars Claude Code needs to
  feed Codeling's local receiver.

.DESCRIPTION
  Interim shim until `npx codeling install` lands. Persists six User-scope
  environment variables so every newly-launched Claude Code session emits
  metrics + logs to http://127.0.0.1:4318 (Codeling's HTTP receiver).

  Modes:
    install     Set the vars (default).
    uninstall   Remove them.
    status      Show their current User-scope values.

  Endpoint defaults to http://127.0.0.1:4318. Override with -Endpoint.
  Existing OTEL_EXPORTER_OTLP_ENDPOINT pointing at a different host triggers
  a warning; pass -Force to overwrite anyway.

.EXAMPLE
  .\scripts\install-telemetry.ps1 install
  .\scripts\install-telemetry.ps1 install -Endpoint http://127.0.0.1:4318
  .\scripts\install-telemetry.ps1 uninstall
  .\scripts\install-telemetry.ps1 status

.NOTES
  Requires PowerShell 5.1+ (Windows). Restart any open shells / VS Code after
  install for them to pick up the new env vars.
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('install', 'uninstall', 'status')]
  [string]$Mode = 'install',

  [string]$Endpoint = 'http://127.0.0.1:4318',

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Names listed in the order users typically reason about (toggle, endpoint,
# protocol, exporters, interval) so the status table reads naturally.
$VarNames = @(
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_METRICS_EXPORTER',
  'OTEL_LOGS_EXPORTER',
  'OTEL_METRIC_EXPORT_INTERVAL'
)

$DesiredValues = @{
  'CLAUDE_CODE_ENABLE_TELEMETRY' = '1'
  'OTEL_EXPORTER_OTLP_ENDPOINT'  = $Endpoint
  'OTEL_EXPORTER_OTLP_PROTOCOL'  = 'http/protobuf'
  'OTEL_METRICS_EXPORTER'        = 'otlp'
  'OTEL_LOGS_EXPORTER'           = 'otlp'
  'OTEL_METRIC_EXPORT_INTERVAL'  = '10000'
}

function Get-UserVar {
  param([string]$Name)
  return [Environment]::GetEnvironmentVariable($Name, 'User')
}

function Show-Status {
  $rows = foreach ($k in $VarNames) {
    $v = Get-UserVar $k
    $display = if ([string]::IsNullOrEmpty($v)) { '(unset)' } else { $v }
    [pscustomobject]@{ Variable = $k; Value = $display }
  }
  $rows | Format-Table -AutoSize
}

switch ($Mode) {
  'install' {
    $existing = Get-UserVar 'OTEL_EXPORTER_OTLP_ENDPOINT'
    if (-not [string]::IsNullOrEmpty($existing) -and $existing -ne $Endpoint -and -not $Force) {
      Write-Warning "OTEL_EXPORTER_OTLP_ENDPOINT is already set to '$existing'."
      Write-Warning "Codeling wants to point it at '$Endpoint'."
      Write-Warning 'Pass -Force to overwrite, or set -Endpoint to match your existing value.'
      return
    }

    foreach ($k in $VarNames) {
      [Environment]::SetEnvironmentVariable($k, $DesiredValues[$k], 'User')
    }
    Write-Host 'Codeling telemetry env vars installed (User scope).' -ForegroundColor Green
    Write-Host 'Restart any open shells, VS Code, or terminals for them to take effect.'
    Write-Host ''
    Show-Status
  }
  'uninstall' {
    foreach ($k in $VarNames) {
      [Environment]::SetEnvironmentVariable($k, $null, 'User')
    }
    Write-Host 'Codeling telemetry env vars removed (User scope).' -ForegroundColor Yellow
    Write-Host 'Restart any open shells / VS Code for the unset to take effect.'
  }
  'status' {
    Show-Status
  }
}
