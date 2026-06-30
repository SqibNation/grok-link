# Poll a Grok Link handoff until SuperGrok's reply is saved.
param(
    [Parameter(Mandatory = $true)]
    [string]$Id,
    [int]$Port = 3877,
    [int]$TimeoutSec = 600,
    [int]$IntervalSec = 5
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\bridge-common.ps1"

if (-not (Wait-ForGrokLink -Port $Port -TimeoutSec 15)) {
    Write-Error "Grok Link bridge went offline while waiting. Keep the app running (tray is OK)."
}

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
$lastStatus = ""

while ([DateTime]::UtcNow -lt $deadline) {
    try {
        $item = Get-Handoff -Id $Id -Port $Port
    } catch {
        Write-Host "Bridge unreachable, retrying..." -ForegroundColor Yellow
        if (-not (Wait-ForGrokLink -Port $Port -TimeoutSec 10 -Quiet)) {
            Write-Error "Grok Link bridge offline."
        }
        Start-Sleep -Seconds $IntervalSec
        continue
    }
    if ($item.status -ne $lastStatus) {
        Write-Host "Handoff status: $($item.status)" -ForegroundColor Cyan
        $lastStatus = $item.status
    }
    if ($item.status -eq "answered" -and $item.response) {
        Write-Host "Handoff answered: $Id" -ForegroundColor Green
        $item | ConvertTo-Json -Depth 5
        exit 0
    }
    Start-Sleep -Seconds $IntervalSec
}

Write-Error "Timed out after ${TimeoutSec}s waiting for handoff $Id"
exit 1