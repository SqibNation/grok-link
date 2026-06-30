//! Local bridge: Grok Build (agent) ↔ Grok Link app ↔ SuperGrok (browser).
//!
//! Handoffs arrive via HTTP (`POST /api/handoff`) or JSON files in `~/.grok-link/inbox/`.
//! Responses are stored for Grok Build to poll (`GET /api/handoffs/{id}`).

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

pub const BRIDGE_PORT: u16 = 3877;

#[derive(Clone, Serialize, Deserialize)]
pub struct Handoff {
    pub id: String,
    pub source: String,
    pub created_at: u64,
    #[serde(default)]
    pub task: String,
    pub message: String,
    #[serde(default)]
    pub context: String,
    pub status: String,
    #[serde(default)]
    pub response: String,
    #[serde(default)]
    pub responded_at: u64,
}

#[derive(Deserialize)]
struct HandoffRequest {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub task: String,
    pub message: String,
    #[serde(default)]
    pub context: String,
}

#[derive(Deserialize)]
struct ResponseRequest {
    pub response: String,
}

pub struct BridgeState {
    handoffs: Arc<Mutex<Vec<Handoff>>>,
    data_dir: PathBuf,
}

impl BridgeState {
    pub fn new(data_dir: PathBuf) -> Self {
        let state = Self {
            handoffs: Arc::new(Mutex::new(Vec::new())),
            data_dir,
        };
        let _ = fs::create_dir_all(state.inbox_dir());
        let _ = fs::create_dir_all(state.store_dir());
        state.load_from_disk();
        state.import_inbox_files();
        state
    }

    fn store_dir(&self) -> PathBuf {
        self.data_dir.join("store")
    }

    fn inbox_dir(&self) -> PathBuf {
        self.data_dir.join("inbox")
    }

    fn handoffs_path(&self) -> PathBuf {
        self.store_dir().join("handoffs.json")
    }

    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    fn new_id() -> String {
        format!("{:x}", Self::now().wrapping_mul(0x9E37_79B9) ^ std::process::id() as u64)
    }

    fn load_from_disk(&self) {
        let path = self.handoffs_path();
        if !path.exists() {
            return;
        }
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(items) = serde_json::from_str::<Vec<Handoff>>(&raw) {
                if let Ok(mut guard) = self.handoffs.lock() {
                    *guard = items;
                }
            }
        }
    }

    fn persist(&self) {
        let path = self.handoffs_path();
        if let Ok(guard) = self.handoffs.lock() {
            if let Ok(json) = serde_json::to_string_pretty(&*guard) {
                let _ = fs::write(path, json);
            }
        }
    }

    pub fn import_inbox_files(&self) {
        let inbox = self.inbox_dir();
        let Ok(entries) = fs::read_dir(&inbox) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(raw) = fs::read_to_string(&path) {
                if let Ok(req) = serde_json::from_str::<HandoffRequest>(&raw) {
                    let _ = self.insert_handoff(req, "inbox-file");
                }
            }
            let _ = fs::remove_file(path);
        }
        self.persist();
    }

    pub fn list(&self) -> Vec<Handoff> {
        self.handoffs.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn get(&self, id: &str) -> Option<Handoff> {
        self.handoffs
            .lock()
            .ok()?
            .iter()
            .find(|h| h.id == id)
            .cloned()
    }

    pub fn insert_handoff(&self, req: HandoffRequest, source: &str) -> Handoff {
        let item = Handoff {
            id: Self::new_id(),
            source: if req.source.is_empty() {
                source.to_string()
            } else {
                req.source
            },
            created_at: Self::now(),
            task: req.task,
            message: req.message,
            context: req.context,
            status: "pending".into(),
            response: String::new(),
            responded_at: 0,
        };
        if let Ok(mut guard) = self.handoffs.lock() {
            guard.insert(0, item.clone());
        }
        self.persist();
        item
    }

    pub fn mark_sent(&self, id: &str) -> bool {
        let mut changed = false;
        if let Ok(mut guard) = self.handoffs.lock() {
            if let Some(item) = guard.iter_mut().find(|h| h.id == id) {
                item.status = "sent".into();
                changed = true;
            }
        }
        if changed {
            self.persist();
        }
        changed
    }

    pub fn submit_response(&self, id: &str, response: String) -> bool {
        let mut changed = false;
        if let Ok(mut guard) = self.handoffs.lock() {
            if let Some(item) = guard.iter_mut().find(|h| h.id == id) {
                item.response = response;
                item.status = "answered".into();
                item.responded_at = Self::now();
                changed = true;
            }
        }
        if changed {
            self.persist();
        }
        changed
    }
}

