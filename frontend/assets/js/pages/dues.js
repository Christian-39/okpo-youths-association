function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    function cellClass(status, amountPaid, yearlyDues) {
      if (status === "N/A") return "na";
      if (status === "OWED") return "owed";
      if (Number(amountPaid) >= Number(yearlyDues)) return "paid";
      if (Number(amountPaid) > 0) return "partial";
      return "owed";
    }
    function cellLabel(status, amountPaid, yearlyDues) {
      if (status === "N/A") return "—";
      if (Number(amountPaid) >= Number(yearlyDues)) return "\u2713";
      if (Number(amountPaid) > 0) return "~";
      return "\u2717";
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Dues Tracker" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      try {
        const data = await window.OYA_API.apiFetch("/finance/api/dues/tracker/");
        document.getElementById("kpiCollected").textContent = naira(data.total_dues_collected);
        document.getElementById("kpiExpected").textContent = naira(data.total_dues_expected);
        document.getElementById("kpiRate").textContent = `${data.collection_rate}%`;
        document.getElementById("kpiThisYear").textContent = `${data.this_year_paid}/${data.this_year_expected}`;
        document.getElementById("kpiThisYearLabel").textContent = `${data.current_year} Paid`;

        const theadRow = document.getElementById("theadRow");
        data.years.forEach((y) => { const th = document.createElement("th"); th.textContent = y; theadRow.appendChild(th); });
        theadRow.insertAdjacentHTML("beforeend", `<th>Debt</th>`);

        const tbody = document.getElementById("tbody");
        if (!data.member_rows.length) {
          tbody.innerHTML = `<tr><td colspan="${data.years.length + 2}" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No members found.</td></tr>`;
        } else {
          tbody.innerHTML = data.member_rows.map((row) => {
            const cells = data.years.map((y) => {
              const cell = row.years[y] || row.years[String(y)];
              const cls = cellClass(cell.status, cell.amount_paid, data.yearly_dues);
              const label = cellLabel(cell.status, cell.amount_paid, data.yearly_dues);
              return `<td><span class="dues-cell ${cls}" title="${y}: ${naira(cell.amount_paid)}">${label}</span></td>`;
            }).join("");
            return `<tr>
              <td><a href="member-dues-detail.html?id=${row.member.id}" class="cell-name" style="text-decoration:none;">${esc(row.member.full_name)}</a><div class="cell-muted">${esc(row.member.serial_number)}</div></td>
              ${cells}
              <td style="font-weight:600;color:${row.total_debt > 0 ? "var(--oya-danger)" : "var(--oya-success)"};">${naira(row.total_debt)}</td>
            </tr>`;
          }).join("");
        }
      } catch (err) {
        document.getElementById("tbody").innerHTML = `<tr><td style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    })();
