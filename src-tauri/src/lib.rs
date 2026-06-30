mod bridge;

use bridge::{managed_state, BridgeState, Handoff, BRIDGE_PORT};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
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

fn userscript_version(content: &str) -> Option<&str> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.starts_with("// @version") {
            trimmed.split_whitespace().last()
        } else {
            None
        }
    })
}

fn file_url_for_path(path: &PathBuf) -> Result<String, String> {
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    let mut s = canonical.to_string_lossy().to_string();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        s = stripped.to_string();
    }
    Ok(format!("file:///{}", s.replace('\\', "/")))
}

fn ensure_browser_bridge_script() -> Result<PathBuf, String> {
    let path = browser_bridge_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bundled_ver = userscript_version(BROWSER_BRIDGE_SCRIPT);
    let needs_write = match fs::read_to_string(&path) {
        Ok(existing) => userscript_version(&existing) != bundled_ver,
        Err(_) => true,
    };
    if needs_write {
        fs::write(&path, BROWSER_BRIDGE_SCRIPT).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(false);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("window-shown", ());
    }
}

fn minimize_to_tray(app: &AppHandle, label: &str) {
    let app = app.clone();
    let label = label.to_string();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(120));
        let Some(window) = app.get_webview_window(&label) else {
            return;
        };
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
            let _ = hide_main_to_tray(&window);
        }
    });
}

fn hide_main_to_tray(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_skip_taskbar(true)
        .map_err(|e| format!("set_skip_taskbar: {e}"))?;
    window.hide().map_err(|e| format!("hide: {e}"))
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show Grok Link", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let icon = app
        .default_window_icon()
        .ok_or("missing default window icon")?
        .clone();

    let tray = TrayIconBuilder::new()
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

    // Keep the tray icon alive for the lifetime of the app.
    app.manage(tray);

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
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    hide_main_to_tray(&window)
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
fn browser_bridge_version() -> Result<String, String> {
    Ok(userscript_version(BROWSER_BRIDGE_SCRIPT)
        .unwrap_or("unknown")
        .to_string())
}

#[tauri::command]
fn install_browser_bridge(app: AppHandle) -> Result<String, String> {
    let path = ensure_browser_bridge_script()?;
    let file_url = file_url_for_path(&path)?;
    if app.opener().open_url(&file_url, None::<&str>).is_err() {
        Command::new("notepad.exe")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
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
            match event {
                WindowEvent::Focused(false) => {
                    minimize_to_tray(window.app_handle(), window.label());
                }
                WindowEvent::CloseRequested { api, .. } => {
                    if let Some(webview) =
                        window.app_handle().get_webview_window(window.label())
                    {
                        let _ = hide_main_to_tray(&webview);
                    }
                    api.prevent_close();
                }
                _ => {}
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
            install_browser_bridge,
            browser_bridge_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_bridge_server(app: AppHandle, state: Arc<BridgeState>) {
    bridge::start_bridge_server(app, state);
}