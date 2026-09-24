function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    const state = { status: "", page: 1 };
    let isExecutive = false;

    function renderRow(tf) {
      return `<tr>
        <td><span class="cell-name">${esc(tf.member.full_name)}</span><div class="cell-muted">${esc(tf.member.serial_number)}</div></td>
        <td>${esc(tf.member.clan || "—")}</td>
        <td class="cell-muted">${esc((tf.assigned_date || ""))}</td>
        <td class="cell-muted">${esc((tf.notes || "").slice(0, 40))}</td>
        <td>${tf.is_active ? `<span class="badge badge-success">Active</span>` : `<span class="badge badge-secondary">Inactive</span>`}</td>
        <td>
          ${isExecutive ? `<div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="taskforce-form.html?id=${tf.id}" class="table-action-btn" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            ${tf.is_active ? `<button class="table-action-btn danger" data-remove="${tf.id}" data-name="${esc(tf.member.full_name)}" title="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ""}
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
      if (state.status) qs.set("status", state.status);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/operations/api/taskforce/list/?${qs.toString()}`);
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiActive").textContent = data.stats.active;
        document.getElementById("kpiInactive").textContent = data.stats.inactive;
        tbody.innerHTML = data.taskforce.length ? data.taskforce.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No task force members yet.</td></tr>`;
        renderPagination(data.pagination);
        document.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", async () => {
          if (!await window.OYA.confirmAction({ title: "Remove task force member?", message: `Remove ${btn.dataset.name} from the task force?`, confirmText: "Remove member" })) return;
          try { await window.OYA_API.apiFetch(`/operations/api/taskforce/${btn.dataset.remove}/remove/`, { method: "POST" }); load(); }
          catch (err) { window.OYA.showToast(err.message, "error"); }
        }));
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "taskforces", title: "Task Force" });
      if (!user) return;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addBtn").style.display = "";
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
      load();
    })();
