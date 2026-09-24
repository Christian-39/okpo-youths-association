function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    const AVATAR_COLORS = ["var(--oya-primary)", "var(--oya-accent)", "var(--oya-success)", "var(--oya-warning)"];

    const state = { search: "", status: "", clan: "", page: 1 };
    let isExecutive = false;

    function statusBadge(status) {
      if (status === "ACTIVE") return `<span class="badge badge-success" style="font-size:clamp(0.625rem, 1.5vw, 0.75rem);white-space:nowrap;">Active</span>`;
      if (status === "PAST_MEMBER") return `<span class="badge badge-warning" style="font-size:clamp(0.625rem, 1.5vw, 0.75rem);white-space:nowrap;">Past Member</span>`;
      if (status === "REMOVED") return `<span class="badge badge-danger" style="font-size:clamp(0.625rem, 1.5vw, 0.75rem);white-space:nowrap;">Removed</span>`;
      return `<span class="badge" style="white-space:nowrap;">${esc(status)}</span>`;
    }

    function positionCell(m) {
      if (m.position) return `<span class="badge badge-primary" style="font-size:clamp(0.625rem, 1.5vw, 0.75rem);white-space:nowrap;">${esc(m.position)}</span>`;
      if (m.is_taskforce) return `<span class="badge badge-info" style="font-size:clamp(0.625rem, 1.5vw, 0.75rem);white-space:nowrap;">Taskforce</span>`;
      return `<span class="cell-muted" style="font-size:clamp(0.75rem, 1.5vw, 0.8125rem);white-space:nowrap;">Floor Member</span>`;
    }

    function renderRow(m, idx) {
      const avatarBg = m.photo_url ? "" : `background:${AVATAR_COLORS[idx % AVATAR_COLORS.length]};color:#fff;`;
      const avatarInner = m.photo_url
        ? `<img src="${esc(m.photo_url)}" alt="${esc(m.full_name)}" style="width:100%;height:100%;object-fit:cover;">`
        : esc((m.full_name || "").slice(0, 2).toUpperCase());
      return `
      <tr>
        <td><input type="checkbox" class="form-check-input row-checkbox" value="${m.id}"></td>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;white-space:nowrap;">
            <div class="avatar avatar-sm" style="${avatarBg}overflow:hidden;">${avatarInner}</div>
            <span class="cell-name" style="font-size:clamp(0.8125rem, 2vw, 0.875rem);white-space:nowrap;">${esc(m.full_name)}</span>
          </div>
        </td>
        <td class="cell-muted" style="font-size:clamp(0.75rem, 1.5vw, 0.8125rem);white-space:nowrap;">${esc(m.serial_number)}</td>
        <td style="white-space:nowrap;">${esc(m.clan ? m.clan.name : "—")}</td>
        <td style="white-space:nowrap;">${statusBadge(m.status)}</td>
        <td style="white-space:nowrap;">${positionCell(m)}</td>
        <td class="cell-muted" style="font-size:clamp(0.75rem, 1.5vw, 0.8125rem);white-space:nowrap;">${m.age != null ? m.age : "—"}</td>
        <td class="cell-muted" style="font-size:clamp(0.75rem, 1.5vw, 0.8125rem);white-space:nowrap;">${esc(m.state_or_abroad || "—")}</td>
        <td class="cell-muted" style="font-size:clamp(0.75rem, 1.5vw, 0.8125rem);white-space:nowrap;">${m.year_joined != null ? m.year_joined : "—"}</td>
        <td style="white-space:nowrap;">
          <div class="table-actions" style="display:flex;gap:0.25rem;flex-wrap:nowrap;white-space:nowrap;">
            <a href="member-detail.html?id=${m.id}" class="table-action-btn" title="View">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            ${isExecutive ? `
            <a href="member-form.html?id=${m.id}" class="table-action-btn" title="Edit">
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
      document.getElementById("paginationSummary").textContent = `Showing ${p.start_index}-${p.end_index} of ${p.count} members`;

      const controls = document.getElementById("paginationControls");
      let html = "";
      html += p.has_previous
        ? `<a href="#" class="page-btn" data-page="${p.previous_page_number}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>`
        : `<button class="page-btn" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>`;

      for (let n = 1; n <= p.num_pages; n++) {
        if (n === p.page) html += `<button class="page-btn active">${n}</button>`;
        else if (n > p.page - 3 && n < p.page + 3) html += `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
        else if (n === 1 || n === p.num_pages) html += `<a href="#" class="page-btn" data-page="${n}">${n}</a>`;
        else if (n === p.page - 3 || n === p.page + 3) html += `<span class="page-btn">...</span>`;
      }

      html += p.has_next
        ? `<a href="#" class="page-btn" data-page="${p.next_page_number}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></a>`
        : `<button class="page-btn" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>`;

      controls.innerHTML = html;
      controls.querySelectorAll("[data-page]").forEach((el) => {
        el.addEventListener("click", (e) => { e.preventDefault(); state.page = parseInt(el.dataset.page, 10); load(); });
      });
    }

    let filtersBuilt = false;
    function buildFiltersOnce(data) {
      if (filtersBuilt) return;
      filtersBuilt = true;
      const statusSelect = document.getElementById("statusFilter");
      data.status_choices.forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = label;
        statusSelect.appendChild(opt);
      });
      const clanSelect = document.getElementById("clanFilter");
      data.clans.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id; opt.textContent = c.name;
        clanSelect.appendChild(opt);
      });
    }

    // Each load aborts the previous one, so a slow earlier response can never
    // repaint the table over newer results (type "CH" then "CHR" quickly).
    const listRequest = window.OYA_API.createCancellable();

    async function load() {
      const tbody = document.getElementById("membersTbody");
      const qs = new URLSearchParams();
      if (state.search) qs.set("search", state.search);
      if (state.status) qs.set("status", state.status);
      if (state.clan) qs.set("clan", state.clan);
      qs.set("page", state.page);

      tbody.innerHTML = `<tr><td colspan="10"><div class="oya-loading"><span class="oya-spinner"></span>Loading members&hellip;</div></td></tr>`;

      try {
        const data = await listRequest(`/members/api/list/?${qs.toString()}`);
        buildFiltersOnce(data);

        document.getElementById("statsSummary").innerHTML = `
          <strong style="color:var(--oya-text-primary);">${data.stats.total}</strong> total members
          <span style="margin-left:1rem;"><strong style="color:var(--oya-success);">${data.stats.active}</strong> active</span>
          <span style="margin-left:1rem;"><strong style="color:var(--oya-text-muted);">${data.stats.past}</strong> past</span>
          <span style="margin-left:1rem;"><strong style="color:var(--oya-danger);">${data.stats.removed}</strong> removed</span>`;

        if (!data.members.length) {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No members found. ${isExecutive ? '<a href="member-form.html">Add your first member</a>.' : ""}</td></tr>`;
        } else {
          tbody.innerHTML = data.members.map((m, i) => renderRow(m, i)).join("");
        }
        renderPagination(data.pagination);
      } catch (err) {
        // A superseded request is the normal outcome of fast typing — leave
        // the newer request to paint rather than flashing an error.
        if (err && err.isCancellation) return;
        tbody.innerHTML = `
          <tr><td colspan="10">
            <div class="oya-state oya-state--error">
              <span class="oya-state__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <span class="oya-state__title">Couldn't load members</span>
              <span class="oya-state__message">${esc(err.message)}</span>
              <span class="oya-state__actions"><button type="button" class="btn btn-secondary btn-sm" id="membersRetryBtn">Retry</button></span>
            </div>
          </td></tr>`;
        const retry = document.getElementById("membersRetryBtn");
        if (retry) retry.addEventListener("click", load);
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "members", title: "Members" });
      if (!user) return;
      isExecutive = !!user.has_executive_access;
      if (isExecutive) document.getElementById("addMemberBtn").style.display = "";

      let debounce;
      document.getElementById("memberSearch").addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 350);
      });
      document.getElementById("statusFilter").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
      document.getElementById("clanFilter").addEventListener("change", (e) => { state.clan = e.target.value; state.page = 1; load(); });
      document.getElementById("selectAll").addEventListener("change", (e) => {
        document.querySelectorAll(".row-checkbox").forEach((cb) => (cb.checked = e.target.checked));
      });
      document.getElementById("exportBtn").addEventListener("click", () => {
        // Simple CSV export of the currently loaded page — mirrors the
        // original "Export" button's intent without a server round-trip.
        const rows = [...document.querySelectorAll("#membersTable tbody tr")].map((tr) =>
          [...tr.querySelectorAll("td")].slice(1, -1).map((td) => `"${td.textContent.trim().replace(/"/g, '""')}"`).join(",")
        );
        const csv = ["Name,Serial Number,Clan,Status,Position,Age,State/Abroad,Joined", ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "members.csv";
        a.click();
      });

      load();
    })();
