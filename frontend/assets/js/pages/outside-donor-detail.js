function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const id = new URLSearchParams(window.location.search).get("id");

    function render(data, isExecutive) {
      const d = data.donor;
      return `
      <div class="detail-header" style="flex-wrap:wrap;gap:1rem;">
        <div class="detail-title-section" style="flex-wrap:wrap;gap:1rem;">
          <div class="detail-avatar" style="background:var(--oya-primary);color:#fff;overflow:hidden;">
            ${d.profile_picture_url ? `<img src="${esc(d.profile_picture_url)}" style="width:100%;height:100%;object-fit:cover;">` : esc((d.full_name || "").slice(0, 2).toUpperCase())}
          </div>
          <div>
            <h1 style="font-size:clamp(1.125rem,3vw,1.5rem);">${esc(d.full_name)}</h1>
            <p style="font-size:0.875rem;color:var(--oya-text-muted);">${esc(d.occupation || "")} ${d.invited_by ? "&middot; Invited by " + esc(d.invited_by.full_name) : ""}</p>
          </div>
        </div>
        ${isExecutive ? `<div class="page-header-actions"><a href="outside-donor-form.html?id=${d.id}" class="btn btn-secondary">Edit</a></div>` : ""}
      </div>

      <div class="dashboard-grid dashboard-grid-3" style="margin-bottom:1.5rem;">
        <div class="kpi-card accent-success"><div class="kpi-value" style="color:var(--oya-success);">${naira(d.total_donations)}</div><div class="kpi-label">Total Donated</div></div>
        <div class="kpi-card"><div class="kpi-value">${d.donation_count}</div><div class="kpi-label">Donations</div></div>
        <div class="kpi-card accent-info"><div class="kpi-value" style="color:var(--oya-info);">${d.projects_supported}</div><div class="kpi-label">Projects Supported</div></div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <div class="card-header"><div class="card-header-title">Contact Information</div></div>
        <div class="card-body">
          <div class="detail-meta-grid">
            <div class="meta-item"><span class="meta-label">Phone</span><span class="meta-value">${esc(d.phone_number || "—")}</span></div>
            <div class="meta-item"><span class="meta-label">Gender</span><span class="meta-value">${esc(d.gender || "—")}</span></div>
            <div class="meta-item" style="grid-column:1 / -1;"><span class="meta-label">Address</span><span class="meta-value" style="font-weight:400;">${esc(d.address || "—")}</span></div>
            ${d.notes ? `<div class="meta-item" style="grid-column:1 / -1;"><span class="meta-label">Notes</span><span class="meta-value" style="font-weight:400;">${esc(d.notes)}</span></div>` : ""}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-header-title">Donation History</div></div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Project</th><th>Type</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${data.donations.length ? data.donations.map((don) => `
              <tr>
                <td>${don.project ? esc(don.project.title) : "—"}</td>
                <td>${esc(don.donation_type_display)}</td>
                <td>${esc(don.display_value)}</td>
                <td><span class="badge ${don.status === "CONFIRMED" ? "badge-success" : don.status === "PLEDGE" ? "badge-warning" : "badge-secondary"}">${esc(don.status_display)}</span></td>
                <td class="cell-muted">${esc((don.donation_date || ""))}</td>
              </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No donations recorded yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "outside-donors", title: "Donor Profile" });
      if (!user) return;
      if (!id) { document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">No donor specified.</div>`; return; }
      try {
        const data = await window.OYA_API.apiFetch(`/project-donations/api/outside-donors/${id}/`);
        document.getElementById("detailContent").innerHTML = render(data, !!user.has_executive_access);
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("detailContent").style.display = "";
      } catch (err) {
        document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">Couldn't load: ${esc(err.message)}</div>`;
      }
    })();
