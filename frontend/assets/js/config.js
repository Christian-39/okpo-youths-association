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

  const defaultApiBase = isLocal ? "http://127.0.0.1:8000" : "https://okpo-youths-association.onrender.com";
  const API_BASE_URL = String(runtime.API_BASE_URL || stored("oya_api_base_url") || defaultApiBase).replace(/\/$/, "");

  window.OYA_CONFIG = {
    API_BASE_URL,
    API_PREFIX: runtime.API_PREFIX || "/api/v1",
    API_TIMEOUT_MS: Number(runtime.API_TIMEOUT_MS || 20000),
    APP_VERSION,

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
