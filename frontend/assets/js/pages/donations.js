function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function statusBadge(s, label) {
      if (s === "CONFIRMED") return `<span class="badge badge-success">${esc(label)}</span>`;
      if (s === "PLEDGE") return `<span class="badge badge-warning">${esc(label)}</span>`;
      return `<span class="badge badge-secondary">${esc(label)}</span>`;
    }
    const state = { search: "", project: "", donation_type: "", status: "", page: 1 };
    let isExecutive = false, isAdmin = false, choicesBuilt = false;

    function renderRow(d) {
      return `<tr>
        <td>${d.project ? esc(d.project.title) : "—"}</td>
        <td><span class="cell-name">${esc(d.donor_name)}</span></td>
        <td>${esc(d.donation_type_display)}</td>
        <td style="font-weight:600;">${esc(d.display_value)}</td>
        <td>${statusBadge(d.status, d.status_display)}</td>
        <td class="cell-muted">${esc(d.donation_date || "")}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="donation-detail.html?id=${d.id}" class="table-action-btn" title="View donation" aria-label="View donation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a>
            ${isExecutive && d.status === "PLEDGE" ? `<button class="table-action-btn" data-fulfill="${d.id}" title="Mark Fulfilled"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ""}
            ${isExecutive ? `<a href="donation-form.html?id=${d.id}" class="table-action-btn" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></a>` : ""}
          </div>
        </td>
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
      if (state.project) qs.set("project", state.project);
      if (state.donation_type) qs.set("donation_type", state.donation_type);
      if (state.status) qs.set("status", state.status);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/project-donations/api/donations/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const projSel = document.getElementById("projectFilter");
          data.fundraising_projects.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.title; projSel.appendChild(o); });
          const typeSel = document.getElementById("typeFilter");
          data.donation_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; typeSel.appendChild(o); });
          const statusSel = document.getElementById("statusFilter");
          data.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });
        }
        document.getElementById("kpiTotal").textContent = naira(data.totals.total_donations);
        document.getElementById("kpiMember").textContent = naira(data.totals.member_total);
        document.getElementById("kpiOutside").textContent = naira(data.totals.outside_total);
        tbody.innerHTML = data.donations.length ? data.donations.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No donations recorded.</td></tr>`;
        renderPagination(data.pagination);
        document.querySelectorAll("[data-fulfill]").forEach((btn) => btn.addEventListener("click", async () => {
          try { await window.OYA_API.apiFetch(`/project-donations/api/donations/${btn.dataset.fulfill}/fulfill/`, { method: "POST" }); load(); }
          catch (err) { window.OYA.showToast(err.message, "error"); }
        }));
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "donations", title: "Project Donations" });
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
