# OYA standalone frontend

The `frontend/` directory is a framework-free client for the Okpo Youths
Association Management System. It uses HTML5, CSS3, and vanilla JavaScript
only. It does not render Django templates and it does not contain a second
business-logic or permission system.

## Run locally

Start Django first:

```bash
cd ../backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

In another terminal, serve this directory over HTTP:

```bash
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

Open <http://127.0.0.1:5500/login.html>. The browser uses session cookies and
Django CSRF protection; HTTPS is required for cross-origin production use.

## Runtime configuration

`assets/js/config.js` is the single client configuration module. A deployment
may set `window.OYA_RUNTIME_CONFIG` before loading it, or add a
`meta[name="oya-api-base"]` tag, for example:

```html
<script>window.OYA_RUNTIME_CONFIG = { API_BASE_URL: "https://api.example.org" };</script>
<script src="assets/js/config.js"></script>
```

Local hosts use port 8000 automatically. Arena/E2B preview hosts infer the
matching port-8000 API host. Production deployments should inject the real
API origin rather than editing page files.

## Architecture

- `assets/js/api.js` is the only JSON API client. It owns credentials,
  CSRF bootstrap, timeout handling, safe error messages, bounded retries,
  GET request de-duplication, and the three-day cache for explicitly safe
  lookup metadata.
- `assets/js/auth.js` owns the in-memory current-user state. PINs and session
  tokens are never written to localStorage.
- `assets/js/shell.js` injects the shared sidebar, topbar, mobile navigation,
  footer, role-aware navigation, global search, notification badge, toast
  helpers, and confirmation modals.
- `assets/js/theme.js` owns the light/dark theme preference and accessible
  theme toggle.
- `assets/js/pwa.js` owns offline notices, service-worker registration, safe
  update prompts, deployment-version checks, and unsaved-form protection.
- `sw.js` caches the offline shell and static assets only. It deliberately
  bypasses `/api/`, `/admin/`, and `/media/` requests so finance, elections,
  authentication, permissions, and live records are not cached.

Every protected page follows the same pattern:

```html
<script src="assets/js/config.js"></script>
<script src="assets/js/api.js"></script>
<script src="assets/js/auth.js"></script>
<script src="assets/js/theme.js"></script>
<script src="assets/js/shell.js"></script>
<script src="assets/js/pwa.js"></script>
<script>
  (async () => {
    const user = await window.OYA_SHELL.init({ page: "members", title: "Members" });
    if (!user) return;
    const data = await window.OYA_API.apiFetch("/members/api/list/");
  })();
</script>
```

## Pages

The standalone client currently includes:

- Authentication, dashboard, profiles, users, notifications, and settings.
- Members, clans, executives, elections, candidates, voting, handover ledger,
  previous administrations, and administration reports.
- Dues tracker, allocation, prepaid dues, debtors, contributions, income,
  expenses, and finance summaries.
- Projects and fundraising, outside donors, project donations, donation
  detail/edit flows, pledges, payments, and pledge detail/edit flows.
- Task force, motorcycles, case files, audit logs, and shared error/offline
  pages.

Forms use the existing Django forms and models through JSON endpoints. The
backend remains authoritative for role checks, validation, calculations,
linked finance records, election result processing, file uploads, and audit
entries. Client-side role flags only control presentation; every write API
re-checks authorization on the server.

## API and security notes

- Login is serial number plus a six-digit PIN through
  `/accounts/api/login/`; authentication is a Django session.
- All mutating requests obtain a CSRF token and send credentials.
- Normal feedback uses inline errors, retryable loading/error states, toasts,
  and confirmation modals rather than browser alerts.
- Lists use backend pagination and server-side search. Search inputs debounce
  requests and abort stale global-search requests.
- Never put secrets, PINs, raw exception text, financial records, election
  records, or permission decisions in localStorage.

## Static validation

From the repository root:

```bash
for f in frontend/assets/js/**/*.js; do node --check "$f"; done
```

The backend smoke suite is run from `backend/` with `python manage.py test`.
For a release, also exercise the application at 360px, 768px, 1024px, and
1440px widths, plus 400/401/403/404/409/429/500 responses, timeout/network
failure, malformed JSON, offline navigation, cache expiry, service-worker
updates, and unsaved-form update prompts.
