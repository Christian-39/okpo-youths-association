function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    const state = { search: "", status: "", page: 1 };
    let canManage = false;

    function renderRow(g) {
      return `<tr>
        <td>
          <span class="cell-name">${esc(g.name)}</span>
          ${g.description ? `<br/><span class="cell-muted" style="white-space:normal;">${esc(g.description.slice(0, 60))}</span>` : ""}
        </td>
        <td>${naira(g.minimum_amount)} &ndash; ${g.is_unlimited ? "Unlimited" : naira(g.maximum_amount)}</td>
        <td><span class="badge badge-info">${g.members_count}</span></td>
        <td>${g.is_active ? `<span class="badge badge-success">Active</span>` : `<span class="badge badge-secondary">Inactive</span>`}</td>
        <td class="cell-muted">${esc((g.created_at || "").slice(0, 10))}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="donation-group-detail.html?id=${g.id}" class="table-action-btn" title="View">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            ${canManage ? `
            <a href="donation-group-form.html?id=${g.id}" class="table-action-btn" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button type="button" class="table-action-btn" title="${g.is_active ? "Deactivate" : "Activate"}" data-toggle="${g.id}">
              ${g.is_active
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`}
            </button>` : ""}
          </div>
        </td>
      </tr>`;
    }

    function renderPagination(p) {
      const footer = document.getElementById("paginationFooter");
      if (p.num_pages <= 1) { footer.style.display = "none"; return; }
      footer.style.display = "";
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}-${p.end_index} of ${p.count} groups`;
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
        const data = await window.OYA_API.apiFetch(`/settings/api/donation-groups/?${qs.toString()}`);
        canManage = data.can_manage;
        if (canManage) document.getElementById("addBtn").style.display = "";
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiActive").textContent = data.stats.active;
        document.getElementById("kpiMembers").textContent = data.stats.total_members_assigned;
        tbody.innerHTML = data.groups.length ? data.groups.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:3rem 1rem;color:var(--oya-text-muted);">No donation groups yet. ${canManage ? '<a href="donation-group-form.html">Create the first one</a>.' : ""}</td></tr>`;
        renderPagination(data.pagination);
        document.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", async () => {
          try { await window.OYA_API.apiFetch(`/settings/api/donation-groups/${btn.dataset.toggle}/toggle-active/`, { method: "POST" }); load(); }
          catch (err) { window.OYA.showToast(`Couldn't update: ${err.message}`, "error"); }
        }));
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "donation-groups", title: "Donation Groups" });
      if (!user) return;

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });

      load();
    })();
