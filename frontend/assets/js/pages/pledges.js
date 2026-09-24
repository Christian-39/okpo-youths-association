function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function statusBadge(s) {
      if (s === "COMPLETED") return `<span class="badge badge-success">Completed</span>`;
      if (s === "PARTIALLY_PAID") return `<span class="badge badge-info">Partially Paid</span>`;
      if (s === "CANCELLED") return `<span class="badge badge-secondary">Cancelled</span>`;
      return `<span class="badge badge-warning">Pending</span>`;
    }
    const state = { search: "", project: "", donation_type: "", status: "", page: 1 };
    let isExecutive = false, choicesBuilt = false;

    function renderRow(p) {
      return `<tr>
        <td>${p.project ? esc(p.project.title) : "\u2014"}</td>
        <td><span class="cell-name">${esc(p.donor ? p.donor.full_name : "Unknown")}</span></td>
        <td><span class="badge ${esc(p.donation_type_badge_class)}">${esc(p.donation_type_display)}</span></td>
        <td style="font-weight:600;">${esc(p.display_value)}</td>
        <td style="font-weight:600;color:${p.outstanding_balance > 0 ? "var(--oya-danger)" : "var(--oya-success)"};">${p.donation_type === "MONEY" ? naira(p.outstanding_balance) : "\u2014"}</td>
        <td>${statusBadge(p.status)}${p.is_overdue ? ' <span class="badge badge-danger">Overdue</span>' : ""}</td>
        <td class="cell-muted">${p.due_date || "\u2014"}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="pledge-detail.html?id=${p.id}" class="table-action-btn" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a>
            ${isExecutive ? `<a href="pledge-form.html?id=${p.id}" class="table-action-btn" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></a>` : ""}
          </div>
        </td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Page ${p.page} of ${p.num_pages} \u00b7 ${p.count} pledges`;
      const controls = document.getElementById("paginationControls");
      let html = "";
      for (let n = 1; n <= p.num_pages; n++) html += n === p.page ? `<button class="page-btn active">${n}</button>` : `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); }));
    }

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.project) qs.set("project", state.project);
      if (state.donation_type) qs.set("donation_type", state.donation_type);
      if (state.status) qs.set("status", state.status);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/project-donations/api/pledges/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const projSel = document.getElementById("projectFilter");
          data.fundraising_projects.forEach((pr) => { const o = document.createElement("option"); o.value = pr.id; o.textContent = pr.title; projSel.appendChild(o); });
          const typeSel = document.getElementById("typeFilter");
          data.donation_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; typeSel.appendChild(o); });
          const statusSel = document.getElementById("statusFilter");
          data.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });
          const overdueOpt = document.createElement("option"); overdueOpt.value = "OVERDUE"; overdueOpt.textContent = "Overdue"; statusSel.appendChild(overdueOpt);
        }
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiPending").textContent = data.stats.pending + data.stats.partially_paid;
        document.getElementById("kpiPledged").textContent = naira(data.stats.total_pledged);
        document.getElementById("kpiOutstanding").textContent = naira(data.stats.total_outstanding);
        tbody.innerHTML = data.results.length ? data.results.map(renderRow).join("") : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No pledges recorded.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "pledges", title: "Pledges" });
      if (!user) return;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("projectFilter").addEventListener("change", (e) => { state.project = e.target.value; state.page = 1; load(); });
      document.getElementById("typeFilter").addEventListener("change", (e) => { state.donation_type = e.target.value; state.page = 1; load(); });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });

      load();
    })();
