function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    const state = { search: "", page: 1 };

    function renderRow(d) {
      return `<tr>
        <td><a href="outside-donor-detail.html?id=${d.id}" class="cell-name" style="text-decoration:none;">${esc(d.full_name)}</a></td>
        <td class="cell-muted">${esc(d.phone_number || "—")}</td>
        <td class="cell-muted">${esc(d.occupation || "—")}</td>
        <td class="cell-muted">${d.invited_by ? esc(d.invited_by.full_name) : "—"}</td>
        <td><a href="outside-donor-detail.html?id=${d.id}" class="table-action-btn" title="View">
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
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/project-donations/api/outside-donors/list/?${qs.toString()}`);
        document.getElementById("kpiTotal").textContent = data.stats.total;
        document.getElementById("kpiDonations").textContent = naira(data.stats.total_donations);
        tbody.innerHTML = data.donors.length ? data.donors.map(renderRow).join("") : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No outside donors found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "outside-donors", title: "Outside Donors" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350); });

      load();
    })();
