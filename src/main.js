const STORAGE_KEY = "grok-link-settings";

let activeHandoffId = null;
let appVersion = "0.5.0";

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

function showToast(message, kind = "info") {
  const root = document.getElementById("toast-root");
  if (!root || !message) return;
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--visible"));
  setTimeout(() => {
    el.classList.remove("toast--visible");
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

function updateHeroState(mode, title, subtitle) {
  const hero = document.getElementById("status-hero");
  const titleEl = document.getElementById("status-title");
  const subEl = document.getElementById("status-subtitle");
  if (hero) hero.className = `status-hero status-hero--${mode}`;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;
}

function updateSetupSteps(items, bridgeOk) {
  const stepBridge = document.getElementById("step-bridge");
  const stepBrowser = document.getElementById("step-browser");
  const stepReady = document.getElementById("step-ready");
  const browserDone = !!getSettings().browserBridgeStarted;

  if (stepBridge) stepBridge.classList.toggle("done", bridgeOk);
  if (stepBrowser) stepBrowser.classList.toggle("done", browserDone);
  if (stepReady) {
    const hasPending = items.some((h) => h.status === "pending" || h.status === "sent");
    const hasAnswered = items.some((h) => h.status === "answered");
    stepReady.classList.toggle("done", bridgeOk && browserDone && (hasPending || hasAnswered));
  }

  const pill = document.getElementById("bridge-setup-pill");
  if (pill) {
    if (browserDone) {
      pill.textContent = "Setup started";
      pill.className = "pill pill-ok";
    } else {
      pill.textContent = "Not set up";
      pill.className = "pill pill-muted";
    }
  }
}

function toggleOnboarding(show) {
  const panel = document.getElementById("onboarding");
  if (!panel) return;
  panel.classList.toggle("hidden", !show);
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

function buildSuperGrokUrl(text, handoffId = activeHandoffId) {
  const encoded = encodeURIComponent(text);
  const base =
    getSelectedHost() === "xai" ? "https://grok.x.ai/" : "https://grok.com/";
  let url = `${base}?q=${encoded}`;
  if (handoffId) {
    url += `#grok-link-id=${handoffId}`;
  }
  return url;
}

function statusLabel(status) {
  const map = {
    pending: "New",
    sent: "Opened",
    answered: "Done",
  };
  return map[status] || status;
}

function statusClass(status) {
  const map = {
    pending: "pill-warn",
    sent: "pill-info",
    answered: "pill-ok",
  };
  return map[status] || "pill-muted";
}

function formatHandoffMeta(item) {
  const when = item.created_at
    ? new Date(item.created_at * 1000).toLocaleString()
    : "";
  const task = item.task ? item.task : "Handoff";
  return `${task} · ${when}`;
}

function renderHandoffQueue(items) {
  const root = document.getElementById("handoff-queue");
  if (!root) return;

  if (!items.length) {
    root.innerHTML =
      '<p class="empty-note">No messages yet. When Grok Build sends a handoff, it will appear here.</p>';
    updateHeroState(
      "ready",
      "Ready and waiting",
      "Grok Link is running in the background. New messages from Grok Build will show up here."
    );
    return;
  }

  const pending = items.filter((h) => h.status === "pending").length;
  const answered = items.filter((h) => h.status === "answered").length;

  if (pending > 0) {
    updateHeroState(
      "active",
      `${pending} new message${pending === 1 ? "" : "s"}`,
      "Select one below, then click Open SuperGrok."
    );
  } else if (answered > 0) {
    updateHeroState(
      "ready",
      "All caught up",
      "Latest replies are saved for Grok Build. You can close this window — Grok Link stays in the tray."
    );
  } else {
    updateHeroState(
      "ready",
      "Ready",
      "Pick a message below to continue in SuperGrok."
    );
  }

  root.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "handoff-card" + (item.id === activeHandoffId ? " active" : "");
    card.innerHTML = `
      <div class="handoff-card-top">
        <span class="handoff-card-title">${escapeHtml(item.task || "Message")}</span>
        <span class="pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <span class="handoff-card-meta">${escapeHtml(formatHandoffMeta(item))}</span>
      <span class="handoff-card-preview">${escapeHtml((item.message || "").slice(0, 160))}</span>
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

function selectHandoff(item, quiet = false) {
  activeHandoffId = item.id;
  const prompt = document.getElementById("prompt");
  const context = document.getElementById("context");
  const response = document.getElementById("response");
  if (prompt) prompt.value = item.message || "";
  if (context) context.value = item.context || "";
  if (response) response.value = item.response || "";
  if (!quiet) {
    setStatus("status", `Loaded "${item.task || "message"}". Click Open SuperGrok when ready.`);
  }
  void refreshQueue();
}

function pickLatestActionable(items) {
  return (
    items.find((h) => h.status === "pending") ||
    items.find((h) => h.status === "sent") ||
    items[0]
  );
}

async function refreshQueue() {
  try {
    const items = await tauriInvoke("list_handoffs");
    renderHandoffQueue(items || []);
    updateSetupSteps(items || [], true);
    setBridgeOnline(true);
    return items || [];
  } catch (e) {
    setBridgeOnline(false, e.message || String(e));
    updateHeroState("error", "Bridge offline", "Try restarting Grok Link from the desktop shortcut.");
    updateSetupSteps([], false);
    return [];
  }
}

function setBridgeOnline(ok, detail = "") {
  const el = document.getElementById("bridge-status");
  if (!el) return;
  if (ok) {
    const port = document.getElementById("bridge-port")?.textContent || "3877";
    el.textContent = `Technical: bridge online at http://127.0.0.1:${port}/api/handoff`;
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
    setStatus("status", "Enter a message first, or select one from Grok Build.", true);
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
    const linkNote = activeHandoffId
      ? " Reply will auto-sync if the browser bridge is installed."
      : "";
    setStatus(
      "status",
      (copied
        ? `Opened ${host}. Clipboard backup copied.`
        : `Opened ${host}.`) + linkNote
    );
    showToast("SuperGrok opened in your browser", "success");
  } catch (e) {
    setStatus("status", `Could not open browser: ${e.message || e}`, true);
  }
}

async function submitResponse() {
  if (!activeHandoffId) {
    setStatus("response-status", "Select a message from Grok Build first.", true);
    return;
  }
  const text = (document.getElementById("response")?.value || "").trim();
  if (!text) {
    setStatus("response-status", "Paste SuperGrok's reply first.", true);
    return;
  }
  try {
    await tauriInvoke("submit_handoff_response", { id: activeHandoffId, response: text });
    setStatus("response-status", "Saved. Grok Build can pick this up automatically.");
    showToast("Reply saved for Grok Build", "success");
    await refreshQueue();
  } catch (e) {
    setStatus("response-status", `Save failed: ${e.message || e}`, true);
  }
}

async function hideToTray() {
  try {
    await tauriInvoke("hide_to_tray");
    showToast("Running in the system tray. Click the icon to reopen.", "info");
  } catch (e) {
    setStatus("status", `Could not hide: ${e.message || e}`, true);
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

async function installBrowserBridge() {
  try {
    const path = await tauriInvoke("install_browser_bridge");
    saveSettings({ browserBridgeStarted: true });
    updateSetupSteps(await refreshQueue(), true);
    setStatus(
      "bridge-install-status",
      "Tampermonkey and the script file are open. In Tampermonkey: Create script → paste → save → enable on grok.com."
    );
    showToast("Follow the Tampermonkey steps — one-time setup", "info");
  } catch (e) {
    setStatus(
      "bridge-install-status",
      `Could not open installer: ${e.message || e}. Try .\\scripts\\Install-BrowserBridge.ps1`,
      true
    );
  }
}

async function initMeta() {
  try {
    appVersion = await tauriInvoke("app_version");
    const badge = document.getElementById("version-badge");
    if (badge) badge.textContent = `v${appVersion}`;
  } catch {
    const badge = document.getElementById("version-badge");
    if (badge) badge.textContent = "v0.5.0";
  }

  try {
    const port = await tauriInvoke("bridge_port");
    const portEl = document.getElementById("bridge-port");
    if (portEl) portEl.textContent = String(port);
  } catch {
    /* keep default */
  }

  try {
    const dir = await tauriInvoke("data_dir_path");
    const hint = document.getElementById("data-dir-hint");
    if (hint && dir) hint.textContent = dir;
  } catch {
    /* keep default */
  }
}

async function init() {
  const showOnboarding = !getSettings().onboardingDismissed;
  toggleOnboarding(showOnboarding);

  bindOptionsPersistence();
  await initMeta();

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
  document.getElementById("install-bridge-btn")?.addEventListener("click", () => void installBrowserBridge());
  document.getElementById("onboarding-install-btn")?.addEventListener("click", () => void installBrowserBridge());
  document.getElementById("hide-tray-btn")?.addEventListener("click", () => void hideToTray());
  document.getElementById("dismiss-onboarding-btn")?.addEventListener("click", () => {
    saveSettings({ onboardingDismissed: true });
    toggleOnboarding(false);
  });

  document.getElementById("prompt")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void openSuperGrok();
    }
  });

  await tauriListen("handoff-received", async () => {
    const items = await refreshQueue();
    const next = pickLatestActionable(items);
    if (next?.status === "pending") {
      selectHandoff(next, true);
      showToast(`New message from Grok Build: ${next.task || "handoff"}`, "info");
    }
  });

  await tauriListen("handoff-answered", async () => {
    await refreshQueue();
    showToast("Reply synced — Grok Build can continue", "success");
  });

  await tauriInvoke("refresh_inbox").catch(() => {});
  const items = await refreshQueue();
  const next = pickLatestActionable(items);
  if (next?.status === "pending" && !activeHandoffId) {
    selectHandoff(next, true);
  }
}

window.addEventListener("DOMContentLoaded", () => void init());