function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function statusBadge(s) {
      if (s === "OPEN") return `<span class="badge badge-danger">Open</span>`;
      if (s === "IN_PROGRESS") return `<span class="badge badge-warning">In Progress</span>`;
      if (s === "RESOLVED") return `<span class="badge badge-success">Resolved</span>`;
      return "";
    }
    const state = { search: "", status: "", page: 1 };
    let choicesBuilt = false;

    function renderRow(c) {
      return `<tr>
        <td class="cell-muted">${esc(c.case_number)}</td>
        <td><span class="cell-name">${esc(c.title)}</span></td>
        <td>${c.respondent ? esc(c.respondent.full_name) : "—"}</td>
        <td>${c.fine_amount > 0 ? naira(c.fine_amount) : "—"}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="cell-muted">${esc((c.created_at || "").slice(0, 10))}</td>
        <td><a href="case-detail.html?id=${c.id}" class="table-action-btn" title="View">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </a></td>
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
      if (state.status) qs.set("status", state.status);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/operations/api/cases/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("statusFilter");
          data.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiOpen").textContent = data.stats.open;
        document.getElementById("kpiProgress").textContent = data.stats.in_progress;
        document.getElementById("kpiResolved").textContent = data.stats.resolved;
        tbody.innerHTML = data.cases.length ? data.cases.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No cases found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "cases", title: "Case Files" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });

      load();
    })();
