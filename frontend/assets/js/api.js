/**
 * OYA Frontend — Central API Client
 *
 * Django backend uses session authentication (login_required / session
 * cookie), NOT tokens. So every request must:
 *   1. Send cookies cross-origin  -> credentials: "include"
 *   2. Send the CSRF header on any non-safe method (POST/PUT/PATCH/DELETE)
 *   3. Django must have the frontend origin in CORS_ALLOWED_ORIGINS and
 *      CSRF_TRUSTED_ORIGINS (see django_api_additions/oya/settings_patch.py)
 *
 * All pages should call apiFetch(...) instead of raw fetch() so auth,
 * CSRF, and error handling stay in one place.
 */

(function () {
  "use strict";

  const BASE = window.OYA_CONFIG.API_BASE_URL;

  /** Read a cookie value by name (used for Django's csrftoken cookie). */
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

  /**
   * Fetch a Django endpoint with session auth + CSRF handled automatically.
   * @param {string} endpoint - path relative to API_BASE_URL, e.g. "/members/api/list/"
   * @param {object} options - standard fetch options (method, body, headers, ...)
   * @returns {Promise<any>} parsed JSON body
   * @throws {ApiError} on non-2xx responses, with .status and .data attached
   */
  async function apiFetch(endpoint, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({}, options.headers);

    const isFormData = options.body instanceof FormData;
    if (!isFormData && options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (!SAFE_METHODS.has(method)) {
      const csrftoken = getCookie("csrftoken");
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

    // Session expired / not authenticated -> bounce to login
    if (response.status === 401 || response.status === 403) {
      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (response.status === 401) {
        window.location.href = window.OYA_CONFIG.ROUTES.login;
        return;
      }
      throw new ApiError((data && data.detail) || "Permission denied.", response.status, data);
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

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  }

  window.OYA_API = { apiFetch, ApiError, getCookie };
})();
