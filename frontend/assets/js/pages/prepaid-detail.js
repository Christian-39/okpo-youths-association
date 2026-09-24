function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const id = new URLSearchParams(window.location.search).get("id");

    function render(data) {
      return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 style="font-size:clamp(1.125rem,3vw,1.5rem);">${esc(data.member.full_name)}</h1>
          <p style="font-size:0.875rem;color:var(--oya-text-muted);">${esc(data.member.serial_number)}</p>
        </div>
      </div>
      <div class="dashboard-grid dashboard-grid-2" style="margin-bottom:1.5rem;">
        <div class="kpi-card accent-success"><div class="kpi-value" style="color:var(--oya-success);">${naira(data.total_prepaid)}</div><div class="kpi-label">Total Prepaid</div></div>
        <div class="kpi-card ${data.debt_info.debt_owed > 0 ? "accent-danger" : "accent-success"}"><div class="kpi-value" style="color:${data.debt_info.debt_owed > 0 ? "var(--oya-danger)" : "var(--oya-success)"};">${naira(data.debt_info.debt_owed)}</div><div class="kpi-label">Current Debt (other years)</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-header-title">Prepaid Records</div></div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Year</th><th>Amount</th><th>Recorded By</th><th>Date</th></tr></thead>
            <tbody>
              ${data.prepaid_records.length ? data.prepaid_records.map((r) => `
              <tr><td>${r.year}</td><td style="font-weight:600;">${naira(r.amount_paid)}</td><td class="cell-muted">${esc(r.recorded_by || "—")}</td><td class="cell-muted">${esc((r.created_at || "").slice(0, 10))}</td></tr>`).join("")
              : `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No prepaid records.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Prepaid Dues Detail" });
      if (!user) return;
      if (!id) { document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">No member specified.</div>`; return; }
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/dues/prepaid/${id}/`);
        document.getElementById("detailContent").innerHTML = render(data);
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("detailContent").style.display = "";
      } catch (err) {
        document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">Couldn't load: ${esc(err.message)}</div>`;
      }
    })();
