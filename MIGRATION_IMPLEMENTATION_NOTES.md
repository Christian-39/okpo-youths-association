# OYA Django-template to separated frontend/backend migration notes

Date: 2026-09-24

## Repository audit summary

Both repositories were inspected before changes:

- Source `Christian-39/oya`: Django apps, models, forms, views, URLs, templates,
  static assets, authentication backend, permissions, dashboard services,
  finance/project/election/operation modules, notifications, audit logging, and
  settings were reviewed as the functional reference.
- Target `Christian-39/okpo-youths-association`: existing `backend/`,
  `frontend/`, documentation, API modules, static pages, service worker, and
  test scripts were reviewed and preserved where useful.

The target already contained most module APIs and standalone pages. This pass
focused on missing/broken migration items that prevented production use or full
parity for the separated architecture.

## Implemented in this pass

### Backend

- Added a versioned API namespace under `/api/v1/` while keeping existing
  unversioned aliases for backward compatibility.
- Completed the missing elections handover/administration API coverage:
  - handover form metadata
  - handover detail
  - handover create/update/delete
  - previous administrations list
  - full administration report JSON serialization
- Reused `HandoverLedgerForm`, `HandoverLedger.recalculate_aggregates()`, and
  `elections.administrations.build_administration_report()` so handover and
  administration calculations remain backend-authoritative.
- Fixed a fresh-database migration ordering defect by making
  `elections.0005_backfill_new_ledger_aggregates` depend on
  `executives.0003_executive_elected_via`.
- Hardened authentication:
  - login/logout now use Django CSRF protection
  - failed login attempts are throttled by serial number and client IP
  - PINs remain hashed via the existing user model methods
- Fixed local/test startup configuration:
  - `DATABASE_URL` is supported
  - MySQL strict-mode options apply only to MySQL
  - local media storage works without Backblaze B2 credentials
  - Backblaze B2 remains available with `MEDIA_STORAGE_MODE=b2`
- Added `oya/settings_test.py` and backend API contract tests.

### Frontend

- Added missing assets referenced by shipped pages:
  - `assets/css/pwa.css`
  - `assets/js/pwa.js`
  - `assets/js/charts.js`
  - `assets/js/early-theme.js`
- Extracted page-level inline JavaScript into `assets/js/pages/*.js`.
- Upgraded the central API client:
  - `/api/v1` prefixing
  - CSRF bootstrap
  - credentials included
  - timeout handling
  - normalized errors for 400/401/403/404/409/422/429/5xx/network/timeout
  - GET-only bounded retry
  - GET request de-duplication
- Added runtime API configuration support through `window.OYA_RUNTIME_CONFIG`
  and `frontend/config.runtime.example.js`.
- Added frontend checks verifying no Django template syntax, no inline
  JavaScript, all referenced assets exist, JavaScript parses, version lockstep,
  and all API-driven pages load the central API client.

## Test results

Commands run successfully:

```bash
cd backend
../.venv/bin/python manage.py check
../.venv/bin/python manage.py makemigrations --check --dry-run
../.venv/bin/python manage.py migrate --noinput
../.venv/bin/python -m py_compile $(find . -name '*.py' -not -path './__pycache__/*')

cd ..
./run-tests.sh
```

Results:

- Django system check: PASS
- Migration dry-run: PASS / no model changes detected
- Fresh SQLite migration: PASS
- Python compile: PASS
- Backend tests: PASS, 6 tests
- Frontend checks: PASS
- Full `./run-tests.sh`: PASS

## Important deployment notes

Backend:

- Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`,
  `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` explicitly.
- Use MySQL 8+ through `DATABASE_URL` or `DB_*` variables.
- Use `MEDIA_STORAGE_MODE=local` for local/dev or `MEDIA_STORAGE_MODE=b2` with
  the required Backblaze variables in production.
- Production cross-origin session cookies require HTTPS and the configured
  `SameSite=None; Secure` cookie behavior.

Frontend:

- Host `frontend/` independently as static files.
- Configure the backend origin through runtime config, not by editing every
  page.
- The frontend calls legacy page module paths through the central client; the
  client sends them under the versioned `/api/v1` namespace.

## Remaining risks / not claimed

- Browser-level end-to-end tests are still manual; the automated frontend suite
  is static/contract validation, not Playwright/Selenium.
- File upload storage to Backblaze B2 was not integration-tested because no
  credentials are present in the workspace.
- Real staging data should still be exercised for all role workflows and
  supported responsive widths before production release.
