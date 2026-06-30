# Enable or disable Grok Link in the current user's Windows Startup folder.
param(
    [switch]$Disable,
    [string]$ExePath = ""
)

$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startupDir "Grok Link.lnk"

if ($Disable) {
    if (Test-Path $lnkPath) {
        Remove-Item $lnkPath -Force
        Write-Host "Removed startup shortcut: $lnkPath" -ForegroundColor Yellow
    } else {
        Write-Host "Startup shortcut not found (already disabled)." -ForegroundColor Gray
    }
    exit 0
}

if (-not $ExePath) {
    $installDir = Join-Path $env:LOCALAPPDATA "Programs\Grok Link"
    $installed = Get-ChildItem $installDir -File -Filter "Grok Link *.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($installed) {
        $ExePath = $installed.FullName
    } else {
        $dist = Join-Path (Split-Path $PSScriptRoot -Parent) "dist"
        $built = Get-ChildItem $dist -File -Filter "Grok Link *.exe" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($built) {
            $ExePath = $built.FullName
        }
    }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
    Write-Error "Grok Link exe not found. Run Install-Grok-Link.ps1 first."
}

$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($lnkPath)
$lnk.TargetPath = $ExePath
$lnk.WorkingDirectory = Split-Path $ExePath -Parent
$lnk.Description = "Grok Link bridge (Grok Build to SuperGrok)"
$lnk.Save()

Write-Host "Startup enabled: $lnkPath" -ForegroundColor Green
Write-Host "Target: $ExePath" -ForegroundColor Cyan