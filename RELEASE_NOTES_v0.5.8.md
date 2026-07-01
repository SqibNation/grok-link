# Grok Link v0.5.8

Bridge between **Grok Build** (IDE coding agent) and **SuperGrok** (browser).

## Highlights

- **Browser bridge v0.5.0** — smarter reply detection, click-to-retry on sync failures
- **Reliable handoff IDs** — `grok-link-id` in URL query string survives grok.com SPA navigation
- **Long message safety** — URL payload capped to avoid HTTP 431 errors on large handoffs
- **Browser bridge test** — `Test-BrowserBridge.ps1` for end-to-end verification

## Downloads

| File | Description |
|------|-------------|
| `Grok-Link-0.5.8-win64.zip` | Full release (portable exe, installer, docs, scripts) |
| `Grok-Link-0.5.8-win64.zip.sha256` | Zip checksum |

Inside the zip:

- `Grok Link 0.5.8.exe` — portable app
- `Grok Link_0.5.8_x64-setup.exe` — NSIS installer
- `browser/grok-link-bridge.user.js` — Tampermonkey script (v0.5.0)
- `scripts/` — handoff, poll, bridge test, install helpers

## Quick start

1. Verify SHA-256 (see `INSTALL.txt`)
2. Run installer or portable exe
3. Follow the in-app **setup guide** — install Tampermonkey, click **Install browser bridge**
4. Keep Grok Link running (tray is fine). Minimize or close hides to tray; click the tray icon to restore.

## Requirements

- Windows 10+ (64-bit)
- WebView2 runtime
- Tampermonkey (recommended for automatic reply sync)

## Security

Executables are **unsigned**. Prefer building from source if you need full transparency. All handoff data stays local in `%USERPROFILE%\.grok-link\`.

## Full changelog

See [CHANGELOG.md](CHANGELOG.md).