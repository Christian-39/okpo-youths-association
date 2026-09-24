# Testing

The project had **zero automated tests** before this pass. It now has **185**,
split across a Django suite and a dependency-free JavaScript suite.

```bash
./run-tests.sh            # everything
./run-tests.sh backend    # Django only
./run-tests.sh frontend   # syntax check + JS only

npm test                  # frontend only (same as above)
npm run release:check     # verify version lockstep, change nothing
```

Current state: **114 backend + 71 frontend — all passing** (backend 1.4s,
frontend ~2s).

---

## Backend — `backend/tests/`

Run directly:

```bash
cd backend
../../.venv/bin/python manage.py test tests --settings=oya.settings_test
```

| File | Tests | Covers |
|---|---|---|
| `test_auth.py` | 16 | login/logout, CSRF, session loss, role matrix, no user enumeration |
| `test_members.py` | 22 | list/search/pagination/detail/create, **N+1 query budget** |
| `test_elections.py` | 16 | voting rules — the safety-critical module |
| `test_finance.py` | 15 | money integrity, Decimal, delete verbs, permissions |
| `test_api_errors.py` | 15 | the status-code contract + information leakage |
| `test_performance.py` | 9 | query budgets, trend-aggregation equivalence |
| `test_modules.py` | 21 | breadth smoke, notifications, audit logs, JSON auth contract |

### `settings_test.py`

Tests must be fast, isolated and runnable with no credentials:

- **in-memory SQLite** — never touches a real database
- **MD5 hasher** — Argon2 PIN hashing otherwise dominates runtime (9.4s → 0.1s)
- **FileSystemStorage** — production uses Backblaze B2; tests need no network
- **locmem cache, eager celery**
- **SSL redirect / secure cookies off** — production hardening breaks the HTTP
  test client
- **logging silenced** — the API logs every 401/403 as a warning by design,
  which otherwise drowns the output

### `factories.py`

Deliberately dependency-free — no `factory_boy`. `login()` drives the real
`/accounts/api/login/` endpoint rather than `force_login()`, so the session and
CSRF path is genuinely exercised rather than bypassed. Test PIN is `123456`.

### Notes on specific suites

**`test_performance.py`** keeps a copy of the *original* per-month aggregation
loop as an oracle and asserts the optimized `TruncMonth` version returns
identical figures. An earlier verification passed vacuously because every
expense total was `0.0` — the fixtures here deliberately include multi-row
months, an empty month and fractional kobo so the comparison is meaningful.

Query budgets are tripwires, not benchmarks: members list `< 15` (was 33,
now 8), dashboard cold `< 60` (was 72, now 50), trend `<= 4` (was 24, now 2).

**`test_modules.py`** discovers the API surface from the URL resolver instead of
hardcoding paths, so a newly added endpoint is covered automatically and the
suite cannot drift from the real routes.

---

## Frontend — `tests/frontend/`

```bash
node tests/frontend/run-all.mjs
```

No `npm install`, no build step, no `node_modules` — consistent with how the
frontend itself ships. `harness.mjs` provides the assertions, the runner, and a
`vm`-based loader that evaluates a browser script against a fake `window`.

| File | Tests | Covers |
|---|---|---|
| `test-api-client.mjs` | 37 | error matrix, retry safety, timeout vs abort, cancellation, dedupe |
| `test-cache-ttl.mjs` | 17 | TTL expiry, version invalidation, the never-cache list |
| `test-config-lockstep.mjs` | 17 | version lockstep, config integrity, cross-module contracts |

The service-worker tests run `sw.js` inside a VM against a fake Cache Storage
implementation, then drive it with real `message` events (`SWEEP_EXPIRED` →
`SWEEP_RESULT`), so the TTL logic is executed rather than merely inspected.

### Contracts these lock down

- a mutation is **never** retried or deduplicated (no idempotency keys exist,
  so a replayed POST could double-record a payment, donation or vote)
- `429` is never retried
- a timeout is a distinct error kind from a user abort
- a superseded search response can never overwrite a newer one
- `/api/`, `/admin/`, `/media/`, `/accounts/` and `version.json` are never cached
- the service worker never calls `skipWaiting()` on its own
- `config.js` / `version.json` / `sw.js` versions match exactly
- every file in the precache list exists (a missing one makes install fail, so
  the worker would never activate)
- no page calls `fetch()` directly, and no page loads a chart CDN

---

## Releasing — `tools/release.mjs`

Three files must carry the identical version string, and every way of getting
that wrong fails **silently**:

| Mistake | Symptom |
|---|---|
| `config.js` ahead of `version.json` | the app never detects an update |
| `config.js` behind `version.json` | "update available" prompts forever |
| `sw.js` not bumped | old caches are never dropped; users get stale assets until the 3-day TTL expires |

So the bump is automated rather than manual:

```bash
npm run release              # bump to today's next build
npm run release -- --dry-run # preview
npm run release 2026.10.01.1 # explicit version
npm run release:check        # CI guard — exits 1 on mismatch
```

The tool re-reads the files after writing and verifies them, never lets the
version go backwards, and preserves any extra keys in `version.json`. Two
independent guards cover this: `release:check` and the `version lockstep` tests
in `test-config-lockstep.mjs` — both were verified to fail on an injected
mismatch.

**Always commit the three files together, never separately.**

---

## Bugs these tests found

Writing the suites surfaced three defects that were live in the deployed app:

1. **Member detail returned HTTP 500 for every member.** `members/api.py`
   serialized `age_check`, `should_be_past_member`, `is_active_member` and
   `is_past_member` via `getattr(...)` — but those are *methods*, not
   properties, so `json.dumps` received a bound method and raised
   `TypeError: Object of type method is not JSON serializable`. Now called.

2. **Nine JSON endpoints answered unauthenticated callers with a 302 redirect
   to the HTML login page** instead of a 401. `fetch()` follows redirects
   transparently, so the frontend received HTTP 200 and an HTML document where
   it expected JSON. `/accounts/api/users/search/` alone is used by seven
   pages. Fixed with `core.utils.json_login_required`.

3. **`dashboard/views.py::member_dashboard()` called
   `get_member_recent_activities()` without importing it** — a latent
   `NameError`. A `pyflakes` sweep confirmed this was the only such case.

---

## Not covered

Honest gaps, in rough priority order:

- **No browser-level end-to-end tests.** The service worker is tested against a
  fake Cache Storage, not a real one; PWA install and update flows are verified
  by contract, not by driving Chrome.
- **`pwa.js` update-prompt UI** is only partially covered (its `_internals` are
  exposed but the DOM banner is untested).
- **PDF/report generation** (`reportlab`) is untested.
- **Celery tasks** run eagerly under test, so scheduling and retry behaviour is
  not exercised.
- **File uploads to Backblaze B2** are untested by design — no credentials in
  tests.
- **Concurrency**: the one-vote-per-post rule is tested sequentially. The
  database constraint is the real guarantee; a genuine race is not simulated.
