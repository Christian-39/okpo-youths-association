function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function fmtDt(iso) { return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
    function statusBadge(s) {
      if (s === "UPCOMING") return `<span class="badge badge-info">Upcoming</span>`;
      if (s === "ONGOING") return `<span class="badge badge-success">Ongoing</span>`;
      if (s === "COMPLETED") return `<span class="badge badge-secondary">Completed</span>`;
      if (s === "CANCELLED") return `<span class="badge badge-danger">Cancelled</span>`;
      return "";
    }

    const state = { search: "", status: "", page: 1 };
    let choicesBuilt = false;

    function renderRow(e) {
      return `<tr>
        <td><span class="cell-name">${esc(e.title)}</span></td>
        <td>${statusBadge(e.status)}</td>
        <td class="cell-muted">${fmtDt(e.start_date)}</td>
        <td class="cell-muted">${fmtDt(e.end_date)}</td>
        <td><span class="badge badge-info">${e.candidate_count}</span></td>
        <td><a href="election-detail.html?id=${e.id}" class="table-action-btn" title="View">
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
      for (let n = 1; n <= p.num_pages; n++) {
        html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      }
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
        const data = await window.OYA_API.apiFetch(`/elections/api/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("statusFilter");
          data.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        tbody.innerHTML = data.elections.length ? data.elections.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No elections found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "elections", title: "Elections" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });

      load();
    })();
