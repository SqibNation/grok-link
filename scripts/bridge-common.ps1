# Shared helpers for Grok Link bridge scripts.
$script:DefaultBridgePort = 3877

function Get-BridgeBaseUrl {
    param([int]$Port = $script:DefaultBridgePort)
    "http://127.0.0.1:$Port"
}

function Format-SuperGrokMessage {
    param(
        [string]$Message,
        [string]$Context = ""
    )
    $message = ($Message | Out-String).Trim()
    $context = ($Context | Out-String).Trim()
    if (-not $message) { throw "Message is required." }
    if (-not $context) { return $message }
    "[Grok Build context]`n$context`n`n[Message]`n$message"
}

function Build-SuperGrokUrl {
    param(
        [string]$Message,
        [string]$Context = "",
        [string]$HandoffId = "",
        [ValidateSet("com", "xai")]
        [string]$GrokHost = "com"
    )
    $composed = Format-SuperGrokMessage -Message $Message -Context $Context
    $encoded = [uri]::EscapeDataString($composed)
    $base = if ($GrokHost -eq "xai") { "https://grok.x.ai/" } else { "https://grok.com/" }
    $url = "${base}?q=$encoded"
    if ($HandoffId) {
        $url += "#grok-link-id=$HandoffId"
    }
    $url
}

function Get-Handoff {
    param(
        [Parameter(Mandatory)][string]$Id,
        [int]$Port = $script:DefaultBridgePort
    )
    Invoke-RestMethod -Uri "$(Get-BridgeBaseUrl -Port $Port)/api/handoffs/$Id" -Method Get -TimeoutSec 10
}

function Wait-ForGrokLink {
    param(
        [int]$Port = $script:DefaultBridgePort,
        [int]$TimeoutSec = 30,
        [int]$IntervalSec = 1,
        [switch]$Quiet
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "$(Get-BridgeBaseUrl -Port $Port)/api/health" -Method Get -TimeoutSec 2
            if ($health.ok) {
                if (-not $Quiet) {
                    Write-Host "Grok Link bridge ready." -ForegroundColor Green
                }
                return $true
            }
        } catch {
            # retry
        }
        if (-not $Quiet) {
            Write-Host "Waiting for Grok Link bridge..." -ForegroundColor Yellow
        }
        Start-Sleep -Seconds $IntervalSec
    }
    return $false
}

function Ensure-GrokLinkRunning {
    param(
        [int]$Port = $script:DefaultBridgePort,
        [int]$WaitSec = 30
    )
    if (Wait-ForGrokLink -Port $Port -TimeoutSec 2 -Quiet) {
        return $true
    }
    $startScript = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\Start-GrokLink.ps1"
    if (Test-Path $startScript) {
        Write-Host "Starting Grok Link..." -ForegroundColor Cyan
        & $startScript | Out-Null
    }
    return (Wait-ForGrokLink -Port $Port -TimeoutSec $WaitSec)
}