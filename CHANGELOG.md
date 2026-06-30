# Changelog

All notable changes to Grok Link are documented here.

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