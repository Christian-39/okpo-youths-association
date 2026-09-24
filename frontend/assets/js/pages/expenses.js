function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    const state = { search: "", category: "", page: 1 };
    let choicesBuilt = false;

    function renderRow(e) {
      return `<tr>
        <td><span class="badge">${esc(e.category_display)}</span></td>
        <td>${esc(e.description)}</td>
        <td style="font-weight:600;color:var(--oya-danger);">${naira(e.amount)}</td>
        <td class="cell-muted">${esc(e.created_by || "—")}</td>
        <td class="cell-muted">${esc((e.created_at || "").slice(0, 10))}</td>
        <td>${e.receipt_url ? `<a href="${esc(e.receipt_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost">View</a>` : "—"}</td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}-${p.end_index} of ${p.count}`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) {
        html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      }
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.category) qs.set("category", state.category);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/expenses/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("categoryFilter");
          data.category_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        document.getElementById("kpiTreasury").textContent = naira(data.treasury_balance);
        document.getElementById("kpiTotalExpenses").textContent = naira(data.total_expenses);
        document.getElementById("kpiMonthExpenses").textContent = naira(data.this_month_expenses);
        document.getElementById("kpiTotalIncome").textContent = naira(data.total_income);
        tbody.innerHTML = data.expenses.length ? data.expenses.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No expenses found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "expenses", title: "Expenses" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350);
      });
      document.getElementById("categoryFilter").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; load(); });

      load();
    })();
