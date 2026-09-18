/** OYA login page module. */
(function () {
  "use strict";

  function escapeText(value) {
    const node = document.createElement("span");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  }

  function showAlert(message, type) {
    const container = document.getElementById("alertContainer");
    if (!container) return;
    const div = document.createElement("div");
    div.className = `alert alert-${type === "error" ? "danger" : type}`;
    div.setAttribute("role", "status");
    div.innerHTML = `<span>${escapeText(message)}</span><button type="button" class="alert-close" aria-label="Dismiss message">&times;</button>`;
    div.querySelector("button").addEventListener("click", () => div.remove());
    container.appendChild(div);
    window.setTimeout(() => {
      div.style.opacity = "0";
      window.setTimeout(() => div.remove(), 300);
    }, 5000);
  }

  function showFieldErrors(errors) {
    const box = document.getElementById("formErrors");
    if (!box) return;
    box.replaceChildren();
    (Array.isArray(errors) ? errors : [errors]).filter(Boolean).forEach((message) => {
      const div = document.createElement("div");
      div.className = "form-error";
      div.setAttribute("role", "alert");
      div.innerHTML = `<svg class="alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span></span><button type="button" class="alert-close" aria-label="Dismiss error">&times;</button>`;
      div.querySelector("span").textContent = String(message);
      div.querySelector("button").addEventListener("click", () => div.remove());
      box.appendChild(div);
    });
    box.style.display = errors && errors.length ? "flex" : "none";
  }

  function restoreButton(button) {
    button.disabled = false;
    button.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In`;
  }

  async function init() {
    const dashboardRoute = (window.OYA_CONFIG.ROUTES && window.OYA_CONFIG.ROUTES.dashboard) || "dashboard.html";
    try {
      const existing = await window.OYA_AUTH.getCurrentUser({ redirect: false });
      if (existing) {
        window.location.assign(dashboardRoute);
        return;
      }
    } catch (_) {
      // A 401 is the expected result for a guest on the login page.
    }
    window.OYA_API.fetchCsrfToken().catch(() => {});

    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("loginBtn");
      const serial = document.getElementById("serial_number").value.trim();
      const pin = document.getElementById("pin").value.trim();
      showFieldErrors([]);
      if (!serial || !/^\d{6}$/.test(pin)) {
        showFieldErrors(["Enter your membership serial number and a 6-digit PIN."]);
        return;
      }
      button.disabled = true;
      button.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" class="spin" aria-hidden="true"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Signing in…`;
      try {
        const user = await window.OYA_AUTH.login(serial, pin);
        showAlert(`Welcome, ${user.full_name || serial}!`, "success");
        window.setTimeout(() => window.location.assign(dashboardRoute), 500);
      } catch (error) {
        const errors = error && error.data && error.data.errors;
        const messages = Array.isArray(errors) ? errors : [error.message || "Invalid serial number or PIN."];
        showFieldErrors(messages);
        restoreButton(button);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
