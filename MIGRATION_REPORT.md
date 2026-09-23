# OYA standalone frontend migration report

**Release:** 2026.09.23.1  
**Status:** Backend and standalone client are wired for the production scope;
Django's original templates/views/models remain intact as a compatibility and
business-rule safety net.

## Source and reference audit

The original OYA Django project in `chris-lux/oya` was used as the source of
truth for models, forms, signals, permissions, calculations, election result
processing, financial links, uploads, audit logging, and historical behavior.
The destination repository was audited before changes. The J1 hotel lodge
repository was used only for engineering patterns such as centralized API
helpers, session/auth handling, PWA update flow, cache policy, and tests; its
branding and content were not copied.

## Architecture

- Django remains authoritative for authentication, authorization, validation,
  financial calculations, storage, uploads, linked records, election
  transitions, and audit logs.
- `frontend/` is a pure HTML5/CSS3/vanilla-JavaScript multi-page client. It
  does not use Django template syntax, React, Vue, Angular, Next.js, jQuery,
  Bootstrap, or Tailwind.
- `frontend/assets/js/api.js` centralizes JSON requests, CSRF, credentials,
  timeouts, retry rules, safe errors, request de-duplication, and safe lookup
  caching. `auth.js`, `shell.js`, `theme.js`, and `pwa.js` are the other shared
  client modules.
- Only explicitly safe metadata lookups may use the three-day application
  cache. Sensitive API requests are network-only. The service worker bypasses
  API, admin, and media requests.

## Implemented client areas

- Session login/logout, current-user permissions, profile and PIN change.
- Dashboard, members, clans, executives, elections, candidates, voting,
  handover ledger, previous administrations, and tenure reports.
- Dues tracker, allocation, prepaid dues, debtors, income, contributions,
  expenses, finance summary, projects, fundraising, outside donors, project
  donations, pledges, pledge payments, and detail/edit flows.
- Operations: cases, case resolution, task force, and motorcycles.
- Notifications, settings, donation groups, users, audit logs, shared errors,
  offline shell, deployment-version prompts, and service-worker updates.

## Backend additions and corrections

The destination backend now includes additive JSON APIs in the existing app
modules. The APIs reuse the original forms and services instead of copying
business calculations into JavaScript. New/shared infrastructure includes:

- `/health/` and `/api/version/` uncached deployment probes.
- Safe API error handlers and production-oriented environment settings.
- Explicit session/CSRF/CORS configuration with debug-only E2B preview support.
- Handover CRUD, form metadata, bounded detail reports, administration list,
  and administration-report endpoints.
- Complete project-donation/pledge API coverage and detail navigation.
- A four-test JSON API smoke suite in `backend/core/tests.py`.
- A migration ordering fix: the handover aggregate backfill now depends on
  `executives.0003_executive_elected_via` before importing the live model. A
  fresh database migration was run successfully.

## Handover endpoints

| Method | Endpoint | Authorization |
|---|---|---|
| GET | `/elections/api/handovers/list/` | Authenticated |
| GET | `/elections/api/handovers/form-meta/` | Executive |
| GET | `/elections/api/handovers/<id>/` | Authenticated |
| POST | `/elections/api/handovers/create/` | Executive |
| POST | `/elections/api/handovers/<id>/update/` | Executive |
| DELETE/POST | `/elections/api/handovers/<id>/delete/` | Admin |
| GET | `/elections/api/administrations/` | Executive |
| GET | `/elections/api/administrations/<key>/` | Executive |

Calculated ledger values remain backend-controlled. The administrator-only
physical cash rule is preserved. Report JSON is bounded and display-safe so
model relationships and raw exceptions are not exposed.

## Validation completed

From `backend/`:

```text
python manage.py check                         PASS
python manage.py makemigrations --check --dry-run PASS
python manage.py migrate --noinput              PASS
python manage.py test --noinput                 PASS (4 tests)
python -m py_compile ...                        PASS
```

A test-client smoke run also verified unauthenticated `401`, floor-member
`403`, and authenticated/admin `200` behavior for handover/administration and
project-donation endpoints. The development API and static frontend were
started on `0.0.0.0` and the E2B host allowlist/CORS preview path was exercised.

## Release and manual QA checklist

Before a production release, exercise real staging records (never fake
production data) at widths 360px, 768px, 1024px, and 1440px:

1. Login, logout, session expiry, role navigation, and floor-member access.
2. Create/edit/delete flows, file uploads, validation, duplicate/conflict
   behavior, and audit-log entries.
3. Pagination, debounced/cancelled search, empty/loading/error states, and
   modal/drawer detail interactions.
4. HTTP 400, 401, 403, 404, 409, 429, and 500 responses; timeout, offline,
   malformed JSON, and retry behavior.
5. Three-day cache expiry, fresh deployment version detection, service-worker
   update acceptance, offline navigation, and unsaved-form protection.
6. Keyboard navigation, visible focus, labels, semantic headings, color
   contrast, reduced-motion behavior, and mobile touch targets.

## Known intentional compatibility details

The original Django templates, URLs, views, and static assets are retained;
this is deliberate preservation of existing functionality, not a second
frontend requirement. The standalone client is the primary destination UI,
and all new work must use the centralized modules and backend JSON contract.
