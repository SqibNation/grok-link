const APP_VERSION = "0.2.0";
const STORAGE_KEY = "grok-link-settings";

let activeHandoffId = null;

async function tauriInvoke(cmd, args = {}) {
  if (window.__TAURI__?.core?.invoke) {
    return window.__TAURI__.core.invoke(cmd, args);
  }
  throw new Error("Tauri API unavailable");
}

async function tauriListen(event, handler) {
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen === "function") {
    return listen(event, handler);
  }
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSettings(), ...patch }));
}

function setStatus(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function getPromptRaw() {
  return (document.getElementById("prompt")?.value || "").trim();
}

function getContextRaw() {
  return (document.getElementById("context")?.value || "").trim();
}

function composeSuperGrokMessage() {
  const message = getPromptRaw();
  const context = getContextRaw();
  if (!message) return "";
  if (!context) return message;
  return `[Grok Build context]\n${context}\n\n[Message]\n${message}`;
}

function getSelectedHost() {
  const checked = document.querySelector('input[name="grok-host"]:checked');
  return checked?.value === "xai" ? "xai" : "com";
}

function buildSuperGrokUrl(text) {
  if (getSelectedHost() === "xai") {
    return `https://grok.x.ai/?q=${encodeURIComponent(text)}`;
  }
  return "https://grok.com/";
}

function formatHandoffMeta(item) {
  const when = item.created_at
    ? new Date(item.created_at * 1000).toLocaleString()
    : "";
  const task = item.task ? ` · ${item.task}` : "";
  return `${item.status}${task} · ${when}`;
}

function renderHandoffQueue(items) {
  const root = document.getElementById("handoff-queue");
  if (!root) return;

  if (!items.length) {
    root.innerHTML = `<p class="empty-note">No handoffs yet. Grok Build sends messages on port <span id="bridge-port-inline">${document.getElementById("bridge-port")?.textContent || "3877"}</span>.</p>`;
    return;
  }

  root.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "handoff-card" + (item.id === activeHandoffId ? " active" : "");
    card.innerHTML = `
      <span class="handoff-card-title">${escapeHtml(item.task || "Handoff")}</span>
      <span class="handoff-card-meta">${escapeHtml(formatHandoffMeta(item))}</span>
      <span class="handoff-card-preview">${escapeHtml((item.message || "").slice(0, 140))}</span>
    `;
    card.onclick = () => selectHandoff(item);
    root.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function selectHandoff(item) {
  activeHandoffId = item.id;
  const prompt = document.getElementById("prompt");
  const context = document.getElementById("context");
  const response = document.getElementById("response");
  if (prompt) prompt.value = item.message || "";
  if (context) context.value = item.context || "";
  if (response) response.value = item.response || "";
  setStatus("status", `Selected handoff ${item.id.slice(0, 8)}…`);
  void refreshQueue();
}

async function refreshQueue() {
  try {
    const items = await tauriInvoke("list_handoffs");
    renderHandoffQueue(items || []);
    setBridgeOnline(true);
  } catch (e) {
    setBridgeOnline(false, e.message || String(e));
  }
}

function setBridgeOnline(ok, detail = "") {
  const el = document.getElementById("bridge-status");
  if (!el) return;
  if (ok) {
    const port = document.getElementById("bridge-port")?.textContent || "3877";
    el.textContent = `Bridge online at http://127.0.0.1:${port}/api/handoff`;
    el.classList.remove("error");
  } else {
    el.textContent = `Bridge offline${detail ? `: ${detail}` : ""}`;
    el.classList.add("error");
  }
}

async function invokeOpenUrl(url) {
  try {
    await tauriInvoke("open_in_browser", { url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function readClipboard() {
  try {
    return await tauriInvoke("read_clipboard_text");
  } catch {
    return navigator.clipboard.readText();
  }
}

async function writeClipboard(text) {
  try {
    await tauriInvoke("write_clipboard_text", { text });
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

async function pasteFromClipboard() {
  try {
    const text = await readClipboard();
    const prompt = document.getElementById("prompt");
    if (prompt) prompt.value = text || "";
    setStatus("status", text ? "Pasted from clipboard." : "Clipboard is empty.", !text);
    return !!text;
  } catch {
    setStatus("status", "Could not read clipboard.", true);
    return false;
  }
}

async function openSuperGrok() {
  const composed = composeSuperGrokMessage();
  if (!composed) {
    setStatus("status", "Enter a message first.", true);
    return;
  }

  const copyEnabled = document.getElementById("copy-on-open")?.checked !== false;
  const copied = copyEnabled ? await writeClipboard(composed) : false;

  try {
    await invokeOpenUrl(buildSuperGrokUrl(composed));
    if (activeHandoffId) {
      await tauriInvoke("mark_handoff_sent", { id: activeHandoffId });
      await refreshQueue();
    }
    const host = getSelectedHost() === "xai" ? "grok.x.ai" : "grok.com";
    setStatus(
      "status",
      copied
        ? `Opened ${host}. Full message copied to clipboard.`
        : `Opened ${host}.`
    );
  } catch (e) {
    setStatus("status", `Could not open browser: ${e.message || e}`, true);
  }
}

async function submitResponse() {
  if (!activeHandoffId) {
    setStatus("response-status", "Select a handoff from Grok Build first.", true);
    return;
  }
  const text = (document.getElementById("response")?.value || "").trim();
  if (!text) {
    setStatus("response-status", "Paste SuperGrok's reply first.", true);
    return;
  }
  try {
    await tauriInvoke("submit_handoff_response", { id: activeHandoffId, response: text });
    setStatus("response-status", "Saved. Grok Build can read it at GET /api/handoffs/" + activeHandoffId);
    await refreshQueue();
  } catch (e) {
    setStatus("response-status", `Save failed: ${e.message || e}`, true);
  }
}

function bindOptionsPersistence() {
  const saved = getSettings();
  if (saved.host) {
    const radio = document.querySelector(`input[name="grok-host"][value="${saved.host}"]`);
    if (radio) radio.checked = true;
  }
  if (typeof saved.copyOnOpen === "boolean") {
    const copy = document.getElementById("copy-on-open");
    if (copy) copy.checked = saved.copyOnOpen;
  }
  document.querySelectorAll('input[name="grok-host"]').forEach((el) => {
    el.addEventListener("change", () => saveSettings({ host: getSelectedHost() }));
  });
  document.getElementById("copy-on-open")?.addEventListener("change", (e) => {
    saveSettings({ copyOnOpen: e.target.checked });
  });
}

async function initBridgeMeta() {
  try {
    const port = await tauriInvoke("bridge_port");
    const portEl = document.getElementById("bridge-port");
    if (portEl) portEl.textContent = String(port);
  } catch {
    /* keep default */
  }
}

async function init() {
  const badge = document.getElementById("version-badge");
  if (badge) badge.textContent = `v${APP_VERSION}`;

  bindOptionsPersistence();
  await initBridgeMeta();

  document.getElementById("open-btn")?.addEventListener("click", () => void openSuperGrok());
  document.getElementById("paste-btn")?.addEventListener("click", () => void pasteFromClipboard());
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    document.getElementById("prompt").value = "";
    document.getElementById("context").value = "";
    activeHandoffId = null;
    setStatus("status", "Cleared.");
    void refreshQueue();
  });
  document.getElementById("refresh-queue-btn")?.addEventListener("click", () => void refreshQueue());
  document.getElementById("submit-response-btn")?.addEventListener("click", () => void submitResponse());

  document.getElementById("prompt")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void openSuperGrok();
    }
  });

  await tauriListen("handoff-received", () => void refreshQueue());
  await tauriListen("handoff-answered", () => void refreshQueue());
  await refreshQueue();
  await tauriInvoke("refresh_inbox").catch(() => {});
  await refreshQueue();
}

window.addEventListener("DOMContentLoaded", () => void init());