function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const state = { search: "", page: 1 };

    function renderRow(h) {
      const tenure = h.tenure_start ? `${h.tenure_start} \u2192 ${h.tenure_end || "Present"}` : "\u2014";
      const totalRevenue = (Number(h.total_income) || 0) + (Number(h.total_dues) || 0) + (Number(h.total_donations) || 0) + (Number(h.taskforce_revenue) || 0);
      return `<tr>
        <td><span class="cell-name">${h.executive ? esc(h.executive.full_name) : "\u2014"}</span></td>
        <td class="cell-muted">${h.executive ? esc(h.executive.post) : "\u2014"}</td>
        <td class="cell-muted">${h.election ? esc(h.election.title) : "Founding"}</td>
        <td class="cell-muted">${esc(tenure)}</td>
        <td style="font-weight:600;color:var(--oya-success);">${naira(h.cash_remaining)}</td>
        <td style="font-weight:600;">${naira(totalRevenue)}</td>
        <td>
          <a class="table-action-btn" href="handover-detail.html?id=${h.id}" title="View handover" aria-label="View handover">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Page ${p.page} of ${p.num_pages} \u00b7 ${p.count} handovers`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/elections/api/handovers/list/?${qs.toString()}`);
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiCash").textContent = naira(data.stats.total_cash_remaining);
        document.getElementById("kpiRevenue").textContent = naira(data.stats.total_revenue);
        tbody.innerHTML = data.results.length ? data.results.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No handover records yet.</td></tr>`;
        renderPagination(data);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "handover", title: "Handover Ledger" });
      if (!user) return;

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });

      load();
    })();
