/**
 * OYA Frontend — Central API Client
 */

(function () {
  "use strict";

  const BASE = window.OYA_CONFIG.API_BASE_URL;

  /** Read a cookie value by name (fallback for same-origin setups). */
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

  /** Cached CSRF token (populated from JSON endpoint). */
  let _cachedCsrf = null;

  /**
   * Fetch the CSRF token from the backend JSON endpoint.
   * Falls back to document.cookie for same-origin deployments.
   */
  async function fetchCsrfToken() {
    if (_cachedCsrf) return _cachedCsrf;

    try {
      const res = await fetch(BASE + "/accounts/api/csrf/", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`CSRF endpoint ${res.status}`);
      const data = await res.json();
      _cachedCsrf = data.csrfToken || data.csrftoken || null;
    } catch (err) {
      console.warn("OYA: CSRF JSON fetch failed, falling back to cookie:", err);
      _cachedCsrf = getCookie("csrftoken");
    }
    return _cachedCsrf;
  }

  /** Clear cached CSRF (call after logout). */
  function clearCsrfCache() {
    _cachedCsrf = null;
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  }

  /** True if the current page is the login page. */
  function isLoginPage() {
    const path = window.location.pathname;
    return path.endsWith("login.html") || path.endsWith("/login");
  }

  async function apiFetch(endpoint, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({}, options.headers);

    const isFormData = options.body instanceof FormData;
    if (!isFormData && options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (!SAFE_METHODS.has(method)) {
      const csrftoken = await fetchCsrfToken();
      if (csrftoken) headers["X-CSRFToken"] = csrftoken;
    }

    let response;
    try {
      response = await fetch(BASE + endpoint, {
        ...options,
        method,
        headers,
        credentials: "include",
      });
    } catch (networkErr) {
      throw new ApiError("Network error — could not reach the server.", 0, null);
    }

    // ── 401 / 403 handling ──────────────────────────────
    if (response.status === 401 || response.status === 403) {
      let data = null;
      try { data = await response.json(); } catch (_) {}

      const message =
        (data && data.detail) ||
        (data && data.error) ||
        (response.status === 401 ? "Authentication required." : "Permission denied.");

      // Only bounce to login if we aren't already there — otherwise the
      // login form can never show "Invalid credentials" because the page
      // would reload before the error reaches the catch block.
      if (response.status === 401 && !isLoginPage()) {
        window.location.href = window.OYA_CONFIG.ROUTES.login;
        return;
      }

      throw new ApiError(message, response.status, data);
    }

    if (response.status === 204) return null;

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        (data && (data.detail || data.error || data.message)) ||
        `Request failed (${response.status})`;
      throw new ApiError(message, response.status, data);
    }

    return data;
  }

  window.OYA_API = { apiFetch, ApiError, getCookie, clearCsrfCache };
})();