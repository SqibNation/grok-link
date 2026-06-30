# Launch Grok Link, focus its window, and verify the bridge.
$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Grok Link"
$exe = Get-ChildItem $installDir -File -Filter "Grok Link *.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.BaseName -replace '^Grok Link ', '') } -Descending |
    Select-Object -First 1

if (-not $exe) {
    $dist = Join-Path (Split-Path $PSScriptRoot -Parent) "dist"
    $exe = Get-ChildItem $dist -File -Filter "Grok Link *.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [version]($_.BaseName -replace '^Grok Link ', '') } -Descending |
        Select-Object -First 1
}

if (-not $exe) {
    Write-Error "Grok Link not installed. Run Install-Grok-Link.ps1 first."
}

$procName = [System.IO.Path]::GetFileNameWithoutExtension($exe.Name)
$running = Get-Process -Name $procName -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $running) {
    Write-Host "Starting $($exe.Name)..." -ForegroundColor Cyan
    $running = Start-Process -FilePath $exe.FullName -WorkingDirectory $exe.DirectoryName -PassThru
    Start-Sleep -Seconds 2
    if ($running.HasExited) {
        Write-Error "Grok Link exited immediately (code $($running.ExitCode))."
    }
    $running = Get-Process -Id $running.Id
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinShow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@

if ($running.MainWindowHandle -ne [IntPtr]::Zero) {
    [void][WinShow]::ShowWindow($running.MainWindowHandle, 9)
    [void][WinShow]::MoveWindow($running.MainWindowHandle, 120, 80, 820, 920, $true)
    [void][WinShow]::SetForegroundWindow($running.MainWindowHandle)
}

Start-Sleep -Seconds 1
try {
    $health = Invoke-RestMethod "http://127.0.0.1:3877/api/health" -TimeoutSec 5
    Write-Host "Grok Link running (PID $($running.Id)). Bridge: $($health.service)" -ForegroundColor Green
} catch {
    Write-Host "Process running (PID $($running.Id)) but bridge not responding yet." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "In Task Manager, look for: $procName" -ForegroundColor Cyan
Write-Host "Window title: Grok Link" -ForegroundColor Cyan