/* ==========================================================================
   OYA — service worker

   DESIGN RULES (this app holds financial, election and membership records —
   the conservative posture below is deliberate and must not be relaxed):

   1. The Django backend is the ONLY source of truth. No API response is ever
      cached or served from cache. Authentication, permissions, financial
      balances, transactions, election state, votes, candidates, member
      records, audit logs and administrative data stay network-authoritative.
   2. Only public, non-sensitive application shell assets are cached: our own
      CSS/JS, icons, the layout component fragments, and previously visited
      page shells.
   3. Caches are versioned. Every activation deletes every cache that does not
      belong to the current version — so a deployment invalidates old assets
      IMMEDIATELY, without waiting for any TTL.
   4. Every cached entry is stamped with `x-oya-cached-at`. Entries older than
      CACHE_TTL_MS (3 days) are refused at read time and re-fetched, and are
      swept on activation. Users never have to clear their browser cache or
      reinstall the PWA.
   5. This worker never calls skipWaiting() on its own. It waits until the page
      says so (assets/js/pwa.js only does that once the user presses Refresh
      and is not mid-form, mid-upload, mid-vote or mid-payment).

   CACHE_VERSION must stay in lockstep with version.json and
   assets/js/config.js APP_VERSION — tools/release.mjs rewrites all three.
   ========================================================================== */

"use strict";

const APP_VERSION = "2026.09.23.3";
const STATIC_CACHE = `oya-static-${APP_VERSION}`;
const PAGE_CACHE = `oya-pages-${APP_VERSION}`;
const CURRENT_CACHES = new Set([STATIC_CACHE, PAGE_CACHE]);

/* Mechanism A of cache invalidation: a hard 3-day time-to-live.
   (Mechanism B is the version swap above — the two are independent by design,
   so a new deployment never waits 3 days, and a device that never gets a new
   deployment never serves assets older than 3 days.) */
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const STAMP_HEADER = "x-oya-cached-at";

const OFFLINE_URL = "offline.html";
const PAGE_CACHE_LIMIT = 30;

/* A small, deliberate precache: the offline page, the shared stylesheet graph
   and the shared JS bootstrap. Individual record pages are NOT precached —
   they are cached only once actually visited. */
const PRECACHE = [
  "./offline.html",
  "./index.html",
  "./login.html",
  "./manifest.webmanifest",
  "./assets/css/base.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/css/dashboard.css",
  "./assets/css/darkmode.css",
  "./assets/css/mobile.css",
  "./assets/css/responsive.css",
  "./assets/css/pwa.css",
  "./assets/js/config.js",
  "./assets/js/api.js",
  "./assets/js/auth.js",
  "./assets/js/theme.js",
  "./assets/js/shell.js",
  "./assets/js/pwa.js",
  "./assets/js/charts.js",
  "./assets/js/accounts/login.js",
  "./components/sidebar.html",
  "./components/topbar.html",
  "./components/mobile_top_header.html",
  "./components/mobile_nav.html",
  "./components/footer.html",
  "./assets/images/oya_logo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

/* ─────────────────────────── TTL helpers ─────────────────────────────── */

/**
 * Clone a response, adding the cache timestamp header.
 * Response headers are immutable, so the body has to be re-wrapped.
 */
async function stampedResponse(response) {
  const body = await response.clone().blob();
  const headers = new Headers(response.headers);
  headers.set(STAMP_HEADER, String(Date.now()));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** True when a cached entry has outlived the TTL. */
function isExpired(response, ttl = CACHE_TTL_MS) {
  if (!response) return true;
  const stamp = Number(response.headers.get(STAMP_HEADER) || 0);
  // Unstamped entries come from an older build; treat as expired so they are
  // replaced once rather than lingering forever.
  if (!stamp) return true;
  return Date.now() - stamp >= ttl;
}

async function putStamped(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, await stampedResponse(response));
  } catch (_) {
    /* quota / storage pressure — never fatal */
  }
}

/** Read from cache, honouring the TTL. Expired entries are deleted. */
async function matchFresh(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreVary: true });
    if (!cached) return null;
    if (isExpired(cached)) {
      await cache.delete(request);
      return null;
    }
    return cached;
  } catch (_) {
    return null;
  }
}

