# settings.py / requirements.txt changes

The project currently has **no API layer and no CORS configuration** —
this is new, and is the one genuinely new dependency this migration
requires (per the "no unnecessary dependencies" rule, everything else
reuses what's already installed).

## 1. requirements.txt — add one line

```
django-cors-headers>=4.3.0
```

## 2. oya/settings.py

**INSTALLED_APPS** — add to `THIRD_PARTY_APPS` (or `LOCAL_APPS`, wherever
third-party apps are listed):

```python
THIRD_PARTY_APPS = [
    ...,
    "corsheaders",   # NEW
]
```

**MIDDLEWARE** — `corsheaders.middleware.CorsMiddleware` must sit as high
as possible, and before `CommonMiddleware`:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",              # NEW — before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.AuditLogMiddleware",
    "core.middleware.ExceptionHandlerMiddleware",
]
```

**CORS + CSRF trust** — add near the bottom of settings.py. Do **not**
use `CORS_ALLOW_ALL_ORIGINS = True` in production (per the migration's
own security rule) — list the actual frontend origin(s):

```python
# Standalone frontend origins (dev + prod). Update these to match
# wherever you actually serve the frontend/ directory from.
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",   # e.g. VS Code Live Server
    "http://localhost:5500",
    # "https://oya-frontend.example.org",   # production frontend origin
]
CORS_ALLOW_CREDENTIALS = True   # required — the frontend sends the session cookie

# Django's CSRF protection must also trust the same origins for the
# POST/PUT/PATCH/DELETE calls the frontend makes.
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    # "https://oya-frontend.example.org",
]
```

### A note on cookies across origins

Because the frontend is a different origin than Django (different
port, or different domain entirely), the session cookie and CSRF
cookie must be sendable cross-site:

- In **production** (HTTPS on both sides), set:
  ```python
  SESSION_COOKIE_SAMESITE = "None"
  CSRF_COOKIE_SAMESITE = "None"
  # SESSION_COOKIE_SECURE / CSRF_COOKIE_SECURE are already True in your
  # production block — SameSite=None requires Secure, which you already have.
  ```
- In **local development** over plain HTTP, browsers reject
  `SameSite=None` cookies without `Secure`, so the simplest fix is to
  serve the frontend from the **same site** as Django during dev (e.g.
  Django's own `staticfiles`/`whitenoise`, or a dev proxy that puts
  both under `127.0.0.1`). This sidesteps the cross-origin cookie
  problem entirely and is the recommended setup for production too —
  serving `frontend/` from the same domain as the API (just a
  different path or subdomain with proper `SameSite=None; Secure`)
  avoids CORS complexity altogether.

No other existing settings are touched.
