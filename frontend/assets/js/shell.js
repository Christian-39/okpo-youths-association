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
 * This mirrors templates/base.html's {% include %}s + inline <script> blocks.
 */
(function () {
  "use strict";

  async function fetchComponent(name) {
    const res = await fetch(`components/${name}.html`);
    return res.text();
  }

  function setActiveNav(page) {
    document.querySelectorAll("[data-page]").forEach((el) => {
      el.classList.toggle("active", el.dataset.page === page);
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
          ? `<img src="${user.photo_url}" alt="${user.full_name}" style="width:100%;height:100%;object-fit:cover">`
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

    // Executive-only nav items (audit logs, settings)
    const showExec = !!(user && user.has_executive_access);
    document.querySelectorAll(".nav-item-executive").forEach((el) => {
      el.style.display = showExec ? "" : "none";
    });
  }

  function buildMobileSidebarNav() {
    const desktopNav = document.querySelector("#sidebar .sidebar-nav");
    const mobileNav = document.getElementById("mobileSidebarNav");
    if (!desktopNav || !mobileNav) return;

    mobileNav.innerHTML = "";
    desktopNav.querySelectorAll(".nav-item").forEach((item) => {
      const clone = item.cloneNode(true);
      clone.classList.remove("nav-item");
      clone.classList.add("mobile-nav-link");
      mobileNav.appendChild(clone);
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
    } catch (_) { /* non-fatal */ }
  }

  function wireGlobalSearch() {
    const input = document.getElementById("globalSearch");
    const resultsBox = document.getElementById("searchResults");
    if (!input || !resultsBox) return;
    const url = input.dataset.searchUrl;
    let debounceTimer;

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) { resultsBox.classList.add("hidden"); return; }
      debounceTimer = setTimeout(async () => {
        try {
          const data = await window.OYA_API.apiFetch(`${url}?q=${encodeURIComponent(q)}`);
          renderSearchResults(data.results || []);
        } catch (_) { /* ignore */ }
      }, 300);
    });

    function renderSearchResults(results) {
      if (!results.length) {
        resultsBox.innerHTML = `<div class="dropdown-item">No results</div>`;
      } else {
        resultsBox.innerHTML = results
          .map((r) => `<a class="dropdown-item" href="${r.url}">${r.name}</a>`)
          .join("");
      }
      resultsBox.classList.remove("hidden");
    }

    document.addEventListener("click", (e) => {
      if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.classList.add("hidden");
    });
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
      const [sidebarHtml, topbarHtml, mobileTopHtml, mobileNavHtml, footerHtml] = await Promise.all([
        fetchComponent("sidebar"),
        fetchComponent("topbar"),
        fetchComponent("mobile_top_header"),
        fetchComponent("mobile_nav"),
        fetchComponent("footer"),
      ]);

      const sidebarSlot = document.getElementById("sidebar-slot");
      const topbarSlot = document.getElementById("topbar-slot");
      const mobileTopSlot = document.getElementById("mobile-top-header-slot");
      const mobileNavSlot = document.getElementById("mobile-nav-slot");
      const footerSlot = document.getElementById("footer-slot");

      if (sidebarSlot) sidebarSlot.outerHTML = sidebarHtml;
      if (topbarSlot) topbarSlot.outerHTML = topbarHtml;
      if (mobileTopSlot) mobileTopSlot.outerHTML = mobileTopHtml;
      if (mobileNavSlot) mobileNavSlot.outerHTML = mobileNavHtml;
      if (footerSlot) footerSlot.outerHTML = footerHtml;

      const yearEl = document.getElementById("footerYear");
      if (yearEl) yearEl.textContent = new Date().getFullYear();

      if (opts && opts.title) {
        const titleEl = document.getElementById("pageTitle");
        if (titleEl) titleEl.textContent = opts.title;
        document.title = `${opts.title} | OYA`;
      }
      if (opts && opts.page) setActiveNav(opts.page);

      buildMobileSidebarNav();
      wireTheme();
      wireMobileSidebar();
      wireDesktopSidebarToggle();
      wireDropdowns();
      wireLogout();
      wireGlobalSearch();

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
      updateNotificationBadge();
      setInterval(updateNotificationBadge, 60000);

      return user;
    },
  };

  window.OYA_SHELL = OYA_SHELL;
})();
