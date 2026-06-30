const STORAGE_KEY = "grok-link-settings";

let activeHandoffId = null;
let appVersion = "0.5.2";
let bridgeOk = false;

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

function isSetupComplete() {
  return !!getSettings().setupComplete;
}

function setupProgress() {
  const s = getSettings();
  let done = 0;
  if (bridgeOk) done += 1;
  if (s.tampermonkeyInstalled) done += 1;
  if (s.browserBridgeStarted) done += 1;
  if (s.browserBridgeConfirmed) done += 1;
  return { done, total: 4 };
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
  }, 5000);
}

function updateHeroState(mode, title, subtitle) {
  const hero = document.getElementById("status-hero");
  const titleEl = document.getElementById("status-title");
  const subEl = document.getElementById("status-subtitle");
  if (hero) hero.className = `status-hero status-hero--${mode}`;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;
}

function updateBridgeHero(items = [], online = bridgeOk) {
  if (!online) {
    updateHeroState("ready", "Connecting...", "Checking bridge...");
    return;
  }

  const pending = items.filter((h) => h.status === "pending").length;
  const setupDone = isSetupComplete();

  if (!setupDone) {
    if (pending > 0) {
      updateHeroState(
        "active",
        `${pending} new question${pending === 1 ? "" : "s"}`,
        "Complete setup above so SuperGrok replies sync back automatically."
      );
    } else {
      updateHeroState(
        "ready",
        "Grok Link is running",
        "Complete the setup guide so replies sync back automatically."
      );
    }
    return;
  }

  if (pending > 0) {
    updateHeroState(
      "active",
      `${pending} new question${pending === 1 ? "" : "s"}`,
      "Click one below, then press Open SuperGrok."
    );
  } else if (!items.length) {
    updateHeroState(
      "ready",
      "Ready and waiting",
      "Grok Link is running. New questions from Grok Build will show up here."
    );
  } else {
    updateHeroState("ready", "All caught up", "Latest answers are saved for Grok Build.");
  }
}

function renderGuideUI() {
  const complete = isSetupComplete();
  const { done, total } = setupProgress();
  const s = getSettings();

  const guide = document.getElementById("setup-guide");
  const collapsed = document.getElementById("how-it-works-collapsed");
  const banner = document.getElementById("setup-banner");
  const showGuideBtn = document.getElementById("show-guide-btn");
  const collapseBtn = document.getElementById("collapse-guide-btn");

  if (guide) guide.classList.toggle("hidden", complete && getSettings().guideCollapsed);
  if (collapsed) collapsed.classList.toggle("hidden", !complete);
  if (banner) {
    const showBanner = !complete && getSettings().guideCollapsed;
    banner.classList.toggle("hidden", !showBanner);
  }
  if (showGuideBtn) showGuideBtn.classList.toggle("hidden", !complete && !getSettings().guideCollapsed);
  if (collapseBtn) collapseBtn.classList.toggle("hidden", complete);

  const progressText = document.getElementById("guide-progress-text");
  const progressFill = document.getElementById("guide-progress-fill");
  const progressBar = document.querySelector(".guide-progress-bar");
  if (progressText) {
    progressText.textContent =
      complete
        ? "Setup complete — you're ready to use Grok Link"
        : `Setup: ${done} of ${total} steps done`;
  }
  if (progressFill) progressFill.style.width = `${Math.round((done / total) * 100)}%`;
  if (progressBar) progressBar.setAttribute("aria-valuenow", String(done));

  const steps = [
    { id: 1, done: bridgeOk },
    { id: 2, done: !!s.tampermonkeyInstalled },
    { id: 3, done: !!s.browserBridgeStarted },
    { id: 4, done: !!s.browserBridgeConfirmed },
  ];

  steps.forEach(({ id, done: stepDone }) => {
    const el = document.getElementById(`guide-step-${id}`);
    const badge = document.getElementById(`badge-step-${id}`);
    if (el) el.classList.toggle("done", stepDone);
    if (badge) {
      badge.textContent = stepDone ? "✓" : String(id);
      badge.classList.toggle("done", stepDone);
    }
  });

  const confirmBox = document.getElementById("confirm-bridge-checkbox");
  const completeBtn = document.getElementById("complete-setup-btn");
  if (confirmBox) confirmBox.checked = !!s.browserBridgeConfirmed;
  if (completeBtn) {
    completeBtn.disabled = !confirmBox?.checked;
  }

  if (!complete && bridgeOk) {
    const next = !s.tampermonkeyInstalled
      ? "guide-step-2"
      : !s.browserBridgeStarted
        ? "guide-step-3"
        : "guide-step-4";
    document.querySelectorAll(".guide-step:not(.guide-step--daily)").forEach((d) => {
      d.open = d.id === next;
    });
  }

  // Hero text is driven by updateBridgeHero() after queue refresh.
}

