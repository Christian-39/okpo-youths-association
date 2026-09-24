/**
 * OYA Frontend — Central API Client
 * All application requests pass through this module.
 */
(function () {
  "use strict";

  const CONFIG = window.OYA_CONFIG || {};
  const BASE = (CONFIG.API_BASE_URL || "").replace(/\/$/, "");
  const API_PREFIX = (CONFIG.API_PREFIX || "/api/v1").replace(/\/$/, "");
  const DEFAULT_TIMEOUT_MS = Number(CONFIG.API_TIMEOUT_MS || 20000);
  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);
  const inflight = new Map();
  let _cachedCsrf = null;

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  function isAbsoluteUrl(url) {
    return /^https?:\/\//i.test(url);
  }

  function withApiPrefix(endpoint) {
    if (!endpoint) return API_PREFIX + "/";
    if (isAbsoluteUrl(endpoint)) return endpoint;
    let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (path.startsWith(`${API_PREFIX}/`) || path === API_PREFIX) return path;
    // Backend keeps legacy app-level route names under the v1 namespace, e.g.
    // /api/v1/members/api/list/. This preserves existing page modules while
    // ensuring network traffic goes through a versioned API root.
    return `${API_PREFIX}${path}`;
  }

  function buildUrl(endpoint) {
    const path = withApiPrefix(endpoint);
    return isAbsoluteUrl(path) ? path : `${BASE}${path}`;
  }

  function isLoginPage() {
    const path = window.location.pathname;
    return path.endsWith("login.html") || path.endsWith("/login");
  }

  class ApiError extends Error {
    constructor(message, status, data, kind) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
      this.kind = kind || "http";
    }
  }

  function normalizeErrorMessage(status, data) {
    if (data && typeof data === "object") {
      if (data.detail) return data.detail;
      if (data.error) return data.error;
      if (data.message) return data.message;
      if (data.errors) {
        if (Array.isArray(data.errors)) return data.errors.join(" ");
        try { return Object.values(data.errors).flat().join(" "); } catch (_) {}
      }
    }
    const matrix = {
      400: "Please check the submitted information.",
      401: "Authentication required.",
      403: "You do not have permission to perform this action.",
      404: "The requested record was not found.",
      409: "This request conflicts with the current record state.",
      422: "Some submitted values are invalid.",
      429: "Too many requests. Please wait and try again.",
      500: "The server could not complete the request.",
      502: "The server is temporarily unavailable.",
      503: "The service is temporarily unavailable.",
      504: "The server took too long to respond.",
    };
    return matrix[status] || `Request failed (${status})`;
  }

  function parseResponse(response) {
    if (response.status === 204) return Promise.resolve(null);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json().catch(() => {
        throw new ApiError("The server returned malformed JSON.", response.status, null, "parse");
      });
    }
    return response.text();
  }

  function shouldRetry(method, status, attempt, maxRetries, errorKind) {
    if (!SAFE_METHODS.has(method)) return false;
    if (attempt >= maxRetries) return false;
    if (status === 429) return false;
    if (errorKind === "abort") return false;
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  async function fetchCsrfToken() {
    if (_cachedCsrf) return _cachedCsrf;
    try {
      const res = await fetch(buildUrl("/accounts/api/csrf/"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
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

  function clearCsrfCache() { _cachedCsrf = null; }

  async function requestOnce(endpoint, options, attempt) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({}, options.headers || {});
    const timeout = Number(options.timeout || DEFAULT_TIMEOUT_MS);
    const retries = options.retries == null ? (SAFE_METHODS.has(method) ? 1 : 0) : Number(options.retries);
    const isFormData = options.body instanceof FormData;
    const isUrlEncoded = options.body instanceof URLSearchParams;

    if (!isFormData && !isUrlEncoded && options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (!SAFE_METHODS.has(method)) {
      const csrftoken = await fetchCsrfToken();
      if (csrftoken) headers["X-CSRFToken"] = csrftoken;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Request timeout", "TimeoutError")), timeout);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else options.signal.addEventListener("abort", () => controller.abort(options.signal.reason), { once: true });
    }

    let response;
    try {
      const fetchOptions = Object.assign({}, options, {
        method,
        headers,
        credentials: "include",
        signal: controller.signal,
      });
      delete fetchOptions.timeout;
      delete fetchOptions.retries;
      delete fetchOptions.dedupe;
      response = await fetch(buildUrl(endpoint), fetchOptions);
    } catch (err) {
      window.clearTimeout(timeoutId);
      const kind = err && (err.name === "AbortError" || err.name === "TimeoutError") ? (err.name === "TimeoutError" ? "timeout" : "abort") : "network";
      const apiErr = new ApiError(kind === "timeout" ? "Request timed out. Please try again." : "Network error — could not reach the server.", 0, null, kind);
      if (shouldRetry(method, 0, attempt, retries, kind)) {
        await delay(300 * (attempt + 1));
        return requestOnce(endpoint, options, attempt + 1);
      }
      throw apiErr;
    }
    window.clearTimeout(timeoutId);

    const data = await parseResponse(response);

    if (!response.ok) {
      const message = normalizeErrorMessage(response.status, data);
      if (response.status === 401 && !isLoginPage()) {
        window.location.href = CONFIG.ROUTES?.login || "login.html";
      }
      if (shouldRetry(method, response.status, attempt, retries, "http")) {
        await delay(300 * (attempt + 1));
        return requestOnce(endpoint, options, attempt + 1);
      }
      throw new ApiError(message, response.status, data, "http");
    }
    return data;
  }

  function dedupeKey(endpoint, options) {
    const method = (options.method || "GET").toUpperCase();
    if (!SAFE_METHODS.has(method)) return null;
    if (options.dedupe === false) return null;
    return `${method}:${endpoint}`;
  }

  async function apiFetch(endpoint, options = {}) {
    const key = dedupeKey(endpoint, options);
    if (key && inflight.has(key)) return inflight.get(key);
    const promise = requestOnce(endpoint, options, 0).finally(() => {
      if (key) inflight.delete(key);
    });
    if (key) inflight.set(key, promise);
    return promise;
  }

  function createCancellable() {
    let controller = null;
    return function cancellableFetch(endpoint, options = {}) {
      if (controller) controller.abort();
      const current = new AbortController();
      controller = current;
      const nextOptions = Object.assign({}, options, { signal: current.signal, dedupe: false });
      return apiFetch(endpoint, nextOptions).finally(() => {
        if (controller === current) controller = null;
      });
    };
  }

  window.OYA_API = {
    apiFetch,
    ApiError,
    getCookie,
    fetchCsrfToken,
    clearCsrfCache,
    buildUrl,
    createCancellable,
  };
})();
