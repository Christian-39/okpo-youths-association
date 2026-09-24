function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

    const state = { search: "", type: "", page: 1 };
    let choicesBuilt = false;

    function renderRow(i) {
      return `<tr>
        <td><span class="badge badge-primary">${esc(i.income_type_display)}</span></td>
        <td>${esc(i.reason)}</td>
        <td>${esc(i.payer)}</td>
        <td style="font-weight:600;color:var(--oya-success);">${naira(i.amount)}</td>
        <td class="cell-muted">${esc(i.created_by || "—")}</td>
        <td class="cell-muted">${esc((i.created_at || "").slice(0, 10))}</td>
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
      if (state.type) qs.set("type", state.type);
      qs.set("page", state.page);
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/donations/?${qs.toString()}`);
        if (!choicesBuilt) {
          choicesBuilt = true;
          const sel = document.getElementById("typeFilter");
          data.income_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        }
        document.getElementById("statsSummary").innerHTML = `<strong style="color:var(--oya-text-primary);">${naira(data.total_donations)}</strong> total contributions`;
        tbody.innerHTML = data.incomes.length ? data.incomes.map(renderRow).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No contributions found.</td></tr>`;
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "contributions", title: "Contributions" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";

      let debounce;
      document.getElementById("searchInput").addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350);
      });
      document.getElementById("typeFilter").addEventListener("change", (e) => { state.type = e.target.value; state.page = 1; load(); });

      load();
    })();
