/**
 * OYA Frontend — Central Configuration
 */

(function () {
  // ── Environment Detection ─────────────────────────────
  const hostname = window.location.hostname;
  const isLocal = (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    // optional: any other local dev host you use
    hostname.endsWith(".local")
  );

  // ── API Base URL ──────────────────────────────────────

  const API_BASE_URL = isLocal
    ? "http://127.0.0.1:8000"
    : "https://okpo-youths-association.onrender.com";

  window.OYA_CONFIG = {
    API_BASE_URL,

    ROUTES: {
      login: "login.html",
      dashboard: "dashboard.html",
      members: "members.html",
      memberDetail: "member-detail.html",
      memberForm: "member-form.html",
      profile: "profile.html",
    },

    // Optional: expose the flag so other scripts can branch if needed
    IS_LOCAL: isLocal,
  };
})();