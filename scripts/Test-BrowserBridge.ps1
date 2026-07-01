# End-to-end browser bridge test: creates a handoff, opens SuperGrok, polls for auto-sync.
param(
    [int]$Port = 3877,
    [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\bridge-common.ps1"

Write-Host "=== Grok Link Browser Bridge Test ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Ensure-GrokLinkRunning -Port $Port)) {
    Write-Error "Grok Link bridge not available."
}

$scriptPath = Join-Path $env:USERPROFILE ".grok-link\browser\grok-link-bridge.user.js"
if (-not (Test-Path $scriptPath)) {
    Write-Host "Browser bridge script not deployed." -ForegroundColor Yellow
    Write-Host "In Grok Link: complete setup -> Install browser bridge (Tampermonkey)." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "Install-BrowserBridge.ps1")
} else {
    $ver = (Select-String -Path $scriptPath -Pattern '@version\s+(\S+)' | Select-Object -First 1).Matches.Groups[1].Value
    Write-Host "Deployed userscript version: $ver" -ForegroundColor Cyan
    if ([version]$ver -lt [version]"0.5.0") {
        Write-Host "Update available (0.5.0+). Re-run Install browser bridge in Grok Link." -ForegroundColor Yellow
        & (Join-Path $PSScriptRoot "Install-BrowserBridge.ps1")
    }
}

$payload = @{
    source  = "bridge-test"
    task    = "browser-bridge-e2e"
    message = "Grok Link browser bridge test. Reply with exactly: BRIDGE_OK"
    context = "Automated end-to-end verification. Keep the reply short."
} | ConvertTo-Json -Compress

$handoff = Invoke-RestMethod -Uri "$(Get-BridgeBaseUrl -Port $Port)/api/handoff" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 10
Write-Host "Created handoff: $($handoff.id)" -ForegroundColor Green

$url = Build-SuperGrokUrl -Message $handoff.message -Context $handoff.context -HandoffId $handoff.id
Write-Host ""
Write-Host "Opening SuperGrok..." -ForegroundColor Cyan
Write-Host $url -ForegroundColor Gray
Write-Host ""
Write-Host "In the browser tab:" -ForegroundColor Yellow
Write-Host "  1. Confirm the Grok Link badge appears (bottom-right)" -ForegroundColor White
Write-Host "  2. Submit the pre-filled prompt if needed" -ForegroundColor White
Write-Host "  3. Wait for SuperGrok to reply BRIDGE_OK" -ForegroundColor White
Write-Host "  4. Badge should turn green: synced" -ForegroundColor White
Write-Host ""
Start-Process $url

& (Join-Path $PSScriptRoot "poll-handoff.ps1") -Id $handoff.id -Port $Port -TimeoutSec $TimeoutSec -IntervalSec 3