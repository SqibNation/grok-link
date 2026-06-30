# Grok Link v0.5.1

Bridge between **Grok Build** (IDE coding agent) and **SuperGrok** (browser).

## Highlights

- **Plain-English setup guide** — explains what Grok Link does and walks through setup step by step
- **4-step onboarding** — Tampermonkey install, script copy-paste, confirmation checklist
- **Setup progress bar** — tracks completion before first use
- **System tray** (v0.4+) — close window, bridge keeps running; left-click tray to restore
- **Single-instance** — only one Grok Link process; relaunch focuses existing window
- **Seamless sync** — Tampermonkey browser bridge auto-captures SuperGrok replies

## Downloads

| File | Description |
|------|-------------|
| `Grok-Link-0.5.1-win64.zip` | Full release (portable exe, installer, docs, scripts) |
| `Grok-Link-0.5.1-win64.zip.sha256` | Zip checksum |

Inside the zip:
- `Grok Link 0.5.1.exe` — portable app
- `Grok Link_0.5.1_x64-setup.exe` — NSIS installer (if built)
- `browser/grok-link-bridge.user.js` — Tampermonkey script for auto-sync

## Quick start

1. Verify SHA-256 (see `INSTALL.txt`)
2. Run installer or portable exe
3. Follow the in-app **setup guide** (Tampermonkey + browser script)
4. Keep Grok Link running (tray is fine) while using Grok Build handoffs

## Requirements

- Windows 10+ (64-bit)
- WebView2 runtime
- Tampermonkey (recommended for automatic reply sync)

## Security

Executables are **unsigned**. Prefer building from source if you need full transparency. All handoff data stays local in `%USERPROFILE%\.grok-link\`.

## Full changelog

See [CHANGELOG.md](CHANGELOG.md).