/** Remove every entry past its TTL across all OYA caches. */
async function sweepExpired() {
  const names = (await caches.keys()).filter((n) => n.startsWith("oya-"));
  let swept = 0;
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const cached = await cache.match(request);
      if (cached && isExpired(cached)) {
        await cache.delete(request);
        swept += 1;
      }
    }
  }
  return swept;
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
  } catch (_) {}
}

/* ───────────────────────────── Install ───────────────────────────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Added individually (not addAll) so one missing optional asset can
      // never abort the whole installation.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (response.ok) await cache.put(url, await stampedResponse(response));
          } catch (_) {
            /* offline during install — fetched later on demand */
          }
        })
      );
    })()
  );
  // NOTE: no self.skipWaiting() — the page decides when it is safe to swap.
});

/* ──────────────────────────── Activate ───────────────────────────────── */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Deployment-based invalidation: drop every cache from an older version.
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (CURRENT_CACHES.has(key) ? null : caches.delete(key)))
      );
      // TTL-based invalidation, applied on every activation as well.
      await sweepExpired();

      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      await self.clients.claim();
    })()
  );
});

/* ───────────────────── Messages from the page ────────────────────────── */

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();

  if (data.type === "GET_VERSION" && event.source) {
    event.source.postMessage({ type: "VERSION", version: APP_VERSION });
  }

  // Lets the page (and the automated tests) trigger and observe a TTL sweep.
  if (data.type === "SWEEP_EXPIRED") {
    event.waitUntil(
      sweepExpired().then((swept) => {
        if (event.source) event.source.postMessage({ type: "SWEEP_RESULT", swept });
      })
    );
  }
});

/* ──────────────────────────── Routing ────────────────────────────────── */

/** Never touch anything that is or could be authenticated/sensitive. */
function isSensitive(url) {
  return (
    url.pathname.includes("/api/") ||
    url.pathname.includes("/admin/") ||
    url.pathname.includes("/media/") ||
    url.pathname.includes("/accounts/")
  );
}

function isStaticAsset(request, url) {
  const dest = request.destination;
  if (["style", "script", "font", "manifest", "image"].includes(dest)) return true;
  return /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|woff2?|webmanifest)$/.test(url.pathname);
}

/**
 * Application shell assets: serve from cache when fresh, otherwise network.
 * A background revalidation refreshes the entry so a change lands on the next
 * load even inside the TTL window.
 */
async function assetStrategy(request) {
  const cached = await matchFresh(STATIC_CACHE, request);
  if (cached) {
    // Refresh in the background; failure is irrelevant, we already answered.
    fetch(request)
      .then((response) => putStamped(STATIC_CACHE, request, response))
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    await putStamped(STATIC_CACHE, request, response);
    return response;
  } catch (_) {
    // Last resort: an expired copy beats a broken page when offline.
    const cache = await caches.open(STATIC_CACHE);
    const stale = await cache.match(request, { ignoreVary: true });
    return stale || Response.error();
  }
}

/** Page navigations: network-first, cached shell as the offline fallback. */
async function navigationStrategy(event) {
  const request = event.request;
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const response = preload || (await fetch(request));
    if (response && response.ok && response.type === "basic") {
      await putStamped(PAGE_CACHE, request, response);
      trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT);
    }
    return response;
  } catch (_) {
    const cached =
      (await matchFresh(PAGE_CACHE, request)) ||
      (await caches.match(request, { ignoreSearch: true, ignoreVary: true }));
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response(
      "You are offline and this page has not been saved for offline use.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Mutations (login, payments, votes, uploads) go straight to the network.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  // Cross-origin — notably the Render API — is never intercepted.
  if (url.origin !== self.location.origin) return;

  // Range requests: let the browser handle them.
  if (request.headers.has("range")) return;

  // API / admin / media / accounts: completely untouched, so a cached
  // response can never stand in for authoritative data.
  if (isSensitive(url)) return;

  // The deployment probe must always hit the network, or a stale copy could
  // hide a release indefinitely.
  if (url.pathname.endsWith("/version.json")) return;

  // Anything carrying an Authorization header: pass through.
  if (request.headers.has("authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(event));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(assetStrategy(request));
    return;
  }

  // Everything else goes to the network untouched.
});
