# Package Grok Link for distribution: portable exe, installer, docs, browser bridge.
param(
    [switch]$Build,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$ver = Get-Content (Join-Path $root "version.json") -Raw | ConvertFrom-Json
$version = "{0}.{1}.{2}" -f $ver.major, $ver.minor, $ver.iteration
$product = if ($ver.productName) { $ver.productName } else { "Grok Link" }
$exeName = "$product $version.exe"
$releaseName = "Grok-Link-$version-win64"

if ($Build) {
    & (Join-Path $PSScriptRoot "build.ps1")
}

$exe = Join-Path $root "dist\$exeName"
$sha = "$exe.sha256"
if (-not (Test-Path $exe)) {
    Write-Error "Missing $exe. Run .\scripts\build.ps1 or use -Build."
}
if (-not (Test-Path $sha)) {
    Write-Error "Missing $sha. Run .\scripts\build.ps1 or use -Build."
}

$staging = Join-Path $root "dist\release\$releaseName"
if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "browser") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "scripts") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "docs") -Force | Out-Null

Copy-Item $exe $staging
Copy-Item $sha $staging
Copy-Item (Join-Path $root "browser\grok-link-bridge.user.js") (Join-Path $staging "browser\") -Force
Copy-Item (Join-Path $root "LICENSE") $staging -Force
Copy-Item (Join-Path $root "INSTALL.txt") $staging -Force
Copy-Item (Join-Path $root "CHANGELOG.md") $staging -Force
Copy-Item (Join-Path $root "README.md") $staging -Force
Copy-Item (Join-Path $root "docs\GROK-BUILD-INTEGRATION.md") (Join-Path $staging "docs\") -Force

$scriptFiles = @(
    "Install-Grok-Link.ps1",
    "Start-GrokLink.ps1",
    "Set-Startup.ps1",
    "Install-BrowserBridge.ps1",
    "handoff.ps1",
    "handoff-and-wait.ps1",
    "poll-handoff.ps1",
    "open-supergrok.ps1",
    "bridge-common.ps1"
)
foreach ($name in $scriptFiles) {
    $src = Join-Path $root "scripts\$name"
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $staging "scripts\") -Force
    }
}

if (-not $SkipInstaller) {
    $nsis = Join-Path $root "src-tauri\target\release\bundle\nsis\Grok Link_${version}_x64-setup.exe"
    if (Test-Path $nsis) {
        Copy-Item $nsis $staging
    } else {
        Write-Host "Installer not found (skipped): $nsis" -ForegroundColor Yellow
        Write-Host "Run .\scripts\build.ps1 without -NoBundle to generate NSIS installer." -ForegroundColor Yellow
    }
}

$zipPath = Join-Path $root "dist\release\$releaseName.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

$zipHash = Get-FileHash -Algorithm SHA256 $zipPath
"$($zipHash.Hash)  $releaseName.zip" | Out-File -Encoding UTF8 -FilePath "$zipPath.sha256"

Write-Host ""
Write-Host "=== Release packaged ===" -ForegroundColor Green
Write-Host "Folder: $staging" -ForegroundColor Cyan
Write-Host "Zip:    $zipPath" -ForegroundColor Cyan
Write-Host "SHA256: $zipPath.sha256" -ForegroundColor Cyan
Write-Host ""
Get-ChildItem $staging | Select-Object Name, Length | Format-Table -AutoSize