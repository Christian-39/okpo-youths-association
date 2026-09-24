/** OYA PWA/update/offline helper. */
(function () {
  "use strict";

  const CONFIG = window.OYA_CONFIG || {};
  const VERSION = CONFIG.APP_VERSION || "2026.09.23.3";
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;
  let waitingWorker = null;

  function qs(sel) { return document.querySelector(sel); }

  function ensureOfflineIndicator() {
    let el = qs(".oya-offline-indicator");
    if (el) return el;
    el = document.createElement("div");
    el.className = "oya-offline-indicator";
    el.textContent = "Offline — showing cached pages where available";
    el.hidden = navigator.onLine;
    document.body.appendChild(el);
    return el;
  }

  function showUpdateBanner() {
    let banner = qs(".oya-pwa-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "oya-pwa-banner";
      banner.setAttribute("role", "status");
      banner.innerHTML = '<div class="oya-pwa-banner__text"><strong>Update available</strong><span>A newer OYA frontend is ready. Refresh to use it.</span></div><div class="oya-pwa-banner__actions"><button type="button" class="oya-pwa-banner__button secondary" data-oya-dismiss-update>Later</button><button type="button" class="oya-pwa-banner__button" data-oya-apply-update>Refresh</button></div>';
      document.body.appendChild(banner);
      banner.querySelector("[data-oya-dismiss-update]").addEventListener("click", () => { banner.hidden = true; });
      banner.querySelector("[data-oya-apply-update]").addEventListener("click", () => {
        if (waitingWorker) waitingWorker.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    }
    banner.hidden = false;
  }

  async function checkVersion() {
    try {
      const res = await fetch("version.json?ts=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version && data.version !== VERSION) showUpdateBanner();
    } catch (_) {
      // Version checks must never block application use.
    }
  }

  function bindOfflineStatus() {
    const el = ensureOfflineIndicator();
    function update() { el.hidden = navigator.onLine; }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      if (registration.waiting) {
        waitingWorker = registration.waiting;
        showUpdateBanner();
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = worker;
            showUpdateBanner();
          }
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (window.__oyaRefreshing) return;
        window.__oyaRefreshing = true;
        window.location.reload();
      });
    } catch (err) {
      console.warn("OYA: service worker registration failed:", err);
    }
  }

  function init() {
    bindOfflineStatus();
    registerServiceWorker();
    checkVersion();
    window.setInterval(checkVersion, CHECK_INTERVAL_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
