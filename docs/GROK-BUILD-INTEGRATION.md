# Grok Build ↔ SuperGrok integration

Grok Link is the local bridge between **Grok Build** (IDE agent) and **SuperGrok** (browser).

## Flow

1. **Grok Build** sends a handoff (message + optional context/task).
2. **Grok Link** shows it in the queue and opens SuperGrok when you click **Open SuperGrok**.
3. You work with SuperGrok in the browser.
4. You paste SuperGrok's reply into **Reply to Grok Build**.
5. **Grok Build** polls the bridge API and continues with the answer.

## Requirements

- Grok Link app must be running (tray/window open).
- Bridge listens on `http://127.0.0.1:3877` (localhost only).

## Send a handoff (Grok Build / shell)

```powershell
.\scripts\handoff.ps1 -Message "Review this API design" -Task "claim-clash-export" -Context "Files: src/session-export.js"
```

Or HTTP:

```powershell
$body = @{
  source = "grok-build"
  task = "integrate-feature"
  message = "What is the best way to ..."
  context = "Project: grok-link. Constraint: Windows Tauri."
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3877/api/handoff" -Method Post -Body $body -ContentType "application/json"
```

If Grok Link is not running, drop JSON into:

`%USERPROFILE%\.grok-link\inbox\anything.json`

Grok Link imports inbox files on launch.

## Poll a response (Grok Build)

```powershell
Invoke-RestMethod "http://127.0.0.1:3877/api/handoffs/{id}"
```

When `status` is `answered`, read the `response` field.

## Health check

```powershell
Invoke-RestMethod "http://127.0.0.1:3877/api/health"
```

## Suggested Grok Build usage

When you need SuperGrok for functions, updates, or research Grok Build cannot do in-browser:

1. Run `handoff.ps1` with a clear `task` and `message`.
2. Tell the user: "Handoff sent to Grok Link. Open SuperGrok, then paste the reply back."
3. Poll `GET /api/handoffs/{id}` until `status` is `answered`.
4. Continue with `response` text.

## Data storage

`%USERPROFILE%\.grok-link\store\handoffs.json`