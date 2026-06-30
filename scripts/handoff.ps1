# Send a handoff from Grok Build (or shell) to Grok Link.
param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [string]$Task = "",
    [string]$Context = "",
    [string]$Source = "grok-build",
    [int]$Port = 3877
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

$uri = "http://127.0.0.1:$Port/api/handoff"

try {
    $result = Invoke-RestMethod -Uri $uri -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 5
    Write-Host "Handoff sent: $($result.id)" -ForegroundColor Green
    Write-Host "Poll: http://127.0.0.1:$Port/api/handoffs/$($result.id)" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 5
    exit 0
} catch {
    $inbox = Join-Path $env:USERPROFILE ".grok-link\inbox"
    New-Item -ItemType Directory -Path $inbox -Force | Out-Null
    $file = Join-Path $inbox ("handoff-{0}.json" -f [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
    $payload | Out-File -Encoding UTF8 -FilePath $file
    Write-Host "Grok Link not reachable. Wrote inbox file:" -ForegroundColor Yellow
    Write-Host "  $file" -ForegroundColor Yellow
    Write-Host "Start Grok Link to import it." -ForegroundColor Yellow
    exit 2
}