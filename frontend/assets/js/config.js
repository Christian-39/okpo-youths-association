/**
 * OYA Frontend — Central Configuration
 * Change API_BASE_URL to point at your Django backend.
 * Everything else in the frontend imports this — never hard-code
 * the backend origin anywhere else.
 */
window.OYA_CONFIG = {
  // Django backend origin. In dev this is usually Django's runserver.
  // In production, point this at your deployed Django domain.
  API_BASE_URL: "http://127.0.0.1:8000",

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
