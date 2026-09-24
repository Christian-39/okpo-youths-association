function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    const state = { search: "", condition: "", page: 1 };
    let isExecutive = false, choicesBuilt = false;

    function conditionBadge(c) {
      if (c === "EXCELLENT") return `<span class="badge badge-success">Excellent</span>`;
      if (c === "NEEDS_SERVICE") return `<span class="badge badge-warning">Needs Service</span>`;
      if (c === "GROUNDED") return `<span class="badge badge-danger">Grounded</span>`;
      return "";
    }

    function renderRow(mc) {
      return `<tr>
        <td><span class="cell-name">${esc(mc.asset_tag)}</span></td>
        <td>${esc(mc.brand || "")} ${esc(mc.model || "")}</td>
        <td class="cell-muted">${mc.year || "—"}</td>
        <td>${conditionBadge(mc.condition)}</td>
        <td>${mc.assigned_to ? esc(mc.assigned_to.full_name) : `<span class="cell-muted">Unassigned</span>`}</td>
        <td>
          ${isExecutive ? `<div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="motorcycle-form.html?id=${mc.id}" class="table-action-btn" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button class="table-action-btn danger" data-delete="${mc.id}" data-tag="${esc(mc.asset_tag)}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>` : ""}
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
      if (state.condition) qs.set("condition", state.condition);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/operations/api/motorcycles/list/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("conditionFilter");
          data.condition_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiExcellent").textContent = data.stats.excellent;
        document.getElementById("kpiNeeds").textContent = data.stats.needs_service;
        document.getElementById("kpiGrounded").textContent = data.stats.grounded;
        tbody.innerHTML = data.motorcycles.length ? data.motorcycles.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No motorcycles found.</td></tr>`;
        renderPagination(data.pagination);
        document.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", async () => {
          if (!await window.OYA.confirmAction({ title: "Delete motorcycle?", message: `Delete motorcycle ${btn.dataset.tag}? This cannot be undone.`, confirmText: "Delete motorcycle" })) return;
          try { await window.OYA_API.apiFetch(`/operations/api/motorcycles/${btn.dataset.delete}/delete/`, { method: "DELETE" }); load(); }
          catch (err) { window.OYA.showToast(err.message, "error"); }
        }));
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "motorcycles", title: "Motorcycles" });
      if (!user) return;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });
      document.getElementById("conditionFilter").addEventListener("change", (e) => { state.condition = e.target.value; state.page = 1; load(); });

      load();
    })();
