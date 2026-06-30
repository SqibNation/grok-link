# Synthetic round-trip test for the Grok Link bridge (no grok.com required).
param(
    [int]$Port = 3877
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\bridge-common.ps1"

Write-Host "=== Grok Link Bridge Test ===" -ForegroundColor Cyan

if (-not (Ensure-GrokLinkRunning -Port $Port)) {
    Write-Error "Grok Link bridge not available."
}

$base = Get-BridgeBaseUrl -Port $Port

try {
    $health = Invoke-RestMethod -Uri "$base/api/health" -Method Get -TimeoutSec 5
    if (-not $health.ok) {
        Write-Error "Health check returned not ok."
    }
    Write-Host "Health: OK ($($health.service))" -ForegroundColor Green
} catch {
    Write-Error "Health check failed: $_"
}

$scriptPath = Join-Path $env:USERPROFILE ".grok-link\browser\grok-link-bridge.user.js"
if (Test-Path $scriptPath) {
    $verLine = Select-String -Path $scriptPath -Pattern '@version' | Select-Object -First 1
    if ($verLine) {
        Write-Host "Browser script on disk: $($verLine.Line.Trim())" -ForegroundColor Cyan
    }
} else {
    Write-Host "Browser script not deployed yet (install via Grok Link setup)." -ForegroundColor Yellow
}

$payload = @{
    source  = "bridge-test"
    task    = "synthetic-round-trip"
    message = "Synthetic bridge test"
    context = "Automated verification"
} | ConvertTo-Json -Compress

$handoff = Invoke-RestMethod -Uri "$base/api/handoff" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 10
Write-Host "Created handoff: $($handoff.id)" -ForegroundColor Cyan

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$responseBody = @{ response = "Verified: bridge round-trip OK at $stamp" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$base/api/handoffs/$($handoff.id)/response" -Method Post -Body $responseBody -ContentType "application/json" -TimeoutSec 10 | Out-Null

$item = Get-Handoff -Id $handoff.id -Port $Port
if ($item.status -ne "answered" -or -not $item.response) {
    Write-Error "Round-trip failed: status=$($item.status)"
}

Write-Host "Round-trip: PASS" -ForegroundColor Green
Write-Host $item.response -ForegroundColor White

@{
    ok       = $true
    id       = $handoff.id
    status   = $item.status
    response = $item.response
} | ConvertTo-Json -Depth 3