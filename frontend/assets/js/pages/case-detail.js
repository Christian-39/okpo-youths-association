function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" }) : "—"; }
    function statusBadge(s) {
      if (s === "OPEN") return `<span class="badge badge-danger">Open</span>`;
      if (s === "IN_PROGRESS") return `<span class="badge badge-warning">In Progress</span>`;
      if (s === "RESOLVED") return `<span class="badge badge-success">Resolved</span>`;
      return "";
    }
    const id = new URLSearchParams(window.location.search).get("id");

    function render(c, isExecutive) {
      return `
      <div class="detail-header" style="flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
            <h1 style="font-size:clamp(1.125rem,3vw,1.5rem);">${esc(c.title)}</h1>
            ${statusBadge(c.status)}
          </div>
          <p style="font-size:0.875rem;color:var(--oya-text-muted);">${esc(c.case_number)}</p>
        </div>
        ${isExecutive && c.status !== "RESOLVED" ? `<div class="page-header-actions" style="flex-wrap:wrap;gap:0.5rem;">
          <a href="case-form.html?id=${c.id}" class="btn btn-secondary">Edit</a>
          <a href="case-resolve.html?id=${c.id}" class="btn btn-primary">Resolve Case</a>
        </div>` : isExecutive ? `<div class="page-header-actions"><a href="case-form.html?id=${c.id}" class="btn btn-secondary">Edit</a></div>` : ""}
      </div>

      <div class="dashboard-grid dashboard-grid-2">
        <div class="card">
          <div class="card-header"><div class="card-header-title">Case Information</div></div>
          <div class="card-body">
            <div class="detail-meta-grid">
              <div class="meta-item"><span class="meta-label">Respondent</span><span class="meta-value">${c.respondent ? esc(c.respondent.full_name) : "—"}</span></div>
              <div class="meta-item"><span class="meta-label">Fine Amount</span><span class="meta-value">${c.fine_amount > 0 ? naira(c.fine_amount) : "None"}</span></div>
              <div class="meta-item"><span class="meta-label">Reported To</span><span class="meta-value">${c.reported_to ? esc(c.reported_to.name) : "—"}</span></div>
              <div class="meta-item"><span class="meta-label">Filed By</span><span class="meta-value">${esc(c.created_by || "—")}</span></div>
              <div class="meta-item"><span class="meta-label">Filed On</span><span class="meta-value">${fmtDate(c.created_at)}</span></div>
              <div class="meta-item" style="grid-column:1 / -1;"><span class="meta-label">Description</span><span class="meta-value" style="font-weight:400;">${esc(c.description || "—")}</span></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-header-title">Resolution</div></div>
          <div class="card-body">
            ${c.status === "RESOLVED" ? `
            <div class="detail-meta-grid">
              <div class="meta-item"><span class="meta-label">Resolved By</span><span class="meta-value">${c.resolved_by ? esc(c.resolved_by.name) : "—"}</span></div>
              <div class="meta-item"><span class="meta-label">Resolved Date</span><span class="meta-value">${fmtDate(c.resolved_date)}</span></div>
              <div class="meta-item" style="grid-column:1 / -1;"><span class="meta-label">Resolution Notes</span><span class="meta-value" style="font-weight:400;">${esc(c.resolution_notes || "—")}</span></div>
            </div>` : `<p style="color:var(--oya-text-muted);">This case has not been resolved yet.</p>`}
          </div>
        </div>
      </div>`;
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "cases", title: "Case Details" });
      if (!user) return;
      if (!id) { document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">No case specified.</div>`; return; }
      try {
        const { case: c } = await window.OYA_API.apiFetch(`/operations/api/cases/${id}/`);
        document.getElementById("detailContent").innerHTML = render(c, !!user.has_executive_access);
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("detailContent").style.display = "";
      } catch (err) {
        document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">Couldn't load: ${esc(err.message)}</div>`;
      }
    })();
