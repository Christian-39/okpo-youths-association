function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

    async function load() {
      const tbody = document.getElementById("tbody");
      try {
        const data = await window.OYA_API.apiFetch("/members/api/clans/list/");
        tbody.innerHTML = data.results.length
          ? data.results.map((c) => `<tr><td><span class="cell-name">${esc(c.name)}</span></td><td><span class="badge badge-secondary">${c.member_count} member${c.member_count === 1 ? "" : "s"}</span></td></tr>`).join("")
          : `<tr><td colspan="2" style="text-align:center;padding:2rem;color:var(--oya-text-muted);">No clans recorded yet.</td></tr>`;
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:2rem;color:var(--oya-danger);">Couldn't load: ${esc(err.message)}</td></tr>`;
      }
    }

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "clans", title: "Clans" });
      if (!user) return;
      if (user.has_executive_access) document.getElementById("addBtn").style.display = "";
      load();
    })();
