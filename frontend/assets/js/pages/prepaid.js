function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Prepaid Dues" });
      if (!user) return;
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch("/finance/api/dues/prepaid/");
        document.getElementById("kpiTotal").textContent = naira(data.total_prepaid_amount);
        document.getElementById("kpiMembers").textContent = data.prepaid_members_count;
        tbody.innerHTML = data.prepaid_records.length ? data.prepaid_records.map((r) => `
          <tr>
            <td><a href="prepaid-detail.html?id=${r.member.id}" class="cell-name" style="text-decoration:none;">${esc(r.member.full_name)}</a><div class="cell-muted">${esc(r.member.serial_number)}</div></td>
            <td>${r.years.join(", ")}</td>
            <td style="font-weight:600;color:var(--oya-success);">${naira(r.total_amount)}</td>
            <td class="cell-muted">${esc(r.recorded_by || "—")}</td>
            <td><a href="prepaid-detail.html?id=${r.member.id}" class="table-action-btn" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a></td>
          </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No prepaid dues records.</td></tr>`;
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    })();
