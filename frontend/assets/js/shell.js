/**
 * OYA Frontend — App Shell
 *
 * Every protected page includes this shell markup once:
 *
 *   <div class="app-shell">
 *     <div id="sidebar-slot"></div>
 *     <div class="sidebar-overlay" id="sidebarOverlay"></div>
 *     <main class="main-content" id="mainContent">
 *       <div id="topbar-slot"></div>
 *       <div class="content-area" id="contentArea">
 *         <div class="page-container" id="pageContainer">...page content...</div>
 *       </div>
 *       <div id="footer-slot"></div>
 *     </main>
 *   </div>
 *   <div id="mobile-top-header-slot"></div>
 *   <div id="mobile-nav-slot"></div>
 *
 * Then calls OYA_SHELL.init({ page: "members", title: "Members" }).
 *
 * Component contract
 * -------------------
 * Every `*-slot` div is a MOUNT POINT, not the component itself. Component
 * HTML is fetched from OYA_CONFIG.COMPONENT_BASE_URL (see config.js — this
 * is resolved from the frontend's own deployment root, not from whichever
 * page happens to be open) and inserted with `slot.innerHTML = html`. The
 * slot node itself is never replaced (no `outerHTML`), so the contract is
 * unambiguous and consistent across every component:
 *
 *   Page:      <div id="sidebar-slot"></div>
 *   Component: <aside id="sidebar" class="sidebar">...</aside>
 *   Result:    <div id="sidebar-slot"><aside id="sidebar" ...>...</aside></div>
 *
 * Initialization order
 * ---------------------
 *   1. Fetch all component HTML in parallel.
 *   2. Validate every response (HTTP status + non-empty + looks like a
 *      fragment, not a host's SPA-fallback/404 HTML page).
 *   3. Inject validated components into their slots.
 *   4. Wire component-dependent interactions (theme, dropdowns, mobile nav,
 *      sidebar collapse, search, logout) — only now that the DOM nodes
 *      those functions look up actually exist.
 *   5. Resolve the authenticated user and apply it to the chrome.
 *   6. Refresh the notification badge.
 *
 * Failures at any component-loading step are logged loudly to the console
 * (component name, resolved URL, HTTP status, reason) and a visible — but
 * non-blocking — fallback is left in place instead of a silent blank slot.
 */
