/**
 * OYA Frontend — Auth helper
 * Wraps the accounts API additions (see django_api_additions/accounts/api.py):
 *   GET  /accounts/api/csrf/         -> ensures csrftoken cookie is set
 *   POST /accounts/api/login/        -> { serial_number, pin }
 *   POST /accounts/api/logout/
 *   GET  /accounts/api/me/           -> current user + permission flags
 */
(function () {
  "use strict";
  const { apiFetch, ApiError } = window.OYA_API;

  async function ensureCsrfCookie() {
    // Django's csrftoken cookie is only set once a view uses ensure_csrf_cookie
    // (see accounts/api.py). Safe to call on every page load; it's a GET.
    try {
      await apiFetch("/accounts/api/csrf/");
    } catch (err) {
      // Non-fatal — login still works via the session cookie flow even
      // without this pre-warm call. Logged (not silently swallowed) so
      // a genuine backend/CORS outage is still visible in devtools.
      console.warn("OYA: couldn't pre-warm CSRF cookie (non-fatal):", err);
    }
  }

  async function login(serialNumber, pin) {
    return apiFetch("/accounts/api/login/", {
      method: "POST",
      body: JSON.stringify({ serial_number: serialNumber, pin }),
    });
  }

  async function logout() {
    try {
      await apiFetch("/accounts/api/logout/", { method: "POST" });
    } finally {
      window.location.href = window.OYA_CONFIG.ROUTES.login;
    }
  }

  /** Returns the current user object, or null if not authenticated. */
  async function getCurrentUser() {
    try {
      return await apiFetch("/accounts/api/me/");
    } catch (err) {
      return null;
    }
  }

  /**
   * Call at the top of every protected page. Redirects to login if the
   * session isn't valid, otherwise resolves with the current user.
   */
  async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = window.OYA_CONFIG.ROUTES.login;
      return null;
    }
    return user;
  }

  window.OYA_AUTH = { ensureCsrfCookie, login, logout, getCurrentUser, requireAuth };
})();
