/**
 * OYA Frontend — ES-module facade over the central auth helper.
 * ============================================================================
 *
 * Like ./api.js, this used to be a second implementation of logic that already
 * existed in assets/js/auth.js, with zero importers. It is now a thin facade so
 * there is exactly ONE auth implementation to reason about and secure.
 *
 * OYA's auth model (unchanged):
 *   GET  /accounts/api/csrf/   -> CSRF token (read from the JSON body, because
 *                                 frontend and backend are separate origins)
 *   POST /accounts/api/login/  -> { serial_number, pin }
 *   POST /accounts/api/logout/
 *   GET  /accounts/api/me/     -> current user + permission flags
 *
 * There is no refresh-token flow: a 401 means the Django session is gone.
 */

function helper() {
  if (!window.OYA_AUTH) {
    throw new Error(
      "OYA: assets/js/auth.js must be loaded before assets/js/core/auth.js"
    );
  }
  return window.OYA_AUTH;
}

export class Auth {
  /** Primes the cached CSRF token. Safe to call on every page load. */
  static ensureCsrfCookie() {
    return helper().ensureCsrfCookie();
  }

  /** Returns the current user object, or null if not authenticated. */
  static check() {
    return helper().getCurrentUser();
  }

  static login(serialNumber, pin) {
    return helper().login(serialNumber, pin);
  }

  static logout() {
    return helper().logout();
  }

  /** Guards a protected page: redirects to login when the session is invalid. */
  static requireAuth() {
    return helper().requireAuth();
  }
}

export { Auth as default };
