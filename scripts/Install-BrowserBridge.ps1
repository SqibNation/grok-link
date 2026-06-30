# Install instructions for the Grok Link browser bridge (Tampermonkey userscript).
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $root "browser\grok-link-bridge.user.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Browser bridge not found: $scriptPath"
}

Write-Host "=== Grok Link Browser Bridge ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This userscript auto-syncs SuperGrok replies back to Grok Build." -ForegroundColor White
Write-Host ""
Write-Host "1. Install Tampermonkey (Chrome/Edge/Firefox)" -ForegroundColor Yellow
Write-Host "   https://www.tampermonkey.net/" -ForegroundColor Gray
Write-Host "2. Click Install browser bridge in Grok Link (opens script in browser)" -ForegroundColor Yellow
Write-Host "   Tampermonkey should offer one-click Install / Update." -ForegroundColor Gray
Write-Host "3. Confirm the script is enabled on grok.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "Script path:" -ForegroundColor Cyan
Write-Host "   $scriptPath" -ForegroundColor Green

$dest = Join-Path $env:USERPROFILE ".grok-link\browser\grok-link-bridge.user.js"
$destDir = Split-Path $dest -Parent
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Copy-Item $scriptPath $dest -Force

$resolved = (Resolve-Path $dest).Path -replace '\\', '/'
$url = "file:///$resolved"
Write-Host "Opening in browser for Tampermonkey install..." -ForegroundColor Cyan
Start-Process $url