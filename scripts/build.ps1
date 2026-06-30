# Grok Link - build portable exe + checksum into dist/
param(
    [switch]$NoBundle
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$ver = Get-Content (Join-Path $root "version.json") -Raw | ConvertFrom-Json
$version = "{0}.{1}.{2}" -f $ver.major, $ver.minor, $ver.iteration
$product = if ($ver.productName) { $ver.productName } else { "Grok Link" }
$exeName = "$product $version.exe"

Write-Host "=== $product Build ===" -ForegroundColor Cyan

if ($NoBundle) {
    npm run tauri build -- --no-bundle
} else {
    npm run tauri build
}

$built = Join-Path $root "src-tauri\target\release\grok-link.exe"
if (-not (Test-Path $built)) {
    Write-Error "Build failed: $built not found"
}

$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$dest = Join-Path $dist $exeName
Copy-Item $built $dest -Force

$hash = Get-FileHash -Algorithm SHA256 $dest
"$($hash.Hash)  $exeName" | Out-File -Encoding UTF8 -FilePath "$dest.sha256"

Write-Host "Built: $dest" -ForegroundColor Green
Write-Host "Checksum: $dest.sha256" -ForegroundColor Green