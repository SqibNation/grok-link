# One-shot: send full Grok Link project data to SuperGrok for resume writing.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

$context = @'
CANDIDATE: Zachary H. Roberts
GitHub: memento-mori1984
Resume file: C:\Users\Ranzh\OneDrive\WORK\CBPRobertsresume.pdf
License: MIT
Copyright: 2026 Zachary H. Roberts

PROJECT: Grok Link
GitHub: https://github.com/memento-mori1984/grok-link
Latest release: v0.5.8 (July 2026)
Release URL: https://github.com/memento-mori1984/grok-link/releases/tag/v0.5.8
Distribution: Published — portable exe, NSIS installer, SHA-256 checksums, release zip

WHAT IT IS:
Desktop bridge connecting Grok Build (IDE coding agent) and SuperGrok (browser Grok). Local HTTP API on 127.0.0.1:3877 relays handoffs and syncs replies so the IDE agent and browser Grok stay aligned without copy-paste.

ARCHITECTURE:
Grok Build --POST /api/handoff--> Grok Link (Tauri app) --browser--> SuperGrok
Grok Build <--GET /api/handoffs/{id}-- Grok Link <--Tampermonkey userscript-- grok.com

TECH STACK:
- Tauri 2 (Rust backend + HTML/JS/CSS frontend)
- tiny_http local bridge server (port 3877)
- PowerShell automation (handoff, poll, handoff-and-wait, bridge test, install, release publish)
- Tampermonkey userscript v0.4.0 (GM_xmlhttpRequest, auto-sync SuperGrok replies)
- NSIS installer + portable exe distribution
- GitHub CLI release publishing
- Windows system tray, single-instance lock, startup shortcut

VERSION MILESTONES (built in ~2 days, June 2026):
- v0.1: Initial Tauri app, clipboard, manual compose
- v0.2: Local HTTP bridge, handoff queue UI, inbox fallback, handoff.ps1
- v0.3: Seamless sync — Tampermonkey browser bridge, handoff-and-wait, URL hash handoff IDs
- v0.4: System tray, single-instance, close-to-tray
- v0.5.0–0.5.1: Plain-English setup wizard, onboarding, toasts, status hero
- v0.5.4: One-click Tampermonkey install, bridge auto-recovery scripts, Test-GrokLinkBridge.ps1
- v0.5.6–0.5.7: Minimize-to-tray, fixed status UI, Tauri ACL permissions, GitHub publish
- v0.5.8: Browser bridge v0.5.0, query-param handoff IDs, URL length cap, Test-BrowserBridge.ps1

KEY FEATURES SHIPPED:
- REST handoff API (health, create handoff, list, poll, submit response)
- Handoff queue UI with status pills (New / Opened / Done)
- Browser bridge auto-captures SuperGrok replies from grok.com
- Ensure-GrokLinkRunning / Wait-ForGrokLink for script resilience
- System tray lifecycle (minimize, close, restore)
- 4-step setup guide with progress bar
- Package-Release.ps1 + Publish-GitHubRelease.ps1 release pipeline
- Data local only: %USERPROFILE%\.grok-link\

DELIVERABLES NEEDED FOR RESUME:
1) Suggested Projects section title line (optional tech parenthetical)
2) 3–5 strong ATS-friendly bullet points (action verbs, impact, scope — quantify where reasonable)
3) One-line LinkedIn Projects summary
4) Where to place on a software/developer resume
5) Suggested skills/keywords to add (ATS)

CONSTRAINTS:
- Personal/open-source side project — do not invent employers or employment dates
- Tone: professional software engineer resume
- Emphasize: systems integration, local API design, desktop distribution, agent-to-agent bridge, shipping velocity
'@

$message = @'
Using ALL project context provided, write polished resume content for Grok Link.

Return exactly these sections:

## Project Title
(one line for resume Projects section)

## Resume Bullets
(3–5 bullets, each starting with a strong action verb, ATS-friendly)

## LinkedIn Line
(one sentence for LinkedIn Projects)

## Placement
(where this belongs on a developer resume and why)

## Skills / Keywords
(comma-separated ATS keywords to add to skills section)

Be specific to what was actually built. Do not fabricate team size, employer, or dates.
'@

& (Join-Path $PSScriptRoot "handoff-and-wait.ps1") `
    -Message $message `
    -Task "resume-full-project" `
    -Context $context `
    -TimeoutSec 900 `
    -IntervalSec 5