fn json_response(status: StatusCode, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut res = Response::from_string(body.to_string()).with_status_code(status);
    res.add_header(
        Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap(),
    );
    res.add_header(Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap());
    res
}

fn read_body(request: &mut Request) -> String {
    let mut body = String::new();
    let _ = request.as_reader().read_to_string(&mut body);
    body
}

fn handle_request(
    mut request: Request,
    state: Arc<BridgeState>,
    app: AppHandle,
) {
    let method = request.method().clone();
    let url = request.url().to_string();

    if method == Method::Options {
        let mut res = Response::empty(StatusCode(204));
        res.add_header(Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap());
        res.add_header(
            Header::from_bytes("Access-Control-Allow-Methods", "GET, POST, OPTIONS").unwrap(),
        );
        res.add_header(
            Header::from_bytes("Access-Control-Allow-Headers", "Content-Type").unwrap(),
        );
        let _ = request.respond(res);
        return;
    }

    let response = if url == "/api/health" && method == Method::Get {
        json_response(
            StatusCode(200),
            r#"{"ok":true,"service":"grok-link-bridge"}"#,
        )
    } else if url == "/api/handoffs" && method == Method::Get {
        let items = state.list();
        json_response(StatusCode(200), &serde_json::to_string(&items).unwrap_or_else(|_| "[]".into()))
    } else if url == "/api/handoff" && method == Method::Post {
        let body = read_body(&mut request);
        match serde_json::from_str::<HandoffRequest>(&body) {
            Ok(req) if !req.message.trim().is_empty() => {
                let item = state.insert_handoff(req, "grok-build");
                let _ = app.emit("handoff-received", item.clone());
                json_response(StatusCode(201), &serde_json::to_string(&item).unwrap_or_default())
            }
            Ok(_) => json_response(StatusCode(400), r#"{"error":"message is required"}"#),
            Err(e) => json_response(
                StatusCode(400),
                &format!(r#"{{"error":"invalid json: {}"}}"#, e),
            ),
        }
    } else if url.starts_with("/api/handoffs/") {
        let rest = url.trim_start_matches("/api/handoffs/");
        if let Some((id, action)) = rest.split_once('/') {
            if action == "response" && method == Method::Post {
                let body = read_body(&mut request);
                match serde_json::from_str::<ResponseRequest>(&body) {
                    Ok(req) if !req.response.trim().is_empty() => {
                        if state.submit_response(id, req.response) {
                            let _ = app.emit("handoff-answered", id.to_string());
                            json_response(StatusCode(200), r#"{"ok":true}"#)
                        } else {
                            json_response(StatusCode(404), r#"{"error":"not found"}"#)
                        }
                    }
                    Ok(_) => json_response(StatusCode(400), r#"{"error":"response is required"}"#),
                    Err(e) => json_response(
                        StatusCode(400),
                        &format!(r#"{{"error":"invalid json: {}"}}"#, e),
                    ),
                }
            } else {
                json_response(StatusCode(404), r#"{"error":"not found"}"#)
            }
        } else if method == Method::Get {
            let id = rest.trim_end_matches('/');
            match state.get(id) {
                Some(item) => json_response(
                    StatusCode(200),
                    &serde_json::to_string(&item).unwrap_or_default(),
                ),
                None => json_response(StatusCode(404), r#"{"error":"not found"}"#),
            }
        } else {
            json_response(StatusCode(404), r#"{"error":"not found"}"#)
        }
    } else {
        json_response(StatusCode(404), r#"{"error":"not found"}"#)
    };

    let _ = request.respond(response);
}

pub fn bridge_data_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".grok-link")
}

pub fn start_bridge_server(app: AppHandle, state: Arc<BridgeState>) {
    thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", BRIDGE_PORT);
        let Ok(server) = Server::http(&addr) else {
            eprintln!("Grok Link bridge: could not bind {}", addr);
            return;
        };
        for request in server.incoming_requests() {
            let state = state.clone();
            let app = app.clone();
            thread::spawn(move || handle_request(request, state, app));
        }
    });
}

pub fn managed_state(app: &AppHandle) -> Option<Arc<BridgeState>> {
    app.try_state::<Arc<BridgeState>>().map(|s| s.inner().clone())
}