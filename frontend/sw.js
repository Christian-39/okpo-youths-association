/* OYA service worker — conservative by design. API and authenticated data are network-only. */
"use strict";
const VERSION = "oya-2026.09.18.1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "offline.html";
const PRECACHE = [
  "./offline.html", "./index.html", "./login.html", "./dashboard.html", "./members.html", "./finance.html", "./projects.html", "./executives.html", "./elections.html", "./handover-list.html", "./handover-form.html", "./handover-detail.html", "./administrations.html", "./administration-report.html", "./donations.html", "./donation-detail.html", "./pledges.html", "./pledge-detail.html", "./manifest.webmanifest", "./version.json",
  "./assets/css/base.css", "./assets/css/layout.css", "./assets/css/components.css",
  "./assets/css/dashboard.css", "./assets/css/darkmode.css", "./assets/css/mobile.css",
  "./assets/css/responsive.css", "./assets/css/pwa.css",
  "./assets/js/config.js", "./assets/js/api.js", "./assets/js/auth.js", "./assets/js/theme.js",
  "./assets/js/shell.js", "./assets/js/pwa.js", "./assets/js/charts.js", "./assets/js/accounts/login.js",
  "./components/sidebar.html", "./components/topbar.html", "./components/mobile_top_header.html",
  "./components/mobile_nav.html", "./components/footer.html",
  "./assets/images/oya_logo.png", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)))));
  // Do not activate over an open form. The page will send SKIP_WAITING after
  // the user chooses Refresh in the update prompt.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => ![STATIC_CACHE, PAGE_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
});

function isApiRequest(url) {
  return url.pathname.includes("/api/") || url.pathname.includes("/admin/") || url.pathname.includes("/media/");
}
function isStaticAsset(url) {
  return ["style", "script", "image", "font"].includes(url.destination) || /\.(?:css|js|png|jpg|jpeg|svg|webmanifest|json)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;
  if (isApiRequest(url)) return; // never cache authenticated or sensitive data
  if (url.pathname.endsWith("/version.json")) return; // deployment probe must be fresh
  if (url.pathname.includes("/components/") && url.pathname.endsWith(".html")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
      return response;
    })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => {
      return (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
    }));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
        return response;
      } catch (_) {
        return Response.error();
      }
    }));
  }
});
