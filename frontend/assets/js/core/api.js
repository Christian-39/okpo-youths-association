/**
 * OYA Frontend — Central API Client (ES module)
 *
 * Structured after GadgetHub's frontend/js/core/api.js (class-based
 * client, static get/post/patch/put/delete, centralized error
 * handling) — but the actual auth mechanics are OYA's own, not
 * GadgetHub's:
 *
 *   GadgetHub: JWT in a cookie, silent refresh via POST /auth/refresh/,
 *              no CSRF header at all.
 *   OYA:       Django session cookie (set by /accounts/api/login/),
 *              CSRF token required on every unsafe method, no refresh
 *              endpoint — a 401 means the session is genuinely gone.
 *
 * This file is additive: existing pages using the older
 * assets/js/api.js (window.OYA_API) are untouched and keep working.
 * New pages should import from here instead:
 *
 *   import { API, ApiError, formatNaira } from "./js/core/api.js";
 *   const members = await API.get("/members/api/list/");
 */

/** Read a cookie value by name (used for Django's csrftoken cookie). */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

/**
 * Resolve the backend origin. Prefers window.OYA_CONFIG.API_BASE_URL
 * (set by assets/js/config.js, still loaded on every page) so there is
 * one source of truth; falls back to the same localhost-detection
 * logic if that script isn't present on a given page.
 */
function detectApiBase() {
  if (typeof window !== "undefined" && window.OYA_CONFIG && window.OYA_CONFIG.API_BASE_URL) {
    return window.OYA_CONFIG.API_BASE_URL;
  }
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local");
  return isLocal ? "http://127.0.0.1:8000" : "https://okpo-youths-association.onrender.com";
}

const API_BASE = detectApiBase();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

class API {
  /**
   * Low-level request. Prefer the get/post/patch/put/delete helpers
   * below — they cover the normal cases.
   * @param {string} endpoint - path relative to the backend origin, e.g. "/members/api/list/"
   * @param {object} options - fetch options, plus:
   *   skipAuthRedirect: don't redirect to login.html on a 401 (use for
   *     background "am I logged in" checks where a guest is normal).
   */
  static async request(endpoint, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({}, options.headers);

    const isFormData = options.body instanceof FormData;
    const isPlainObjectBody =
      options.body && typeof options.body === "object" && !isFormData;

    if (isPlainObjectBody && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const body = isPlainObjectBody ? JSON.stringify(options.body) : options.body;

    if (!SAFE_METHODS.has(method)) {
      const csrftoken = getCookie("csrftoken");
      if (csrftoken) headers["X-CSRFToken"] = csrftoken;
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        method,
        headers,
        body,
        credentials: "include",
      });
    } catch (networkErr) {
      throw new ApiError("Network error — could not reach the server.", 0, null);
    }

    // OYA has no refresh-token flow (unlike GadgetHub) — a 401 means
    // the Django session is genuinely gone, so send the user to login
    // unless the caller is doing a background identity check.
    if (response.status === 401 && !options.skipAuthRedirect) {
      window.location.href = "login.html";
      return null;
    }

    if (response.status === 204) return null;

    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = this.extractErrorMessage(data, response.status);
      throw new ApiError(message, response.status, data);
    }
    return data;
  }

  /**
   * Turns an OYA API error body into a readable message. Handles:
   * - {"detail": "..."} / {"error": "..."} / {"message": "..."}
   * - Django form-style field errors: {"field": ["This field is required."], ...}
   */
  static extractErrorMessage(data, status) {
    if (!data) return `Request failed (${status})`;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (data.errors) {
      const errors = data.errors;
      if (Array.isArray(errors)) return errors.join(" ");
      if (typeof errors === "object") {
        const parts = [];
        for (const [field, msgs] of Object.entries(errors)) {
          const text = Array.isArray(msgs) ? msgs.map((m) => m.message || m).join(" ") : String(msgs);
          if (text) parts.push(`${field}: ${text}`);
        }
        if (parts.length) return parts.join(" ");
      }
    }
    return `Request failed (${status})`;
  }

  static get(endpoint, options = {}) {
    return this.request(endpoint, { method: "GET", ...options });
  }
  static post(endpoint, body, options = {}) {
    return this.request(endpoint, { method: "POST", body, ...options });
  }
  static patch(endpoint, body, options = {}) {
    return this.request(endpoint, { method: "PATCH", body, ...options });
  }
  static put(endpoint, body, options = {}) {
    return this.request(endpoint, { method: "PUT", body, ...options });
  }
  static delete(endpoint, options = {}) {
    return this.request(endpoint, { method: "DELETE", ...options });
  }
}

/** Naira formatter, reused across pages (mirrors GadgetHub's formatNaira helper). */
function formatNaira(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return "\u20A60";
  return "\u20A6" + Math.round(num).toLocaleString("en-NG");
}

/** Debounce utility, for search/autocomplete inputs. */
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export { API, ApiError, API_BASE, formatNaira, debounce, getCookie };
