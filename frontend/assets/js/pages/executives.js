function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    const AVATAR_COLORS = ["var(--oya-primary)", "var(--oya-accent)", "var(--oya-success)", "var(--oya-warning)"];
    const state = { search: "", status: "", page: 1 };
    let isSuperuser = false;

    function postBadge(post) {
      let cls = "badge-info";
      if (post === "President") cls = "badge-accent";
      else if (post === "Vice President" || post === "Deputy President") cls = "badge-primary";
      else if (post === "Treasurer" || post === "Financial Secretary") cls = "badge-success";
      else if (post === "Secretary" || post === "Assistant Secretary") cls = "badge-warning";
      return `<span class="badge ${cls}" style="white-space:nowrap;">${esc(post)}</span>`;
    }

    function renderRow(e, idx) {
      const m = e.member;
      const avatarBg = m.photo_url ? "" : `background:${AVATAR_COLORS[idx % AVATAR_COLORS.length]};color:#fff;`;
      const avatarInner = m.photo_url
        ? `<img src="${esc(m.photo_url)}" alt="${esc(m.full_name)}" style="width:100%;height:100%;object-fit:cover;">`
        : esc((m.full_name || "").slice(0, 2).toUpperCase());
      const startYear = e.start_date ? e.start_date.slice(0, 4) : "";
      const tenure = `${startYear}${e.end_date ? " - " + e.end_date.slice(0, 4) : " - Present"}`;

      return `<tr>
        <td><div class="avatar avatar-sm" style="${avatarBg}overflow:hidden;">${avatarInner}</div></td>
        <td><span class="cell-name" style="white-space:nowrap;">${esc(m.full_name)}</span></td>
        <td>${postBadge(e.post)}</td>
        <td class="cell-muted">${esc(m.phone || "N/A")}</td>
        <td class="cell-muted">${tenure}</td>
        <td>${e.is_current ? `<span class="badge badge-success">Active</span>` : `<span class="badge badge-secondary">Past</span>`}</td>
        <td>
          <div class="table-actions" style="flex-wrap:nowrap;gap:0.25rem;">
            <a href="executive-detail.html?id=${e.id}" class="table-action-btn" title="View Details">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            ${isSuperuser ? `
            <a href="executive-form.html?id=${e.id}" class="table-action-btn" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            ${e.is_current ? `<button type="button" class="table-action-btn danger" title="End Tenure" data-end-tenure="${e.id}" data-name="${esc(m.full_name)}" data-post="${esc(e.post)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </button>` : ""}` : ""}
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
        const data = await window.OYA_API.apiFetch(`/executives/api/list/?${qs.toString()}`);
        document.getElementById("statsSummary").innerHTML = `<strong style="color:var(--oya-text-primary);">${data.total_executives}</strong> executives &middot; <strong style="color:var(--oya-text-primary);">${data.current_count}</strong> current`;
        tbody.innerHTML = data.executives.length ? data.executives.map(renderRow).join("") : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No executives found.</td></tr>`;
        renderPagination(data.pagination);
        wireEndTenureButtons();
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    function wireEndTenureButtons() {
      document.querySelectorAll("[data-end-tenure]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!await window.OYA.confirmAction({ title: "End executive tenure?", message: `End tenure for ${btn.dataset.name} as ${btn.dataset.post}?`, confirmText: "End tenure" })) return;
          try {
            await window.OYA_API.apiFetch(`/executives/api/${btn.dataset.endTenure}/end-tenure/`, { method: "POST" });
            load();
          } catch (err) {
            window.OYA.showToast(`Couldn't end tenure: ${err.message}`, "error");
          }
        });
      });
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "executives", title: "Executives" });
      if (!user) return;
      isSuperuser = !!user.is_superuser;
      if (isSuperuser) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350);
      });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
      document.getElementById("exportBtn").addEventListener("click", () => {
        const rows = [...document.querySelectorAll("#executivesTable tbody tr")].map((tr) =>
          [...tr.querySelectorAll("td")].slice(1, -1).map((td) => `"${td.textContent.trim().replace(/"/g, '""')}"`).join(",")
        );
        const csv = ["Name,Position,Phone,Tenure,Status", ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "executives.csv"; a.click();
      });

      load();
    })();