function showFullGuide() {
  saveSettings({ guideCollapsed: false, setupComplete: false });
  const collapsed = document.getElementById("how-it-works-collapsed");
  const guide = document.getElementById("setup-guide");
  if (collapsed) collapsed.classList.add("hidden");
  if (guide) guide.classList.remove("hidden");
  renderGuideUI();
  guide?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collapseGuideLater() {
  saveSettings({ guideCollapsed: true });
  renderGuideUI();
  showToast("Setup guide hidden — use “Setup guide” in the header to continue", "info");
}

function finishSetup() {
  if (!document.getElementById("confirm-bridge-checkbox")?.checked) {
    showToast("Check the box to confirm you've enabled the script on grok.com", "info");
    return;
  }
  saveSettings({
    browserBridgeConfirmed: true,
    setupComplete: true,
    guideCollapsed: true,
  });
  renderGuideUI();
  showToast("You're all set! Grok Build and SuperGrok can now work together.", "success");
}

async function openTampermonkey() {
  try {
    await tauriInvoke("open_in_browser", { url: "https://www.tampermonkey.net/" });
    showToast("Install Tampermonkey for your browser, then click “I've installed Tampermonkey”", "info");
  } catch (e) {
    showToast(`Could not open browser: ${e.message || e}`, "info");
  }
}

function confirmTampermonkey() {
  saveSettings({ tampermonkeyInstalled: true });
  renderGuideUI();
  showToast("Great — next, add the Grok Link script (Step 3)", "success");
  document.getElementById("guide-step-3")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function installBrowserBridge() {
  try {
    const path = await tauriInvoke("install_browser_bridge");
    saveSettings({ browserBridgeStarted: true });
    const hint = document.getElementById("script-path-hint");
    if (hint) hint.textContent = `Script file: ${path}`;
    renderGuideUI();
    showToast("Tampermonkey should offer Install or Update — click it in your browser", "info");
    document.getElementById("guide-step-4")?.open = true;
  } catch (e) {
    showToast(`Could not open script: ${e.message || e}`, "info");
  }
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
  if (handoffId) url += `#grok-link-id=${handoffId}`;
  return url;
}

function statusLabel(status) {
  return { pending: "New", sent: "Opened", answered: "Done" }[status] || status;
}

function statusClass(status) {
  return { pending: "pill-warn", sent: "pill-info", answered: "pill-ok" }[status] || "pill-muted";
}

function formatHandoffMeta(item) {
  const when = item.created_at ? new Date(item.created_at * 1000).toLocaleString() : "";
  return `${item.task || "Message"} · ${when}`;
}

function renderHandoffQueue(items) {
  const root = document.getElementById("handoff-queue");
  if (!root) return;

  if (!items.length) {
    root.innerHTML = isSetupComplete()
      ? '<p class="empty-note">No messages yet. When Grok Build needs SuperGrok, a question will appear here.</p>'
      : '<p class="empty-note">No messages yet. Finish setup above first, then Grok Build can send questions here.</p>';
    updateBridgeHero(items);
    renderGuideUI();
    return;
  }

  updateBridgeHero(items);

  root.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "handoff-card" + (item.id === activeHandoffId ? " active" : "");
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
  renderGuideUI();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function selectHandoff(item, quiet = false) {
  activeHandoffId = item.id;
  document.getElementById("prompt").value = item.message || "";
  document.getElementById("context").value = item.context || "";
  document.getElementById("response").value = item.response || "";
  if (!quiet) {
    setStatus("status", `Loaded "${item.task || "question"}". Click Open SuperGrok when ready.`);
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

function bridgePort() {
  return Number(document.getElementById("bridge-port")?.textContent || 3877);
}

async function fetchHandoffsHttp() {
  const port = bridgePort();
  const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`, { cache: "no-store" });
  if (!healthRes.ok) return null;
  const health = await healthRes.json();
  if (!health.ok) return null;
  const listRes = await fetch(`http://127.0.0.1:${port}/api/handoffs`, { cache: "no-store" });
  if (!listRes.ok) return null;
  return listRes.json();
}

async function refreshQueue() {
  try {
    const items = await tauriInvoke("list_handoffs");
    bridgeOk = true;
    renderHandoffQueue(items || []);
    setBridgeOnline(true);
    renderGuideUI();
    return items || [];
  } catch {
    // fall through to HTTP
  }

  try {
    const httpItems = await fetchHandoffsHttp();
    if (httpItems) {
      bridgeOk = true;
      renderHandoffQueue(httpItems);
      setBridgeOnline(true);
      renderGuideUI();
      return httpItems;
    }
  } catch {
    // both paths failed
  }

  bridgeOk = false;
  setBridgeOnline(false);
  updateHeroState("error", "Grok Link isn't responding", "Try the desktop shortcut or restart from the system tray.");
  renderGuideUI();
  return [];
}

function setBridgeOnline(ok, detail = "") {
  const el = document.getElementById("bridge-status");
  if (!el) return;
  if (ok) {
    const port = document.getElementById("bridge-port")?.textContent || "3877";
    el.textContent = `Connection OK (local port ${port}). Not exposed to the internet.`;
    el.classList.remove("error");
  } else {
    el.textContent = `Connection problem${detail ? `: ${detail}` : ""}`;
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
    document.getElementById("prompt").value = text || "";
    setStatus("status", text ? "Pasted from clipboard." : "Clipboard is empty.", !text);
  } catch {
    setStatus("status", "Could not read clipboard.", true);
  }
}

async function openSuperGrok() {
  const composed = composeSuperGrokMessage();
  if (!composed) {
    setStatus("status", "Select a message from Grok Build first, or type a question.", true);
    return;
  }
  if (!isSetupComplete()) {
    setStatus("status", "Finish setup first so SuperGrok's answer syncs back automatically.", true);
    showFullGuide();
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
    setStatus(
      "status",
      (copied ? "Opened SuperGrok. Question copied to clipboard too. " : "Opened SuperGrok. ") +
        "Answer in the browser — Grok Build will get it automatically."
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
    setStatus("response-status", "Paste SuperGrok's answer first.", true);
    return;
  }
  try {
    await tauriInvoke("submit_handoff_response", { id: activeHandoffId, response: text });
    setStatus("response-status", "Saved. Grok Build can read this answer now.");
    showToast("Answer saved for Grok Build", "success");
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
    document.getElementById("copy-on-open").checked = saved.copyOnOpen;
  }
  document.querySelectorAll('input[name="grok-host"]').forEach((el) => {
    el.addEventListener("change", () => saveSettings({ host: getSelectedHost() }));
  });
  document.getElementById("copy-on-open")?.addEventListener("change", (e) => {
    saveSettings({ copyOnOpen: e.target.checked });
  });
}

async function initMeta() {
  try {
    appVersion = await tauriInvoke("app_version");
    document.getElementById("version-badge").textContent = `v${appVersion}`;
  } catch {
    document.getElementById("version-badge").textContent = "v0.5.7";
  }
  try {
    const port = await tauriInvoke("bridge_port");
    document.getElementById("bridge-port").textContent = String(port);
    bridgeOk = true;
    setBridgeOnline(true);
    updateBridgeHero([], true);
    renderGuideUI();
  } catch { /* default */ }
  try {
    const dir = await tauriInvoke("data_dir_path");
    const hint = document.getElementById("data-dir-hint");
    if (hint && dir) hint.textContent = dir;
  } catch { /* default */ }
}

function bindGuideEvents() {
  document.getElementById("open-tampermonkey-btn")?.addEventListener("click", () => void openTampermonkey());
  document.getElementById("confirm-tampermonkey-btn")?.addEventListener("click", confirmTampermonkey);
  document.getElementById("guide-install-script-btn")?.addEventListener("click", () => void installBrowserBridge());
  document.getElementById("complete-setup-btn")?.addEventListener("click", finishSetup);
  document.getElementById("collapse-guide-btn")?.addEventListener("click", collapseGuideLater);
  document.getElementById("show-guide-btn")?.addEventListener("click", showFullGuide);
  document.getElementById("banner-show-guide-btn")?.addEventListener("click", showFullGuide);
  document.getElementById("reopen-full-guide-btn")?.addEventListener("click", showFullGuide);

  document.getElementById("confirm-bridge-checkbox")?.addEventListener("change", (e) => {
    saveSettings({ browserBridgeConfirmed: e.target.checked });
    document.getElementById("complete-setup-btn").disabled = !e.target.checked;
    renderGuideUI();
  });
}

function bindVisibilityRefresh() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshQueue();
    }
  });
  void tauriListen("window-shown", () => {
    void refreshQueue();
  });
}

async function init() {
  bindOptionsPersistence();
  bindGuideEvents();
  bindVisibilityRefresh();
  void refreshQueue();
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
  document.getElementById("prompt")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void openSuperGrok();
    }
  });

  void tauriListen("handoff-received", async () => {
    const items = await refreshQueue();
    const next = pickLatestActionable(items);
    if (next?.status === "pending") {
      selectHandoff(next, true);
      showToast(`New question from Grok Build: ${next.task || "handoff"}`, "info");
    }
  });

  void tauriListen("handoff-answered", async () => {
    await refreshQueue();
    showToast("Answer synced — Grok Build can continue", "success");
  });

  await tauriInvoke("refresh_inbox").catch(() => {});
  const items = await refreshQueue();
  renderGuideUI();

  const next = pickLatestActionable(items);
  if (next?.status === "pending" && !activeHandoffId) {
    selectHandoff(next, true);
  }

  if (!isSetupComplete() && !getSettings().guideCollapsed) {
    showToast("New here? Start with the setup guide above.", "info");
  }
}

window.addEventListener("DOMContentLoaded", () => void init());