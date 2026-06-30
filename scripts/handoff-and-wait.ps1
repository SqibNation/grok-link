# Send a handoff, open SuperGrok, and wait for the browser bridge to sync the reply.
param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [string]$Task = "",
    [string]$Context = "",
    [string]$Source = "grok-build",
    [int]$Port = 3877,
    [int]$TimeoutSec = 600,
    [int]$IntervalSec = 5,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\bridge-common.ps1"

if (-not (Ensure-GrokLinkRunning -Port $Port)) {
    Write-Error "Grok Link bridge not available. Launch Grok Link from the desktop shortcut or tray."
}

$payload = @{
    source  = $Source
    task    = $Task
    message = $Message
    context = $Context
} | ConvertTo-Json -Compress

try {
    $result = Invoke-RestMethod -Uri "$(Get-BridgeBaseUrl -Port $Port)/api/handoff" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 5
} catch {
    & (Join-Path $PSScriptRoot "handoff.ps1") -Message $Message -Task $Task -Context $Context -Source $Source -Port $Port
    exit $LASTEXITCODE
}

$id = $result.id
Write-Host "Handoff id: $id" -ForegroundColor Green

if (-not $NoOpen) {
    $openScript = Join-Path $PSScriptRoot "open-supergrok.ps1"
    & $openScript -Id $id -Port $Port
}

Write-Host "Waiting for SuperGrok reply (install browser bridge for auto-sync)..." -ForegroundColor Yellow
$pollScript = Join-Path $PSScriptRoot "poll-handoff.ps1"
& $pollScript -Id $id -Port $Port -TimeoutSec $TimeoutSec -IntervalSec $IntervalSec