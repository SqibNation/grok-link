# Grok Link

**Bridge between Grok Build and SuperGrok.**

Grok Build (the IDE coding agent) sends handoffs to this app. You open SuperGrok in the browser; with the browser bridge installed, replies sync back automatically so Grok Build can continue.

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
git clone https://github.com/user/grok-link.git
cd grok-link
npm install
npm run tauri dev
```

Use whatever folder you cloned into (e.g. `C:\dev\grok-link` or `%USERPROFILE%\grok-link`).

Keep Grok Link running while you use the bridge.

## Seamless bridge (v0.4+)

1. In Grok Link: complete the setup guide — **Install browser bridge** (one-click Tampermonkey install).
2. From Grok Build:

```powershell
.\scripts\handoff-and-wait.ps1 -Message "Your question" -Task "label" -Context "project context"
```

SuperGrok opens, replies auto-sync back to Grok Build.

## Send from Grok Build (manual)

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

Closing the window or clicking **minimize** hides Grok Link to the **system tray**; the bridge keeps running. Left-click the tray icon to restore. Only one instance runs at a time.

**First launch:** follow the in-app setup guide (plain English) to install Tampermonkey and the browser helper script.

To disable startup later:

```powershell
.\scripts\Set-Startup.ps1 -Disable
```

End-user guide: [INSTALL.txt](INSTALL.txt)

## Distribution

### Package a release zip

```powershell
.\scripts\Package-Release.ps1
```

Creates `dist/release/Grok-Link-{version}-win64.zip` with:

- Portable exe + SHA-256 checksum
- NSIS installer (if already built)
- Browser bridge userscript
- LICENSE, INSTALL.txt, CHANGELOG, docs, scripts

Rebuild and package in one step:

```powershell
.\scripts\Package-Release.ps1 -Build
```

### Verify a download

```powershell
Get-FileHash -Algorithm SHA256 "dist\release\Grok-Link-0.5.8-win64.zip"
# Compare with dist\release\Grok-Link-0.5.8-win64.zip.sha256
```

### Security note

Executables are **not code-signed**. Windows may show SmartScreen warnings for unsigned binaries. For maximum trust, clone this repo and build locally with `.\scripts\build.ps1`.

### Prerequisites (for users)

- Windows 10+ (64-bit)
- WebView2 runtime (preinstalled on most Windows 11 systems)
- Tampermonkey (optional, for seamless SuperGrok reply sync)

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Zachary H. Roberts.