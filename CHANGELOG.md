# Changelog

All notable changes to Grok Link are documented here.

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