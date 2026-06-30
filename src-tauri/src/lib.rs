mod bridge;

use bridge::{managed_state, BridgeState, Handoff, BRIDGE_PORT};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn open_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if url.is_empty() {
        return Err("URL is empty".into());
    }
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn read_clipboard_text() -> Result<String, String> {
    arboard::Clipboard::new()
        .map_err(|e| e.to_string())?
        .get_text()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_clipboard_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|e| e.to_string())?
        .set_text(text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn bridge_port() -> u16 {
    BRIDGE_PORT
}

#[tauri::command]
fn list_handoffs(app: AppHandle) -> Result<Vec<Handoff>, String> {
    let state = managed_state(&app).ok_or("bridge not ready")?;
    Ok(state.list())
}

#[tauri::command]
fn mark_handoff_sent(app: AppHandle, id: String) -> Result<bool, String> {
    let state = managed_state(&app).ok_or("bridge not ready")?;
    Ok(state.mark_sent(&id))
}

#[tauri::command]
fn submit_handoff_response(app: AppHandle, id: String, response: String) -> Result<bool, String> {
    let state = managed_state(&app).ok_or("bridge not ready")?;
    let ok = state.submit_response(&id, response);
    if ok {
        let _ = app.emit("handoff-answered", id);
    }
    Ok(ok)
}

#[tauri::command]
fn refresh_inbox(app: AppHandle) -> Result<Vec<Handoff>, String> {
    let state = managed_state(&app).ok_or("bridge not ready")?;
    state.import_inbox_files();
    Ok(state.list())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = bridge::bridge_data_dir();
            let bridge = Arc::new(BridgeState::new(data_dir));
            app.manage(bridge.clone());
            start_bridge_server(app.handle().clone(), bridge);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_in_browser,
            read_clipboard_text,
            write_clipboard_text,
            bridge_port,
            list_handoffs,
            mark_handoff_sent,
            submit_handoff_response,
            refresh_inbox
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_bridge_server(app: AppHandle, state: Arc<BridgeState>) {
    bridge::start_bridge_server(app, state);
}