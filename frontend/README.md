# OYA Standalone Frontend

Pure HTML/CSS/vanilla JS. No build step, no framework. Talks to the
Django backend entirely through JSON APIs (see
`../django_api_additions/`).

## Running it

Any static file server works — this is plain HTML/CSS/JS, no build step.

```bash
# from inside frontend/
python -m http.server 5500
# or VS Code's "Live Server" extension, or nginx, or any static host
```

Then open `http://127.0.0.1:5500/login.html`.

**Before it will work**, apply the Django-side changes in
`../django_api_additions/` (see that folder's own instructions) and
start Django (`python manage.py runserver`).

## Configuration

Everything points at the backend through **one** file:

```
assets/js/config.js
```

Change `API_BASE_URL` there to switch between dev and production — no
other file hard-codes the backend origin.

## Folder structure

```
frontend/
├── index.html              redirects to dashboard or login based on session
├── login.html               ✅ complete
├── dashboard.html           ✅ complete (admin/executive view; simplified member view)
├── members.html              ✅ complete (search, filter, paginate)
├── member-detail.html        ✅ complete (core sections)
├── member-form.html          ✅ complete (create + edit)
├── executives.html           ⏳ not yet built
├── finance.html               ⏳ not yet built
├── ... (see MIGRATION_REPORT.md for the full remaining list)
│
├── assets/
│   ├── css/          — copied verbatim from the Django project's static/css/
│   ├── js/
│   │   ├── config.js  — API base URL + frontend routes
│   │   ├── api.js      — central fetch client (cookies, CSRF, error handling)
│   │   ├── auth.js      — login/logout/current-user/page guarding
│   │   ├── shell.js      — injects shared chrome, wires up nav/theme/search
│   │   └── theme.js       — copied verbatim (dark/light/system + localStorage)
│   └── images/
│
└── components/       — shared chrome, fetched + injected by shell.js
    ├── sidebar.html
    ├── topbar.html
    ├── mobile_top_header.html
    ├── mobile_nav.html
    └── footer.html
```

## Authentication

Session-based, same as the original Django app — **not** token auth.
`assets/js/api.js` sends `credentials: "include"` on every request so
the session cookie rides along, and attaches Django's CSRF header on
any POST/PUT/PATCH/DELETE.

Every protected page follows the same boilerplate:

```html
<script src="assets/js/config.js"></script>
<script src="assets/js/api.js"></script>
<script src="assets/js/auth.js"></script>
<script src="assets/js/shell.js"></script>
<script>
  (async function () {
    const user = await window.OYA_SHELL.init({ page: "members", title: "Members" });
    if (!user) return; // already redirected to login
    // ...page logic, using `user` for role-based UI
  })();
</script>
```

`OYA_SHELL.init()` injects the sidebar/topbar/mobile nav, wires up
theme/dropdowns/logout/search, and redirects to `login.html` if the
session isn't valid — so individual pages never have to re-implement
auth guarding.

## Routing

There's no client-side router — this is a traditional multi-page site,
same as before. `assets/js/config.js`'s `ROUTES` object is the single
place page filenames are declared, and `data-page="..."` attributes on
nav links drive the active-state highlighting (see `shell.js`).

## Adding a new page

1. Copy `members.html`'s `<head>`/shell boilerplate.
2. Call `OYA_SHELL.init({ page: "...", title: "..." })`.
3. Fetch data via `window.OYA_API.apiFetch("/app/api/...")`.
4. Add the corresponding JSON API view in the matching
   `django_api_additions/<app>/api.py`, wired up per
   `django_api_additions/URLS_PATCH.md`.
