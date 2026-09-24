function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const id = new URLSearchParams(window.location.search).get("id");

    function statusBadge(status, amountPaid, yearlyDues) {
      if (status === "N/A") return `<span class="badge badge-secondary">N/A</span>`;
      if (Number(amountPaid) >= Number(yearlyDues)) return `<span class="badge badge-success">Paid</span>`;
      if (Number(amountPaid) > 0) return `<span class="badge badge-warning">Partial</span>`;
      return `<span class="badge badge-danger">Owed</span>`;
    }

    function render(data) {
      const m = data.member, d = data.debt_info;
      return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 style="font-size:clamp(1.125rem,3vw,1.5rem);">${esc(m.full_name)}</h1>
          <p style="font-size:0.875rem;color:var(--oya-text-muted);">${esc(m.serial_number)} &middot; Joined ${data.join_year}</p>
        </div>
        <div class="page-header-actions"><a href="dues-allocate.html" class="btn btn-primary">Record Payment</a></div>
      </div>

      <div class="dashboard-grid dashboard-grid-3" style="margin-bottom:1.5rem;">
        <div class="kpi-card accent-danger"><div class="kpi-value" style="color:var(--oya-danger);">${naira(d.debt_owed)}</div><div class="kpi-label">Total Debt Owed</div></div>
        <div class="kpi-card accent-success"><div class="kpi-value" style="color:var(--oya-success);">${(d.years_paid || []).length}</div><div class="kpi-label">Years Paid</div></div>
        <div class="kpi-card">${data.year_status.length}<div class="kpi-label">Years Tracked</div></div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <div class="card-header"><div class="card-header-title">Dues by Year</div></div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Year</th><th>Status</th><th>Amount Paid</th></tr></thead>
            <tbody>
              ${data.year_status.map((y) => `
              <tr>
                <td>${y.year}${y.is_future ? " (future)" : ""}</td>
                <td>${statusBadge(y.status, y.amount_paid, data.yearly_dues)}</td>
                <td>${y.amount_paid != null ? naira(y.amount_paid) : "—"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-header-title">Recent Payment Transactions</div></div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded By</th></tr></thead>
            <tbody>
              ${data.transactions.length ? data.transactions.map((t) => `
              <tr>
                <td class="cell-muted">${esc(t.payment_date)}</td>
                <td style="font-weight:600;">${naira(t.total_amount)}</td>
                <td>${esc(t.payment_method || "—")}</td>
                <td class="cell-muted">${esc(t.receipt_reference || "—")}</td>
                <td class="cell-muted">${esc(t.recorded_by || "—")}</td>
              </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No payment transactions yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Member Dues" });
      if (!user) return;
      if (!id) { document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">No member specified.</div>`; return; }
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/dues/members/${id}/`);
        document.getElementById("detailContent").innerHTML = render(data);
        document.getElementById("loadingState").style.display = "none";
        document.getElementById("detailContent").style.display = "";
      } catch (err) {
        document.getElementById("loadingState").innerHTML = `<div class="alert alert-danger">Couldn't load: ${esc(err.message)}</div>`;
      }
    })();
