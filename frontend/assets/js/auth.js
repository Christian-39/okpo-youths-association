/**
 * OYA Frontend — Auth helper
 */

(function () {
  "use strict";
  const { apiFetch, ApiError } = window.OYA_API;

  async function ensureCsrfCookie() {
    try {
      await apiFetch("/accounts/api/csrf/");
    } catch (err) {
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
      window.OYA_API.clearCsrfCache();
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