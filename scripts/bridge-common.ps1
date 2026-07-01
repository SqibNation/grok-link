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
    # grok.com returns HTTP 431 if the ?q= URL is too large; keep URL payload short.
    $maxUrlChars = 1800
    $composed = Format-SuperGrokMessage -Message $Message -Context $Context
    if ($composed.Length -gt $maxUrlChars) {
        $composed = Format-SuperGrokMessage -Message $Message -Context ""
        if ($Context) {
            $hint = "[Note] Full Grok Build context is stored in Grok Link handoff"
            if ($HandoffId) { $hint += " $HandoffId" }
            $hint += ". Paste any local brief file the message references."
            $composed = "$hint`n`n$composed"
        }
        if ($composed.Length -gt $maxUrlChars) {
            $composed = $Message.Trim()
        }
    }
    $encoded = [uri]::EscapeDataString($composed)
    $base = if ($GrokHost -eq "xai") { "https://grok.x.ai/" } else { "https://grok.com/" }
    if ($HandoffId) {
        # Query param survives SPA navigation better than hash alone.
        $url = "${base}?grok-link-id=$HandoffId&q=$encoded#grok-link-id=$HandoffId"
    } else {
        $url = "${base}?q=$encoded"
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