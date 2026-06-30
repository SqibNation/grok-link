# Grok Link v0.3.0

Bridge between **Grok Build** (IDE agent) and **SuperGrok** (browser).

## Highlights

- Local HTTP bridge on `127.0.0.1:3877` for handoffs and replies
- Handoff queue UI with SuperGrok launcher (`grok.com/?q=` prefill)
- **Seamless sync** via Tampermonkey browser bridge (auto-capture SuperGrok replies)
- PowerShell automation: `handoff.ps1`, `handoff-and-wait.ps1`, `poll-handoff.ps1`
- Windows install + startup scripts

## Downloads

| File | Description |
|------|-------------|
| `Grok-Link-0.3.0-win64.zip` | Full release (portable exe, installer, docs, scripts) |
| `Grok-Link-0.3.0-win64.zip.sha256` | Zip checksum |

Inside the zip:
- `Grok Link 0.3.0.exe` — portable app
- `Grok Link_0.3.0_x64-setup.exe` — NSIS installer
- `browser/grok-link-bridge.user.js` — Tampermonkey script for auto-sync

## Quick start

1. Verify SHA-256 (see `INSTALL.txt`)
2. Run installer or portable exe
3. Install browser bridge (Tampermonkey) for seamless reply sync
4. Keep Grok Link running while using Grok Build handoffs

## Requirements

- Windows 10+ (64-bit)
- WebView2 runtime
- Tampermonkey (optional, recommended)

## Security

Executables are **unsigned**. Prefer building from source if you need full transparency. All handoff data stays local in `%USERPROFILE%\.grok-link\`.

## Full changelog

See [CHANGELOG.md](CHANGELOG.md).