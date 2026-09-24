function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function fmtTs(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
        ` <span style="font-size:0.75rem;">${d.toLocaleTimeString("en-US")}</span>`;
    }
    function actionBadgeClass(a) {
      if (a === "CREATE") return "success";
      if (a === "UPDATE") return "warning";
      if (a === "DELETE") return "danger";
      if (a === "LOGIN" || a === "LOGOUT") return "info";
      if (a === "EXPORT") return "secondary";
      return "primary";
    }

    const state = { search: "", action: "", entity: "", user_search: "", date_from: "", date_to: "", page: 1 };
    let choicesBuilt = false;

    function renderRow(l) {
      return `<tr>
        <td class="cell-muted">${fmtTs(l.created_at)}</td>
        <td>${l.user ? `<span class="cell-name">${esc(l.user)}</span>` : `<span class="cell-muted">System</span>`}</td>
        <td><span class="badge badge-${actionBadgeClass(l.action)}">${esc(l.action)}</span></td>
        <td>${esc(l.object_type)}</td>
        <td>${esc((l.description || "").slice(0, 80))}</td>
        <td class="cell-muted">${esc(l.ip_address || "—")}</td>
        <td><button class="table-action-btn" title="Details" data-view="${l.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button></td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}\u2013${p.end_index} of ${p.count} entries`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) {
        html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      }
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    function buildExportLink() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.action) qs.set("action", state.action);
      if (state.entity) qs.set("entity", state.entity);
      if (state.user_search) qs.set("user_search", state.user_search);
      if (state.date_from) qs.set("date_from", state.date_from);
      if (state.date_to) qs.set("date_to", state.date_to);
      document.getElementById("exportLink").href = `${window.OYA_CONFIG.API_BASE_URL}/auditlogs/export/?${qs.toString()}`;
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.action) qs.set("action", state.action);
      if (state.entity) qs.set("entity", state.entity);
      if (state.user_search) qs.set("user_search", state.user_search);
      if (state.date_from) qs.set("date_from", state.date_from);
      if (state.date_to) qs.set("date_to", state.date_to);
      qs.set("page", state.page);

      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/auditlogs/api/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const actionSel = document.getElementById("actionFilter");
          data.action_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; actionSel.appendChild(o); });
          const entitySel = document.getElementById("entityFilter");
          data.entity_choices.forEach((e) => { const o = document.createElement("option"); o.value = e; o.textContent = e; entitySel.appendChild(o); });
        }
        document.getElementById("statsSummary").innerHTML = `<strong style="color:var(--oya-text-primary);">${data.pagination.count}</strong> entries`;
        tbody.innerHTML = data.logs.length ? data.logs.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No audit logs found.</td></tr>`;
        renderPagination(data.pagination);
        buildExportLink();
        tbody.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => openDetail(btn.dataset.view)));
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    async function openDetail(id) {
      const overlay = document.getElementById("detailModalOverlay");
      const body = document.getElementById("modalBody");
      overlay.style.display = "flex";
      body.innerHTML = "Loading&hellip;";
      try {
        const { log } = await window.OYA_API.apiFetch(`/auditlogs/api/${id}/detail/`);
        body.innerHTML = `
          <div class="detail-meta-grid" style="display:grid;gap:0.75rem;">
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">Timestamp</span><span class="detail-value">${fmtTs(log.created_at)}</span></div>
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">User</span><span class="detail-value">${log.user ? esc(log.user) : "System"}</span></div>
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">Action</span><span class="badge badge-${actionBadgeClass(log.action)}">${esc(log.action)}</span></div>
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">Entity</span><span class="detail-value">${esc(log.object_type)}${log.object_id ? " #" + log.object_id : ""}</span></div>
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">Description</span><pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${esc(log.description || "—")}</pre></div>
            <div><span class="detail-label" style="display:block;font-size:0.8125rem;color:var(--oya-text-muted);">IP Address</span><span class="detail-value">${esc(log.ip_address || "—")}</span></div>
          </div>`;
      } catch (err) {
        body.innerHTML = `<p style="color:var(--oya-danger);">Couldn't load details: ${esc(err.message)}</p>`;
      }
    }
    document.getElementById("closeModalBtn").addEventListener("click", () => { document.getElementById("detailModalOverlay").style.display = "none"; });
    document.getElementById("detailModalOverlay").addEventListener("click", (e) => { if (e.target.id === "detailModalOverlay") e.currentTarget.style.display = "none"; });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "audit-logs", title: "Audit Log", requireExecutive: true });
      if (!user) return;
      document.getElementById("exportLink").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("actionFilter").addEventListener("change", (e) => { state.action = e.target.value; state.page = 1; load(); });
      document.getElementById("entityFilter").addEventListener("change", (e) => { state.entity = e.target.value; state.page = 1; load(); });
      document.getElementById("dateFrom").addEventListener("change", (e) => { state.date_from = e.target.value; state.page = 1; load(); });
      document.getElementById("dateTo").addEventListener("change", (e) => { state.date_to = e.target.value; state.page = 1; load(); });
      document.getElementById("userSearch").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.user_search = e.target.value.trim(); state.page = 1; load(); }, 350); });

      load();
    })();
