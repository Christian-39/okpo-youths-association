/**
 * OYA Frontend — Central Configuration
 * Auto-detects local vs production backend. No manual switching needed.
 */
(function () {
  const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);

  window.OYA_CONFIG = {
    // Django backend origin — auto-switches based on where this file is served
    API_BASE_URL: isLocalhost
      ? "http://127.0.0.1:8000"
      : "https://okpo-youths-association.onrender.com",

    // API prefix used by all fetch calls
    API_PREFIX: "/accounts/api",

    // Frontend routes, mirroring the Django url names they replace.
    // Keep in sync with oya/urls.py + each app's urls.py.
    ROUTES: {
      login: "login.html",
      dashboard: "dashboard.html",
      members: "members.html",
      memberDetail: "member-detail.html",
      memberForm: "member-form.html",
      profile: "profile.html",
    },
  };
})();