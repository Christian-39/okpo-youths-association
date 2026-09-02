/**
 * OYA Frontend — Auth module (ES module)
 *
 * Structured after GadgetHub's frontend/js/core/auth.js (a small
 * static class wrapping login/logout/current-user), wired to OYA's
 * actual accounts API:
 *   GET  /accounts/api/csrf/   -> ensures the csrftoken cookie is set
 *   POST /accounts/api/login/  -> { serial_number, pin }
 *   POST /accounts/api/logout/
 *   GET  /accounts/api/me/     -> current user + permission flags
 *
 * Unlike GadgetHub, OYA has no client-visible "guest browsing" mode —
 * every page is behind login — so Auth.requireAuth() (not present in
 * GadgetHub) is the normal way a page guards itself.
 */
import { API } from "./api.js";

class Auth {
  /**
   * Django's csrftoken cookie is only set once a view uses
   * ensure_csrf_cookie. Safe to call on every page load; it's a GET.
   */
  static async ensureCsrfCookie() {
    try {
      await API.get("/accounts/api/csrf/", { skipAuthRedirect: true });
    } catch (err) {
      // Non-fatal — login still works via the session cookie flow
      // even without this pre-warm call.
      console.warn("OYA: couldn't pre-warm CSRF cookie (non-fatal):", err);
    }
  }

  /** Returns the current user object, or null if not authenticated. */
  static async check() {
    try {
      return await API.get("/accounts/api/me/", { skipAuthRedirect: true });
    } catch {
      return null;
    }
  }

  static async login(serialNumber, pin) {
    return API.post(
      "/accounts/api/login/",
      { serial_number: serialNumber, pin },
      { skipAuthRedirect: true }
    );
  }

  static async logout() {
    try {
      await API.post("/accounts/api/logout/", null, { skipAuthRedirect: true });
    } finally {
      window.location.href = "login.html";
    }
  }

  /**
   * Call at the top of every protected page. Redirects to login if the
   * session isn't valid, otherwise resolves with the current user.
   */
  static async requireAuth() {
    const user = await this.check();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    return user;
  }
}

export { Auth };
