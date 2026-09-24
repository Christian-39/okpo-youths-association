function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    const state = { search: "", role: "", page: 1 };
    let isAdmin = false, isExecutive = false, choicesBuilt = false;

    function roleBadge(u) {
      if (u.role === "ADMIN") return `<span class="badge badge-danger">Admin</span>`;
      if (u.role === "EXECUTIVE") return `<span class="badge badge-primary">${esc(u.display_role)}</span>`;
      return `<span class="badge badge-secondary">Floor Member</span>`;
    }

    function renderRow(u) {
      return `<tr>
        <td class="cell-muted">${esc(u.serial_number)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            ${u.photo_url ? `<img src="${esc(u.photo_url)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div class="avatar" style="width:28px;height:28px;font-size:0.6875rem;">${esc((u.full_name||"?").trim().split(/\s+/).map(p=>p[0]).slice(0,2).join("").toUpperCase())}</div>`}
            <span class="cell-name">${esc(u.full_name)}</span>
          </div>
        </td>
        <td class="cell-muted">${esc(u.phone || "\u2014")}</td>
        <td class="cell-muted">${esc(u.state || "\u2014")}</td>
        <td>${roleBadge(u)}</td>
        <td>${u.is_active === false ? '<span class="badge badge-secondary">Inactive</span>' : '<span class="badge badge-success">Active</span>'}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="user-detail.html?id=${u.id}" class="table-action-btn" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a>
            ${(isExecutive || isAdmin) ? `<a href="user-form.html?id=${u.id}" class="table-action-btn" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></a>` : ""}
            ${isAdmin ? `<button type="button" class="table-action-btn danger js-delete" data-id="${u.id}" data-serial="${esc(u.serial_number)}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ""}
          </div>
        </td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Page ${p.page} of ${p.num_pages} \u00b7 ${p.count} users`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.role) qs.set("role", state.role);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/accounts/api/users/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("roleFilter");
          data.role_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        tbody.innerHTML = data.results.length ? data.results.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No users found.</td></tr>`;
        renderPagination(data);
        document.querySelectorAll(".js-delete").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!await window.OYA.confirmAction({ title: "Delete user?", message: `Delete user ${btn.dataset.serial}? This cannot be undone.`, confirmText: "Delete user" })) return;
            try {
              await window.OYA_API.apiFetch(`/accounts/api/users/${btn.dataset.id}/delete/`, { method: "POST" });
              window.OYA.showToast("User deleted.", "success");
              load();
            } catch (err) {
              window.OYA.showToast(err.message || "Couldn't delete user.", "error");
            }
          });
        });
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    function showPinErrors(errors) {
      const box = document.getElementById("pinFormErrors");
      const lines = Array.isArray(errors) ? errors : [String(errors)];
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "users", title: "Users" });
      if (!user) return;
      isAdmin = !!user.has_admin_access;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addBtn").style.display = "";
      if (isAdmin) document.getElementById("pinResetBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("roleFilter").addEventListener("change", (e) => { state.role = e.target.value; state.page = 1; load(); });

      document.getElementById("pinResetBtn").addEventListener("click", () => { document.getElementById("pinModalOverlay").style.display = "flex"; });
      document.getElementById("closePinModalBtn").addEventListener("click", () => { document.getElementById("pinModalOverlay").style.display = "none"; });
      document.getElementById("pinModalOverlay").addEventListener("click", (e) => { if (e.target.id === "pinModalOverlay") e.currentTarget.style.display = "none"; });

      document.getElementById("pinResetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("pinResetSubmit");
        btn.disabled = true;
        showPinErrors([]);
        try {
          const formData = new FormData(e.target);
          const res = await window.OYA_API.apiFetch("/accounts/api/users/pin-reset/", { method: "POST", body: formData });
          window.OYA.showToast(res.detail || "PIN reset.", "success");
          document.getElementById("pinModalOverlay").style.display = "none";
          e.target.reset();
        } catch (err) {
          showPinErrors((err.data && err.data.errors) || [err.message || "Something went wrong."]);
        } finally {
          btn.disabled = false;
        }
      });

      load();
    })();
