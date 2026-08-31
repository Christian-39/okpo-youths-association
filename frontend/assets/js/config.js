/**
 * OYA Frontend — Central Configuration
 * Auto-detects local vs production backend. No manual switching needed.
 */
(function () {
  const hostname = location.hostname;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(hostname);
  const protocol = location.protocol;          // http: or https:

  window.OYA_CONFIG = {
    // Use the SAME hostname as the page so cookies are same-site
    API_BASE_URL: isLocalhost
      ? `${protocol}//${hostname}:8000`
      : "https://okpo-youths-association.onrender.com",

    API_PREFIX: "/accounts/api",

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