/**
 * OYA Frontend — Login page module (ES module)
 * Loaded via <script type="module" src="js/accounts/login.js"></script>
 * Behavior ported 1:1 from login.html's previous inline <script> —
 * only the import source changed (Auth from js/core/auth.js instead
 * of window.OYA_AUTH from assets/js/auth.js).
 */
import { Auth } from "../core/auth.js";

function showAlert(message, type) {
  const container = document.getElementById("alertContainer");
  const div = document.createElement("div");
  div.className = `alert alert-${type === "error" ? "danger" : type}`;
  div.setAttribute("role", "alert");
  div.innerHTML = `${message}<button type="button" class="alert-close" onclick="this.parentElement.remove()">&times;</button>`;
  container.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, 5000);
}

function showFieldErrors(errors) {
  const box = document.getElementById("formErrors");
  box.innerHTML = "";
  box.style.display = "flex";
  (errors || []).forEach((msg) => {
    const div = document.createElement("div");
    div.className = "form-error";
    div.setAttribute("role", "alert");
    div.innerHTML = `<svg class="alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${msg}<button type="button" class="alert-close" onclick="this.parentElement.remove()">&times;</button>`;
    box.appendChild(div);
  });
}

const dashboardRoute =
  (window.OYA_CONFIG && window.OYA_CONFIG.ROUTES && window.OYA_CONFIG.ROUTES.dashboard) ||
  "dashboard.html";

(async function init() {
  // If already logged in, go to dashboard.
  const existing = await Auth.check();
  if (existing) {
    window.location.href = dashboardRoute;
    return;
  }
  // Pre-warm the CSRF cookie so the first login POST is fast.
  await Auth.ensureCsrfCookie();
})();

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  const serial = document.getElementById("serial_number").value.trim();
  const pin = document.getElementById("pin").value.trim();

  // Clear old errors
  document.getElementById("formErrors").innerHTML = "";
  document.getElementById("formErrors").style.display = "none";

  btn.disabled = true;
  btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Signing in…`;

  try {
    const data = await Auth.login(serial, pin);
    showAlert(`Welcome, ${data.full_name || serial}!`, "success");
    setTimeout(() => {
      window.location.href = dashboardRoute;
    }, 600);
  } catch (err) {
    console.error("Login failed:", err);
    const msg =
      (err.data && err.data.detail) ||
      (err.data && err.data.error) ||
      err.message ||
      "Invalid serial number or PIN.";
    showFieldErrors([msg]);
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In`;
  }
});
