function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const state = { search: "", year: "", page: 1 };
    let yearsBuilt = false;

    function renderRow(d) {
      return `<tr>
        <td><span class="cell-name">${esc(d.member.full_name)}</span><div class="cell-muted">${esc(d.member.serial_number)}</div></td>
        <td>${naira(d.total_due)}</td>
        <td>${naira(d.total_paid)}</td>
        <td style="font-weight:700;color:var(--oya-danger);">${naira(d.debt)}</td>
        <td>${d.years_missed}</td>
        <td class="cell-muted">${d.last_payment_date ? esc(d.last_payment_date) : "Never"}</td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}-${p.end_index} of ${p.count}`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.year) qs.set("year", state.year);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/dues/debtors/?${qs.toString()}`);
        if (!yearsBuilt) {
          yearsBuilt = true;
          const sel = document.getElementById("yearFilter");
          data.years.slice().reverse().forEach((y) => { const o = document.createElement("option"); o.value = y; o.textContent = y; sel.appendChild(o); });
        }
        document.getElementById("kpiOutstanding").textContent = naira(data.stats.total_outstanding);
        document.getElementById("kpiMembers").textContent = data.stats.total_members;
        tbody.innerHTML = data.debtors.length ? data.debtors.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No debtors found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Dues Debtors" });
      if (!user) return;

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("yearFilter").addEventListener("change", (e) => { state.year = e.target.value; state.page = 1; load(); });

      load();
    })();
