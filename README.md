# Grok Link

**Bridge between Grok Build and SuperGrok.**

Grok Build (the IDE coding agent) sends handoffs to this app. You open SuperGrok in the browser, work there, then paste the reply back so Grok Build can continue integrating functions and updates.

Standalone project. Not related to Claim Clash.

## Architecture

```
Grok Build  --POST /api/handoff-->  Grok Link  --browser-->  SuperGrok
     ^                                    |
     +-------- GET /api/handoffs/{id} ----+
              (reads response)
```

## Quick start

```powershell
cd C:\Users\Ranzh\grok-link
npm install
npm run tauri dev
```

Keep Grok Link running while you use the bridge.

## Send from Grok Build

```powershell
.\scripts\handoff.ps1 -Message "Your question" -Task "short-label" -Context "extra context"
```

Full protocol: [docs/GROK-BUILD-INTEGRATION.md](docs/GROK-BUILD-INTEGRATION.md)

## Build

```powershell
.\scripts\build.ps1
```

## Install

```powershell
.\Install-Grok-Link.ps1
```

Install also adds Grok Link to **Windows Startup** so the bridge is usually ready when you sign in.

To disable startup later:

```powershell
.\scripts\Set-Startup.ps1 -Disable
```

## Project root

`C:\Users\Ranzh\grok-link`