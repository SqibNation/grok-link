# Changelog

All notable changes to Grok Link are documented here.

## [0.5.8] - 2026-07-01

### Added
- `Test-BrowserBridge.ps1` — end-to-end browser bridge test (creates handoff, opens SuperGrok, polls for auto-sync)

### Changed
- Browser bridge userscript v0.5.0: better assistant reply detection, click badge to retry failed sync
- SuperGrok URLs include `grok-link-id` query param (survives SPA navigation better than hash alone)
- Long handoff messages truncate URL payload to avoid grok.com HTTP 431 errors

## [0.5.7] - 2026-06-30

### Changed
- Removed non-working **Hide to tray** button (minimize and close already go to tray)

### Fixed
- Status hero no longer stuck on "Starting…" — inline bridge poll + refresh on tray restore
- Minimize (−) sends window to tray instead of the taskbar (v0.5.6)
- Tauri command ACL permissions for bridge/UI invoke (v0.5.6)
- `poll-handoff.ps1` auto-restarts Grok Link when bridge drops during long waits

## [0.5.6] - 2026-06-30

### Fixed
- Minimize button hides to tray (not taskbar)
- Status hero updates via HTTP + Tauri; refreshes when window restored from tray
- App command permissions (`allow-app-commands`) for reliable invoke

## [0.5.5] - 2026-06-30

### Fixed
- Hide-to-tray uses Rust `main` window lookup
- Status hero updates when setup incomplete

## [0.5.4] - 2026-06-30

### Added
- `Test-GrokLinkBridge.ps1` — synthetic bridge round-trip test
- `Ensure-GrokLinkRunning` / `Wait-ForGrokLink` in bridge scripts
- One-click Tampermonkey install via `file://` URL
- Userscript v0.4.0: `GM_xmlhttpRequest`, faster sync, auto-update on disk

### Changed
- Browser bridge install flow — no Notepad copy-paste required

## [0.5.3] - 2026-06-30

### Fixed
- Hide to tray: keep tray icon alive, set skip-taskbar on Windows, add window permissions
- Close-to-tray uses the same hide path as the Hide to tray button

## [0.5.2] - 2026-06-30

### Changed
- Documentation: replaced personal Windows paths with generic clone placeholders (`grok-link`, `$GrokLink`)

## [0.5.1] - 2026-06-30

### Changed
- Full plain-English setup guide: what Grok Link does, visual flow, and 4 numbered setup steps
- Step-by-step Tampermonkey and script install instructions (with confirm buttons)
- Setup progress bar; guide stays visible until user finishes setup
- "Finish later" banner + reopen guide anytime; blocks Open SuperGrok until setup complete

## [0.5.0] - 2026-06-30

### Added
- First-run onboarding with 3-step setup guide (dismissible)
- Status hero: plain-language ready / new messages / error states
- Toast notifications for new handoffs, SuperGrok opens, and synced replies
- **Hide to tray** button with clear tray behavior messaging
- Auto-select newest pending handoff when Grok Build sends a message
- Status pills on message cards (New / Opened / Done)

### Changed
- Simpler UI copy and workflow-focused layout
- Technical bridge details moved to Advanced options
- App version and data folder shown from the running app

## [0.4.0] - 2026-06-30

### Added
- System tray icon: closing the window hides to tray; bridge keeps running
- Tray menu: Show Grok Link, Quit
- Left-click tray icon to restore the window
- Single-instance lock: only one Grok Link process; relaunch focuses existing window

## [0.3.0] - 2026-06-30

### Added
- Seamless bridge: Tampermonkey userscript auto-syncs SuperGrok replies to Grok Build
- Handoff ID in SuperGrok URL hash (`#grok-link-id=...`)
- Scripts: `handoff-and-wait.ps1`, `poll-handoff.ps1`, `open-supergrok.ps1`, `Start-GrokLink.ps1`
- Browser bridge install flow in the app UI
- `bridge-common.ps1` shared helpers

### Fixed
- SuperGrok prefill now uses `grok.com/?q=` (v0.2.1)

## [0.2.0] - 2026-06-29

### Added
- Local HTTP bridge on port 3877 (`bridge.rs`)
- Handoff queue UI and reply capture
- Inbox file fallback when bridge is offline
- `handoff.ps1`, install/startup scripts
- Grok Build integration docs and skill

## [0.1.0] - 2026-06-29

### Added
- Initial Tauri app: open SuperGrok, clipboard paste, manual message compose