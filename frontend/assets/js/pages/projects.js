function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    const state = { search: "", status: "", page: 1 };
    let isExecutive = false, choicesBuilt = false;

    function statusBadge(s) {
      if (s === "FUTURE") return `<span class="badge badge-info">Planned</span>`;
      if (s === "AT_HAND") return `<span class="badge badge-warning">In Progress</span>`;
      if (s === "FINISHED") return `<span class="badge badge-success">Completed</span>`;
      return "";
    }

    function renderRow(p) {
      const fillClass = p.progress_percentage === 100 ? "success" : p.progress_percentage >= 50 ? "warning" : "";
      return `<tr>
        <td>
          <span class="cell-name">${esc(p.title)}</span>
          ${p.description ? `<div class="cell-muted">${esc(p.description.slice(0, 60))}</div>` : ""}
        </td>
        <td>${statusBadge(p.status)}</td>
        <td style="font-weight:600;">${naira(p.budget)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <div class="progress-bar" style="flex:1;min-width:60px;"><div class="progress-fill ${fillClass}" style="width:${p.progress_percentage}%"></div></div>
            <span style="font-size:0.75rem;font-weight:600;">${p.progress_percentage}%</span>
          </div>
        </td>
        <td class="cell-muted">${esc((p.created_at || "").slice(0, 10))}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="project-detail.html?id=${p.id}" class="table-action-btn" title="View">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            ${isExecutive ? `<a href="project-form.html?id=${p.id}" class="table-action-btn" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>` : ""}
          </div>
        </td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}-${p.end_index} of ${p.count} projects`;
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
        const data = await window.OYA_API.apiFetch(`/projects/api/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("statusFilter");
          data.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiFinished").textContent = data.stats.finished;
        document.getElementById("kpiAtHand").textContent = data.stats.at_hand;
        document.getElementById("kpiFuture").textContent = data.stats.future;
        document.getElementById("statsSummary").innerHTML = `<strong style="color:var(--oya-text-primary);">${data.stats.total}</strong> projects`;
        tbody.innerHTML = data.projects.length ? data.projects.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--oya-text-muted);">No projects found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "projects", title: "Projects" });
      if (!user) return;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
      document.getElementById("exportBtn").addEventListener("click", () => {
        const rows = [...document.querySelectorAll("#projectsTable tbody tr")].map((tr) => [...tr.querySelectorAll("td")].slice(0, -1).map((td) => `"${td.textContent.trim().replace(/"/g, '""')}"`).join(","));
        const csv = ["Project,Status,Budget,Progress,Created", ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "projects.csv"; a.click();
      });

      load();
    })();
