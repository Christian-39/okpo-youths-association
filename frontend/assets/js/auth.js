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

  async function getCurrentUser() {
    try {
      return await apiFetch("/accounts/api/me/");
    } catch (err) {
      return null;
    }
  }

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