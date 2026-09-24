function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function fmtDateTime(iso) {
      if (!iso) return null;
      const dt = new Date(iso);
      if (isNaN(dt)) return null;
      return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    }
    const userId = new URLSearchParams(window.location.search).get("id");

    function roleBadgeClass(role) {
      if (role === "ADMIN") return "badge-danger";
      if (role === "EXECUTIVE") return "badge-primary";
      if (role === "FLOOR_MEMBER") return "badge-success";
      return "badge-secondary";
    }

    function metaField(label, value) {
      return `<div>
        <div style="font-size:0.75rem;color:var(--oya-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">${esc(label)}</div>
        <div style="font-weight:600;color:var(--oya-text-primary);">${value}</div>
      </div>`;
    }

    function render(u, viewerId, canEdit, canDelete) {
      const initials = (u.full_name || u.serial_number || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      const isSelf = String(u.id) === String(viewerId);
      const showEdit = canEdit && !isSelf;
      const showDelete = canDelete && !isSelf;

      return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 style="font-size:clamp(1.125rem,3vw,1.5rem);">${esc(u.full_name || "No Name")}</h1>
          <p style="font-size:0.875rem;">${esc(u.serial_number)} &middot; ${esc(u.member_position || u.display_role || "Member")}</p>
        </div>
        <div class="page-header-actions">
          ${showEdit ? `<a href="user-form.html?id=${u.id}" class="btn btn-primary"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit User</a>` : ""}
        </div>
      </div>

      <div class="user-detail-grid" style="display:grid;grid-template-columns:1fr;gap:1.5rem;">
        <div class="card" style="height:fit-content;">
          <div class="card-body" style="text-align:center;padding:2rem;">
            ${u.photo_url
              ? `<img src="${esc(u.photo_url)}" alt="${esc(u.full_name)}" class="avatar" style="width:clamp(72px,20vw,100px);height:clamp(72px,20vw,100px);margin:0 auto 1rem;object-fit:cover;">`
              : `<div class="avatar" style="width:clamp(72px,20vw,100px);height:clamp(72px,20vw,100px);margin:0 auto 1rem;font-size:clamp(1.5rem,5vw,2rem);background:var(--oya-primary);color:#fff;">${esc(initials)}</div>`}
            <h2 style="font-size:clamp(1rem,3vw,1.25rem);margin-bottom:0.25rem;">${esc(u.full_name || "No Name")}</h2>
            <p style="color:var(--oya-text-muted);margin-bottom:1rem;">${esc(u.serial_number)}</p>
            <span class="badge ${roleBadgeClass(u.role)}" style="margin-bottom:0.5rem;display:inline-block;">${esc(u.display_role)}</span><br>
            <span class="badge ${u.is_active === false ? "badge-danger" : "badge-success"}">${u.is_active === false ? "Inactive" : "Active"}</span>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:1.5rem;">
            <div class="card-header"><div><div class="card-header-title">Account Information</div><div class="card-header-subtitle">User account details and metadata</div></div></div>
            <div class="card-body">
              <div class="detail-meta-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:1rem;">
                ${metaField("Full Name", esc(u.full_name || "\u2014"))}
                ${metaField("Serial Number", esc(u.serial_number))}
                ${metaField("Phone", esc(u.phone || "\u2014"))}
                ${metaField("State", esc(u.state || "\u2014"))}
                ${metaField("Role", esc(u.display_role))}
                ${metaField("Status", `<span class="badge ${u.is_active === false ? "badge-danger" : "badge-success"}">${u.is_active === false ? "Inactive" : "Active"}</span>`)}
                ${metaField("Date Joined", esc(fmtDateTime(u.date_joined) || "\u2014"))}
                ${metaField("Last Login", esc(fmtDateTime(u.last_login) || "Never"))}
              </div>
            </div>
          </div>

          ${(showEdit || showDelete) ? `
          <div class="card">
            <div class="card-header"><div><div class="card-header-title">Admin Actions</div><div class="card-header-subtitle">Manage this user account</div></div></div>
            <div class="card-body">
              <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;">
                ${showEdit ? `<a href="user-form.html?id=${u.id}" class="btn btn-primary"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit User</a>` : ""}
                ${showDelete ? `<button type="button" class="btn btn-danger" id="deleteUserBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete User</button>` : ""}
              </div>
            </div>
          </div>` : ""}
        </div>
      </div>`;
    }

    (async function () {
      const viewer = await window.OYA_SHELL.init({ page: "users", title: "User Detail" });
      if (!viewer) return;
      try {
        const { user: u } = await window.OYA_API.apiFetch(`/accounts/api/users/${userId}/`);
        const canEdit = !!viewer.has_executive_access;
        const canDelete = !!viewer.has_admin_access;
        document.getElementById("detailContent").innerHTML = render(u, viewer.id, canEdit, canDelete);
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("detailContent").style.display = "";

        const deleteBtn = document.getElementById("deleteUserBtn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async () => {
            if (!await window.OYA.confirmAction({ title: "Delete user?", message: `Delete user ${u.serial_number}? This cannot be undone.`, confirmText: "Delete user" })) return;
            try {
              await window.OYA_API.apiFetch(`/accounts/api/users/${u.id}/delete/`, { method: "POST" });
              window.OYA.showToast("User deleted.", "success");
              window.location.href = "users.html";
            } catch (err) {
              window.OYA.showToast(err.message || "Couldn't delete user.", "error");
            }
          });
        }
      } catch (err) {
        document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">Couldn't load user: ${esc(err.message)}</div>`;
      }
    })();
