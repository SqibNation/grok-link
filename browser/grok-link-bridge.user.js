// ==UserScript==
// @name         Grok Link Browser Bridge
// @namespace    com.ranzh.grok-link
// @version      0.5.0
// @description  Auto-sync SuperGrok replies back to Grok Build via local Grok Link bridge
// @match        https://grok.com/*
// @match        https://www.grok.com/*
// @match        https://grok.x.ai/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const BRIDGE = "http://127.0.0.1:3877";
  const STABLE_MS = 1500;
  const POLL_MS = 600;
  const MIN_RESPONSE_CHARS = 24;
  const STORAGE_KEY = "grok-link-handoff-id";
  const SYNC_KEY = "grok-link-synced";

  function bridgeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        method,
        url: `${BRIDGE}${path}`,
        headers: { "Content-Type": "application/json" },
        onload(res) {
          resolve({ ok: res.status >= 200 && res.status < 300, status: res.status, text: res.responseText });
        },
        onerror: reject,
      };
      if (body !== undefined) {
        opts.data = JSON.stringify(body);
      }
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest(opts);
        return;
      }
      const init = { method, headers: opts.headers };
      if (body !== undefined) init.body = opts.data;
      fetch(`${BRIDGE}${path}`, init)
        .then(async (res) => {
          resolve({ ok: res.ok, status: res.status, text: await res.text() });
        })
        .catch(reject);
    });
  }

  function storeHandoffId(id) {
    if (!id) return;
    localStorage.setItem(STORAGE_KEY, id);
    sessionStorage.setItem(STORAGE_KEY, id);
  }

  function parseHandoffId() {
    const params = new URLSearchParams(location.search);
    const queryId = params.get("grok-link-id");
    if (queryId && /^[a-f0-9]+$/i.test(queryId)) {
      storeHandoffId(queryId);
      return queryId;
    }

    const hashMatch = location.hash.match(/grok-link-id=([a-f0-9]+)/i);
    if (hashMatch) {
      storeHandoffId(hashMatch[1]);
      return hashMatch[1];
    }

    return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  }

  function showBadge(text, ok, warn, interactive) {
    let el = document.getElementById("grok-link-bridge-badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "grok-link-bridge-badge";
      Object.assign(el.style, {
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: "2147483647",
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "13px",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
        background: "#1e3a5f",
        boxShadow: "0 4px 12px rgba(0,0,0,.45)",
        pointerEvents: interactive ? "auto" : "none",
        maxWidth: "360px",
        lineHeight: "1.35",
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = ok ? "#166534" : warn ? "#854d0e" : "#1e3a5f";
    el.style.pointerEvents = interactive ? "auto" : "none";
    el.style.cursor = interactive ? "pointer" : "default";
  }

  function isLikelyAssistant(el) {
    const role = el.getAttribute?.("data-message-author-role");
    if (role === "assistant") return true;
    const testId = el.getAttribute?.("data-testid") || "";
    if (/assistant|response|bot|grok/i.test(testId) && !/user|human|prompt|input/i.test(testId)) {
      return true;
    }
    const cls = el.className?.toString?.() || "";
    if (/assistant|response|bot/i.test(cls) && !/user|human|prompt|input/i.test(cls)) {
      return true;
    }
    return false;
  }

  function extractMessageBlocks(root) {
    const selectors = [
      "[data-testid*='message']",
      "[data-testid*='response']",
      "[data-message-author-role]",
      "article",
      "[class*='message']",
      "[class*='markdown']",
      "[class*='response']",
      "[role='article']",
    ];
    const seen = new Set();
    const blocks = [];

    for (const sel of selectors) {
      root.querySelectorAll(sel).forEach((el) => {
        if (el.closest("#grok-link-bridge-badge")) return;
        const text = (el.innerText || "").trim();
        if (text.length < MIN_RESPONSE_CHARS || text.length > 80000) return;
        if (seen.has(text)) return;
        seen.add(text);
        blocks.push({ el, text, assistant: isLikelyAssistant(el) });
      });
      if (blocks.length >= 2) break;
    }

    return blocks;
  }

  function pickAssistantText(blocks) {
    if (!blocks.length) return "";

    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].assistant) return blocks[i].text;
    }

    // With multiple blocks, the last one is usually the assistant reply.
    if (blocks.length >= 2) return blocks[blocks.length - 1].text;

    return blocks[0].text;
  }

  function extractLatestAssistantText() {
    const root = document.querySelector("main") || document.body;
    return pickAssistantText(extractMessageBlocks(root));
  }

  async function checkBridgeHealth() {
    try {
      const res = await bridgeRequest("GET", "/api/health");
      return res.ok;
    } catch {
      return false;
    }
  }

  async function checkAlreadyAnswered(id) {
    try {
      const res = await bridgeRequest("GET", `/api/handoffs/${id}`);
      if (!res.ok) return false;
      const data = JSON.parse(res.text);
      return data.status === "answered" && (data.response || "").length > 0;
    } catch {
      return false;
    }
  }

  async function submitResponse(id, text) {
    const res = await bridgeRequest("POST", `/api/handoffs/${id}/response`, { response: text });
    return res.ok;
  }

  async function start(handoffId) {
    if (localStorage.getItem(SYNC_KEY) === handoffId) {
      showBadge("Grok Link: already synced ✓", true);
      return;
    }

    const bridgeOk = await checkBridgeHealth();
    if (!bridgeOk) {
      showBadge("Grok Link: bridge offline — keep app running", false, true);
    } else {
      showBadge(`Grok Link: watching ${handoffId.slice(0, 8)}…`);
    }

    if (await checkAlreadyAnswered(handoffId)) {
      showBadge("Grok Link: already synced ✓", true);
      localStorage.setItem(SYNC_KEY, handoffId);
      return;
    }

    const root = document.querySelector("main") || document.body;
    const initialBlocks = extractMessageBlocks(root);
    let baselineCount = initialBlocks.length;
    let baselineLast = initialBlocks.length ? initialBlocks[initialBlocks.length - 1].text : "";
    let lastSeen = "";
    let stableSince = 0;
    let submitting = false;

    async function trySync(force = false) {
      if (submitting) return;
      const blocks = extractMessageBlocks(root);
      const text = pickAssistantText(blocks);
      if (!text || text.length < MIN_RESPONSE_CHARS) return;

      const hasNewMessage = blocks.length > baselineCount || text !== baselineLast;
      if (!force && !hasNewMessage) return;
      if (!force && baselineLast && text === baselineLast) return;

      if (!force) {
        if (text !== lastSeen) {
          lastSeen = text;
          stableSince = Date.now();
          showBadge(`Grok Link: reply detected (${text.length} chars)…`);
          return;
        }
        if (Date.now() - stableSince < STABLE_MS) return;
      }

      submitting = true;
      showBadge("Grok Link: syncing…");
      try {
        const ok = await submitResponse(handoffId, text);
        if (ok) {
          showBadge("Grok Link: synced ✓", true);
          localStorage.setItem(SYNC_KEY, handoffId);
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        showBadge("Grok Link: sync failed — click badge to retry", false, true, true);
        submitting = false;
      } catch {
        showBadge("Grok Link: bridge unreachable — click badge to retry", false, true, true);
        submitting = false;
      }
    }

    const badge = document.getElementById("grok-link-bridge-badge");
    if (badge && !badge.dataset.grokLinkBound) {
      badge.dataset.grokLinkBound = "1";
      badge.addEventListener("click", () => {
        submitting = false;
        void trySync(true);
      });
    }

    window.setInterval(() => void trySync(false), POLL_MS);

    if (root && typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => void trySync(false));
      obs.observe(root, { childList: true, subtree: true, characterData: true });
    }
  }

  function boot() {
    const id = parseHandoffId();
    if (id) {
      if (localStorage.getItem(SYNC_KEY) !== id) {
        void start(id);
      } else {
        showBadge("Grok Link: already synced ✓", true);
      }
      return;
    }
    showBadge("Grok Link: waiting for handoff id…", false, true);
    let attempts = 0;
    const waitId = window.setInterval(() => {
      attempts += 1;
      const found = parseHandoffId();
      if (found) {
        window.clearInterval(waitId);
        void start(found);
      } else if (attempts > 40) {
        window.clearInterval(waitId);
        showBadge("Grok Link: no handoff id in URL", false, true);
      }
    }, 500);
  }

  window.addEventListener("hashchange", () => {
    const id = parseHandoffId();
    if (id) void start(id);
  });

  boot();
})();