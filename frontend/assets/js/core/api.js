/**
 * OYA Frontend — ES-module facade over the central API client.
 * ============================================================================
 *
 * WHY THIS FILE IS A FACADE
 *
 * This module used to contain a SECOND, independent implementation of the API
 * client (its own fetch wrapper, its own CSRF cache, its own error handling)
 * while assets/js/api.js contained the first. The audit found:
 *
 *   - 131 call sites use window.OYA_API (assets/js/api.js)
 *   -   0 call sites imported this module
 *   - the two had already drifted: only one handled the login-page 401 case,
 *     and neither had timeouts, cancellation, deduplication or retry
 *
 * Two clients means every future fix has to be made twice, and the one you
 * forget is the one that ships. The logic now lives in exactly one place —
 * assets/js/api.js — and this file simply re-exports it with an ES-module
 * shape for any page that prefers `import`.
 *
 * Load assets/js/api.js before importing this module (every page already does).
 *
 *   import { API, ApiError, formatNaira } from "./core/api.js";
 *   const members = await API.get("/members/api/list/");
 */

function client() {
  if (!window.OYA_API) {
    throw new Error(
      "OYA: assets/js/api.js must be loaded before assets/js/core/api.js"
    );
  }
  return window.OYA_API;
}

/** Same ApiError class the central client throws — identity checks work. */
export const ApiError = (window.OYA_API && window.OYA_API.ApiError) || Error;

export const API_BASE = (window.OYA_CONFIG && window.OYA_CONFIG.API_BASE_URL) || "";

export class API {
  static request(endpoint, options = {}) {
    return client().apiFetch(endpoint, options);
  }
  static get(endpoint, options = {}) {
    return client().apiFetch(endpoint, { ...options, method: "GET" });
  }
  static post(endpoint, body, options = {}) {
    return client().apiFetch(endpoint, { ...options, method: "POST", body });
  }
  static patch(endpoint, body, options = {}) {
    return client().apiFetch(endpoint, { ...options, method: "PATCH", body });
  }
  static put(endpoint, body, options = {}) {
    return client().apiFetch(endpoint, { ...options, method: "PUT", body });
  }
  static delete(endpoint, options = {}) {
    return client().apiFetch(endpoint, { ...options, method: "DELETE" });
  }
}

export const getCookie = (name) => client().getCookie(name);
export const fetchCsrfToken = () => client().fetchCsrfToken();
export const clearCsrfCache = () => client().clearCsrfCache();

/** Creates a cancellable fetcher — each call aborts the previous one. */
export const createCancellable = () => client().createCancellable();

/** Naira formatter for DISPLAY ONLY. Authoritative amounts come from Django. */
export function formatNaira(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num == null || Number.isNaN(num)) return "\u20A60";
  return "\u20A6" + Math.round(num).toLocaleString("en-NG");
}

/** Debounce utility for search/autocomplete inputs. */
export function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}
