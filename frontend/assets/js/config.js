/**
 * OYA Frontend — Central Configuration
 *
 * For static hosting, define window.OYA_RUNTIME_CONFIG in an optional
 * config.runtime.js loaded before this file, or set localStorage.oya_api_base_url
 * during local/staging verification. Do not hardcode secrets here.
 */
(function () {
  "use strict";

  const APP_VERSION = "2026.09.23.3";
  const runtime = window.OYA_RUNTIME_CONFIG || {};
  const hostname = window.location.hostname;
  const isLocal = (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local")
  );

  function stored(name) {
    try { return window.localStorage.getItem(name) || ""; } catch (_) { return ""; }
  }

  /**
   * Resolve the frontend's own deployment root, independent of whichever
   * page happens to be open. This is what shared components (sidebar,
   * topbar, mobile header/nav, footer) are fetched relative to, so the
   * frontend keeps working whether it's served from a domain root, a
   * subpath, `python -m http.server`, or a static host like Vercel.
   *
   * `document.currentScript` — read synchronously while this script tag
   * is executing — gives us this script's own absolute URL, which is a
   * reliable anchor: it does not depend on window.location.pathname of
   * whatever page included it.
   */
  function computeFrontendBase() {
    try {
      const scriptEl = document.currentScript;
      if (scriptEl && scriptEl.src) {
        const url = new URL(scriptEl.src, window.location.href);
        const root = url.pathname.replace(/assets\/js\/config\.js(?:\?.*)?$/, "");
        return url.origin + root;
      }
    } catch (_) { /* fall through to the pathname-based fallback below */ }
    // Fallback: derive from the current page's own directory. Every page
    // in this frontend lives at the same directory depth, so this is
    // still correct even if config.js couldn't be located above.
    const path = window.location.pathname.replace(/[^/]*$/, "");
    return window.location.origin + path;
  }

  const defaultApiBase = isLocal ? "http://127.0.0.1:8000" : "https://okpo-youths-association.onrender.com";
  const API_BASE_URL = String(runtime.API_BASE_URL || stored("oya_api_base_url") || defaultApiBase).replace(/\/$/, "");

  const FRONTEND_BASE_URL = String(runtime.FRONTEND_BASE_URL || computeFrontendBase()).replace(/\/+$/, "") + "/";
  const COMPONENT_BASE_URL = String(runtime.COMPONENT_BASE_URL || `${FRONTEND_BASE_URL}components`).replace(/\/+$/, "");

  window.OYA_CONFIG = {
    API_BASE_URL,
    API_PREFIX: runtime.API_PREFIX || "/api/v1",
    API_TIMEOUT_MS: Number(runtime.API_TIMEOUT_MS || 20000),
    APP_VERSION,

    // Source of truth for shared-component resolution (see assets/js/shell.js).
    // Not the current page's URL — the frontend deployment's own root.
    FRONTEND_BASE_URL,
    COMPONENT_BASE_URL,

    ROUTES: {
      login: "login.html",
      dashboard: "dashboard.html",
      members: "members.html",
      memberDetail: "member-detail.html",
      memberForm: "member-form.html",
      profile: "profile.html",
    },

    IS_LOCAL: isLocal,
  };
})();
