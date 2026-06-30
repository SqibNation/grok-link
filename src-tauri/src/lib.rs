mod bridge;

use bridge::{managed_state, BridgeState, Handoff, BRIDGE_PORT};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

const BROWSER_BRIDGE_SCRIPT: &str = include_str!("../../browser/grok-link-bridge.user.js");

fn browser_bridge_path() -> PathBuf {
    bridge::bridge_data_dir()
        .join("browser")
        .join("grok-link-bridge.user.js")
}

fn ensure_browser_bridge_script() -> Result<PathBuf, String> {
    let path = browser_bridge_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if !path.exists() {
        fs::write(&path, BROWSER_BRIDGE_SCRIPT).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show Grok Link", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let icon = app
        .default_window_icon()
        .ok_or("missing default window icon")?
        .clone();

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip(&format!("Grok Link — bridge on port {BRIDGE_PORT}"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

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
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn data_dir_path() -> String {
    bridge::bridge_data_dir().to_string_lossy().into_owned()
}

#[tauri::command]
fn hide_to_tray(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("main window not found")?
        .hide()
        .map_err(|e| e.to_string())
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

#[tauri::command]
fn install_browser_bridge(app: AppHandle) -> Result<String, String> {
    let path = ensure_browser_bridge_script()?;
    app.opener()
        .open_url("https://www.tampermonkey.net/", None::<&str>)
        .map_err(|e| e.to_string())?;
    Command::new("notepad.exe")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = bridge::bridge_data_dir();
            let _ = ensure_browser_bridge_script();
            let bridge = Arc::new(BridgeState::new(data_dir));
            app.manage(bridge.clone());
            start_bridge_server(app.handle().clone(), bridge);

            #[cfg(desktop)]
            setup_tray(app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_in_browser,
            read_clipboard_text,
            write_clipboard_text,
            bridge_port,
            app_version,
            data_dir_path,
            hide_to_tray,
            list_handoffs,
            mark_handoff_sent,
            submit_handoff_response,
            refresh_inbox,
            install_browser_bridge
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_bridge_server(app: AppHandle, state: Arc<BridgeState>) {
    bridge::start_bridge_server(app, state);
}