(function () {
  "use strict";

  const COMPONENTS = [
    { name: "sidebar", slotId: "sidebar-slot" },
    { name: "topbar", slotId: "topbar-slot" },
    { name: "mobile_top_header", slotId: "mobile-top-header-slot" },
    { name: "mobile_nav", slotId: "mobile-nav-slot" },
    { name: "footer", slotId: "footer-slot" },
  ];

  function componentBase() {
    const cfg = window.OYA_CONFIG || {};
    if (cfg.COMPONENT_BASE_URL) return cfg.COMPONENT_BASE_URL.replace(/\/+$/, "");
    // Defensive fallback if config.js failed to load/execute for some
    // reason — keeps the previous (page-relative) behaviour rather than
    // throwing, though this should not happen in practice.
    console.warn("OYA_SHELL: OYA_CONFIG.COMPONENT_BASE_URL is unavailable; falling back to a page-relative \"components\" path.");
    return "components";
  }

  function componentUrl(name) {
    return `${componentBase()}/${name}.html`;
  }

  /**
   * Looks like an actual reusable HTML fragment (an element), not a full
   * HTML document. Guards against static hosts that return a 200 with
   * their SPA/catch-all index page for any unmatched path — a response
   * that `res.ok` alone would not catch.
   */
  function looksLikeFragment(html) {
    if (!html || !html.trim()) return false;
    return !/<!doctype html/i.test(html) && !/<html[\s>]/i.test(html);
  }

  async function fetchComponent(name) {
    const url = componentUrl(name);
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (err) {
      logComponentFailure(name, url, null, `network error — ${err && err.message}`);
      throw err;
    }

    if (!res.ok) {
      logComponentFailure(name, url, res.status, `HTTP ${res.status}`);
      throw new Error(`OYA component "${name}" failed to load (HTTP ${res.status})`);
    }

    const html = await res.text();

    if (!html || !html.trim()) {
      logComponentFailure(name, url, res.status, "response body was empty");
      throw new Error(`OYA component "${name}" returned an empty response`);
    }

    if (!looksLikeFragment(html)) {
      logComponentFailure(name, url, res.status, "response looks like a full HTML document, not a component fragment (likely a 404/SPA-fallback page served with a 200 status)");
      throw new Error(`OYA component "${name}" did not return a valid fragment`);
    }

    return html;
  }

  function logComponentFailure(name, url, status, reason) {
    console.error(
      [
        "OYA component load failed:",
        `  component: ${name}.html`,
        `  URL:       ${url}`,
        `  HTTP status: ${status == null ? "(no response)" : status}`,
        `  reason:    ${reason}`,
      ].join("\n")
    );
  }

  function renderFallback(name) {
    return `<div class="oya-component-error" style="padding:0.75rem 1rem;background:#fdecea;color:#611a15;font-size:0.8125rem;border-bottom:1px solid #f5c2c0;">` +
      `OYA: the "${name}" component failed to load. Check the browser console and confirm the frontend is served from its own root (component requests must return 200, not a 404/login page).` +
      `</div>`;
  }

  /**
   * Fetches, validates and injects every shared component. Each component
   * is handled independently — one failing does not prevent the others
   * from loading — but every failure is loud (console.error) and leaves a
   * visible marker in its slot instead of a silent blank space.
   */
  async function loadComponents() {
    const results = await Promise.allSettled(
      COMPONENTS.map(async ({ name }) => ({ name, html: await fetchComponent(name) }))
    );

    let failureCount = 0;

    results.forEach((result, i) => {
      const { name, slotId } = COMPONENTS[i];
      const slot = document.getElementById(slotId);
      if (!slot) {
        // Not every page necessarily uses every slot (none currently omit
        // one, but a page-specific layout tweak shouldn't hard-fail here).
        return;
      }
      if (result.status === "fulfilled") {
        slot.innerHTML = result.value.html;
      } else {
        failureCount += 1;
        slot.innerHTML = renderFallback(name);
      }
    });

    return failureCount === 0;
  }

  function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  }

  function setActiveNav(page) {
    document.querySelectorAll("[data-page]").forEach((el) => {
      // A nav item may declare more than one page key (space-separated),
      // e.g. data-page="elections handover" so the Elections item stays
      // active across the handover/administration sub-pages too.
      const pages = (el.dataset.page || "").split(/\s+/).filter(Boolean);
      el.classList.toggle("active", pages.includes(page));
    });
  }

  function applyUserToChrome(user) {
    const initials = (name) =>
      (name || "?").trim().slice(0, 2).toUpperCase();

    // Sidebar footer
    const sName = document.getElementById("sidebarUserName");
    const sRole = document.getElementById("sidebarUserRole");
    const sAvatar = document.getElementById("sidebarUserAvatar");
    if (user) {
      if (sName) sName.textContent = user.full_name || user.serial_number;
      if (sRole) sRole.textContent = user.display_role || "Member";
      if (sAvatar) {
        sAvatar.innerHTML = user.photo_url
          ? `<img src="${user.photo_url}" alt="${escapeHtml(user.full_name || "")}" style="width:100%;height:100%;object-fit:cover">`
          : initials(user.full_name || user.serial_number);
      }
    }

    // Topbar avatar
    const tInitial = document.getElementById("topbarAvatarInitial");
    const tImg = document.getElementById("topbarAvatarImg");
    if (user && user.photo_url) {
      if (tImg) { tImg.src = user.photo_url; tImg.style.display = ""; }
      if (tInitial) tInitial.style.display = "none";
    } else if (user && tInitial) {
      tInitial.textContent = initials(user.full_name || user.serial_number);
    }

    // Mobile sidebar profile
    const mName = document.getElementById("mobileSidebarName");
    const mRole = document.getElementById("mobileSidebarRole");
    const mAvatar = document.getElementById("mobileSidebarAvatar");
    if (user) {
      if (mName) mName.textContent = user.full_name || user.serial_number;
      if (mRole) mRole.textContent = user.display_role || "Member";
      if (mAvatar) mAvatar.textContent = initials(user.full_name || user.serial_number);
    }

    // Executive-only nav items (audit logs, settings, etc.). This is
    // presentation only — the backend API remains the sole source of
    // truth for what a user is actually allowed to do.
    const showExec = !!(user && user.has_executive_access);
    document.querySelectorAll(".nav-item-executive").forEach((el) => {
      el.style.display = showExec ? "" : "none";
    });
  }

  /**
   * Builds the mobile drawer navigation by cloning the desktop sidebar's
   * nav sections (title + links) — the desktop sidebar remains the single
   * source of truth for navigation structure and role-based visibility,
   * so links never need to be maintained in two places.
   */
  function buildMobileSidebarNav() {
    const desktopNav = document.querySelector("#sidebar .sidebar-nav");
    const mobileNav = document.getElementById("mobileSidebarNav");
    if (!desktopNav || !mobileNav) {
      console.error(
        "OYA_SHELL: could not build the mobile navigation drawer — " +
        (desktopNav ? "#mobileSidebarNav" : "#sidebar .sidebar-nav") +
        " was not found in the DOM. Check that the sidebar/mobile_top_header components loaded correctly."
      );
      return;
    }

    mobileNav.innerHTML = "";
    desktopNav.querySelectorAll(".nav-section").forEach((section) => {
      const clonedSection = document.createElement("div");
      clonedSection.className = "mobile-nav-section";

      const title = section.querySelector(".nav-section-title");
      if (title) {
        const clonedTitle = document.createElement("div");
        clonedTitle.className = "mobile-nav-section-title";
        clonedTitle.textContent = title.textContent;
        clonedSection.appendChild(clonedTitle);
      }

      section.querySelectorAll(".nav-item").forEach((item) => {
        const clone = item.cloneNode(true);
        clone.classList.remove("nav-item");
        clone.classList.add("mobile-nav-link");
        clonedSection.appendChild(clone);
      });

      mobileNav.appendChild(clonedSection);
    });
  }

  function wireTheme() {
    const desktopBtn = document.getElementById("themeMenuToggle");
    const mobileBtn = document.getElementById("mobileThemeBtn");
    const themeMenu = document.getElementById("themeDropdownMenu");

    if (themeMenu) {
      themeMenu.querySelectorAll("[data-theme-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.OYA.setTheme(btn.dataset.themeOption);
          const parent = themeMenu.closest(".dropdown");
          if (parent) parent.classList.remove("open");
        });
      });
    }

    if (mobileBtn) {
      mobileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const current = window.OYA.getTheme();
        const next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
        window.OYA.setTheme(next);
      });
    }

    function updateThemeUI() {
      const stored = window.OYA.getTheme();
      [desktopBtn, mobileBtn].forEach((btn) => {
        if (!btn) return;
        btn.setAttribute("data-active-theme", stored);
        btn.querySelectorAll(".theme-icon-light, .theme-icon-dark, .theme-icon-system").forEach((i) => (i.style.display = "none"));
        const cls = stored === "system" ? "theme-icon-system" : stored === "dark" ? "theme-icon-dark" : "theme-icon-light";
        const icon = btn.querySelector("." + cls);
        if (icon) icon.style.display = "inline-block";
      });
    }
    updateThemeUI();
    window.addEventListener("oyathemechange", updateThemeUI);
  }

  function wireMobileSidebar() {
    const hamburger = document.getElementById("mobileHamburger");
    const mobileSidebar = document.getElementById("mobileSidebar");
    const overlay = document.getElementById("mobileSidebarOverlay");
    const closeBtn = document.getElementById("mobileSidebarClose");

    function open() {
      mobileSidebar && mobileSidebar.classList.add("open");
      overlay && overlay.classList.add("active");
      document.body.classList.add("sidebar-open");
    }
    function close() {
      mobileSidebar && mobileSidebar.classList.remove("open");
      overlay && overlay.classList.remove("active");
      document.body.classList.remove("sidebar-open");
    }
    hamburger && hamburger.addEventListener("click", (e) => { e.preventDefault(); open(); });
    closeBtn && closeBtn.addEventListener("click", (e) => { e.preventDefault(); close(); });
    overlay && overlay.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    // Tapping any link inside the drawer should close it, same as desktop
    // navigation away from the page.
    mobileSidebar && mobileSidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", close);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024) close();
    });
  }

  function wireDesktopSidebarToggle() {
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    const mainContent = document.getElementById("mainContent");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar || !toggle) return;
    toggle.addEventListener("click", () => {
      if (window.innerWidth > 1024) {
        sidebar.classList.toggle("collapsed");
        mainContent && mainContent.classList.toggle("expanded");
      } else {
        sidebar.classList.toggle("show");
        overlay && overlay.classList.toggle("show");
      }
    });
    overlay && overlay.addEventListener("click", () => {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
    });
  }

  function wireDropdowns() {
    document.querySelectorAll(".dropdown-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dropdown = btn.closest(".dropdown");
        document.querySelectorAll(".dropdown.open").forEach((d) => { if (d !== dropdown) d.classList.remove("open"); });
        dropdown.classList.toggle("open");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    });
  }

  function wireLogout() {
    ["topbarLogoutLink", "mobileSidebarLogoutLink"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", (e) => { e.preventDefault(); window.OYA_AUTH.logout(); });
    });
  }

  async function updateNotificationBadge() {
    try {
      const data = await window.OYA_API.apiFetch("/notifications/api/unread-count/");
      const count = data.unread_count || data.count || 0;
      const topbarBadge = document.getElementById("notificationBadge");
      const sidebarBadge = document.getElementById("sidebarNotifBadge");
      const mobileBadge = document.getElementById("mobileNotifBadge");
      [topbarBadge, sidebarBadge].forEach((b) => {
        if (!b) return;
        if (count > 0) { b.textContent = count > 99 ? "99+" : count; b.style.display = "flex"; }
        else b.style.display = "none";
      });
      if (mobileBadge) {
        if (count > 0) { mobileBadge.textContent = count > 99 ? "99+" : count; mobileBadge.style.display = "flex"; }
        else mobileBadge.style.display = "none";
      }
    } catch (err) {
      // Non-fatal — badge just stays hidden. Logged so a genuine
      // backend outage is still visible in devtools rather than
      // looking like "zero notifications" forever.
      console.warn("OYA: couldn't refresh notification badge:", err);
    }
  }

  function wireGlobalSearch() {
    const input = document.getElementById("globalSearch");
    const resultsBox = document.getElementById("searchResults");
    if (!input || !resultsBox) return;
    const url = input.dataset.searchUrl;
    const searchFetch = window.OYA_API.createCancellable();
    let debounceTimer;

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) { resultsBox.classList.add("hidden"); return; }
      debounceTimer = setTimeout(async () => {
        try {
          const data = await searchFetch(`${url}?q=${encodeURIComponent(q)}`, { timeout: 10000 });
          renderSearchResults(data.results || []);
        } catch (err) {
          if (err && err.kind === "abort") return;
          console.error("OYA: global search failed:", err);
          resultsBox.innerHTML = `<div class="dropdown-item" style="color:var(--oya-danger);">Search unavailable — try again</div>`;
          resultsBox.classList.remove("hidden");
        }
      }, 300);
    });

    // Maps a search result's `type` to the frontend page that can show
    // it. The backend intentionally only returns `type` + `id` (not a
    // URL) — this frontend owns its own routing, not the Django app.
    const SEARCH_TYPE_PAGES = {
      member: "member-detail.html?id=",
      case: "case-detail.html?id=",
      project: "project-detail.html?id=",
      outside_donor: "outside-donor-detail.html?id=",
    };

    function renderSearchResults(results) {
      if (!results.length) {
        resultsBox.innerHTML = `<div class="dropdown-item">No results</div>`;
      } else {
        resultsBox.innerHTML = results
          .map((r) => {
            const page = SEARCH_TYPE_PAGES[r.type];
            // "user" (and any future unmapped type) has no standalone
            // frontend detail page yet — show as plain text rather than
            // a dead or misleading link.
            return page
              ? `<a class="dropdown-item" href="${page}${encodeURIComponent(r.id)}">${escapeHtml(r.name)}</a>`
              : `<div class="dropdown-item" style="opacity:0.7;">${escapeHtml(r.name)}</div>`;
          })
          .join("");
      }
      resultsBox.classList.remove("hidden");
    }

    document.addEventListener("click", (e) => {
      if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.classList.add("hidden");
    });
  }

  function wireComponentInteractions(opts) {
    if (opts && opts.title) {
      const titleEl = document.getElementById("pageTitle");
      if (titleEl) titleEl.textContent = opts.title;
      document.title = `${opts.title} | OYA`;
    }

    const yearEl = document.getElementById("footerYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Nav structure must exist before we clone it into the mobile drawer,
    // and active state should be set before cloning so the clone inherits
    // the correct ".active" class.
    if (opts && opts.page) setActiveNav(opts.page);
    buildMobileSidebarNav();

    wireTheme();
    wireMobileSidebar();
    wireDesktopSidebarToggle();
    wireDropdowns();
    wireLogout();
    wireGlobalSearch();
  }

  function showShellError() {
    if (document.getElementById("oyaShellFatalError")) return;
    const banner = document.createElement("div");
    banner.id = "oyaShellFatalError";
    banner.setAttribute("role", "alert");
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#611a15;color:#fff;padding:0.75rem 1rem;font-size:0.875rem;text-align:center;";
    banner.textContent = "OYA couldn't load the application shell. Please refresh the page, or contact support if the problem continues.";
    document.body.appendChild(banner);
  }

  const OYA_SHELL = {
    /**
     * @param {object} opts
     * @param {string} opts.page - matches data-page on nav links, for active state
     * @param {string} [opts.title] - page title shown in the topbar
     * @param {boolean} [opts.requireExecutive] - redirect non-executives away
     * @param {boolean} [opts.requireAdmin] - redirect non-admins away
     */
    async init(opts) {
      try {
        // 1–3: fetch, validate, inject.
        const allLoaded = await loadComponents();
        if (!allLoaded) {
          // Not fatal — the fallback markers are visible and console.error
          // already ran per-component. Interactions below still wire up
          // defensively (every helper null-checks its elements).
          console.error("OYA_SHELL: one or more shared components failed to load. See errors above.");
        }

        // 4: wire component-dependent interactions now that the DOM exists.
        wireComponentInteractions(opts);

        // 5: resolve + apply the authenticated user.
        const user = await window.OYA_AUTH.requireAuth();
        if (!user) return null; // requireAuth already redirected to login

        if (opts && opts.requireAdmin && !user.has_admin_access) {
          window.OYA.showToast("Admin access required.", "error");
          setTimeout(() => (window.location.href = window.OYA_CONFIG.ROUTES.dashboard), 1200);
          return user;
        }
        if (opts && opts.requireExecutive && !user.has_executive_access) {
          window.OYA.showToast("Executive access required.", "error");
          setTimeout(() => (window.location.href = window.OYA_CONFIG.ROUTES.dashboard), 1200);
          return user;
        }

        applyUserToChrome(user);

        // 6: notifications.
        await updateNotificationBadge();
        setInterval(updateNotificationBadge, 60000);

        return user;
      } catch (error) {
        console.error("OYA shell initialization failed:", error);
        showShellError();
        return null;
      }
    },
  };

  window.OYA_SHELL = OYA_SHELL;
})();
