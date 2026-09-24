# OYA — Second-Pass Audit Findings (verified, not assumed)

Every item below was reproduced against real code or a running instance before
being recorded. Method is noted for each.

## P0 — Application-breaking (production)

| # | Finding | How it was verified | Status |
|---|---------|---------------------|--------|
| 1 | `assets/js/pwa.js` referenced by **62 pages**, file does not exist | `grep` of every `<script src>` + `curl https://oya-omega.vercel.app/assets/js/pwa.js` → **404** | FIXED |
| 2 | `assets/css/pwa.css` referenced by **60 pages**, file does not exist | same method → **404** in production | FIXED |
| 3 | `assets/js/charts.js` referenced by `dashboard.html`, file does not exist; dashboard calls `window.OYA_CHARTS.renderBar/renderDonut` | `curl` → **404**; `grep OYA_CHARTS dashboard.html` | FIXED |
| 4 | **Service worker never registered anywhere.** `sw.js` exists but no page or module calls `navigator.serviceWorker.register()` | `grep -rn serviceWorker` across all `.js`/`.html` → only hits inside `sw.js` itself | FIXED |
| 5 | `/dashboard/api/summary/` returned **HTTP 500** — `Decimal` used 3× in `dashboard/views.py`, never imported | Reproduced locally: `NameError: name 'Decimal' is not defined` | FIXED |
| 6 | `login.js` calls `window.OYA_API.fetchCsrfToken()`, which `api.js` never exported (`undefined is not a function`). Matches repo's last commit message "login failing" | `grep` of `window.OYA_API = {...}` export list | FIXED |
| 7 | Fresh DB build impossible: `elections.0005` data migration reads `executives.elected_via` without depending on `executives.0003` | `manage.py migrate` on clean DB → `no such column: executives_executive.elected_via_id` | FIXED |
| 8 | MySQL-only `init_command` applied to **every** engine, breaking Postgres/SQLite at connect | `OperationalError: near "SET": syntax error` on SQLite | FIXED |
| 9 | `DATABASE_URL` provisioned by `render.yaml` was never read by `settings.py` | code read; only `DB_*` vars consulted | FIXED |

## P1 — Required by the brief, not implemented

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| 10 | No 3-day cache TTL of any kind | `sw.js` had versioned names only, zero timestamp/age logic | FIXED |
| 11 | No application-level update detection; `version.json` served but never fetched by any code | `grep version.json` → only referenced in `sw.js` PRECACHE list | FIXED |
| 12 | API client: no timeout — a hung request stayed pending forever | `api.js` had a bare `fetch()` with no `AbortController` | FIXED |
| 13 | No request cancellation; search could render stale results over newer ones | `members.html` debounced but never aborted | FIXED |
| 14 | No request deduplication | no in-flight registry existed | FIXED |
| 15 | No retry logic | none present | FIXED |
| 16 | Error matrix incomplete — only 401/403 handled specially; 409/422/429/502/503/504/timeout/malformed all fell to a generic string | `api.js` read in full | FIXED |
| 17 | **Zero automated tests** in the entire repository | `find . -name "test*.py"` → no results | FIXED |
| 18 | Two competing API clients: `assets/js/api.js` (used by 131 call sites) and `assets/js/core/api.js` (ES module, **zero importers**) | `grep` for `core/api.js` imports → none | FIXED (documented + unified) |

## P1 — Performance (measured, not assumed)

Measured with `CaptureQueriesContext` against a seeded local DB (60 members,
24 income rows, 13 expense rows).

| Endpoint | Queries before | Queries after | Cause |
|---|---|---|---|
| `/dashboard/api/summary/` (cold) | **72** | **50** | 12-month trend loop issued 2 aggregates per month = 24 queries |
| `/dashboard/api/summary/` (warm) | — | **7** | server-side cache already present, now amortising far less work |
| `/members/api/list/` (25 rows) | **33** | **8** | `Member.is_taskforce` used `.filter().exists()`, defeating `prefetch_related` → 1 query per row |

Financial-output equivalence for the trend change was proven by diffing the new
grouped aggregate against the original per-month loop on multi-row months —
identical to the cent. This is now locked by
`backend/tests/test_performance.py::TrendAggregationTests`, which keeps the
original per-month loop in the test file as an oracle and asserts the optimized
version returns the same figures.

## P2 — Consistency / hygiene

| # | Finding | Evidence |
|---|---------|----------|
| 19 | Heavy inline styling: 1,000+ `style="` attributes across pages; `profile.html` alone has 55 plus 2 `<style>` blocks | counted per page |
| 20 | 62 pages each duplicate an inline theme/FOUC `<script>` in `<head>` | by design (documented in `theme.js`) — kept, it is legitimate critical inline JS |
| 21 | Every page re-declares its own `esc()` / `naira()` helpers | duplicated across ~30 pages |

## Not defects (verified working — deliberately left alone)

- Backend pagination is present and consistent (`Paginator`, 25/page) across
  members, users, audit logs, elections, operations, notifications, donations.
- `select_related` is already used in 12 API modules where it matters.
- Service worker was already correctly conservative: API/`/admin/`/`/media/`
  are never cached, `version.json` explicitly bypassed. This design was kept.
- Backend authorization is genuinely server-side (`has_executive_access()`,
  `has_admin_access()` checked in views, not trusted from the client).
- Audit logging is wired into create/update/delete paths and login/logout.
- Dashboard financial math lives only in Django; the frontend never recomputes
  authoritative balances.
