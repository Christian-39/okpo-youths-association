function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") Object.entries(errors).forEach(([f, m]) => (Array.isArray(m) ? m : [m]).forEach((x) => lines.push(`${f}: ${x.message || x}`)));
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }
    const id = new URLSearchParams(window.location.search).get("id");

    document.getElementById("resolveForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const payload = new URLSearchParams({
        status: document.getElementById("status").value,
        resolved_by: document.getElementById("resolved_by").value,
        resolved_date: document.getElementById("resolved_date").value,
        resolution_notes: document.getElementById("resolution_notes").value,
      });
      try {
        const data = await window.OYA_API.apiFetch(`/operations/api/cases/${id}/resolve/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload.toString() });
        if (data.fine_recorded) {
          document.getElementById("fineNotice").textContent = `${naira(data.case.fine_amount)} fine automatically recorded in finances.`;
          document.getElementById("fineNotice").style.display = "";
          setTimeout(() => { window.location.href = `case-detail.html?id=${id}`; }, 2000);
        } else {
          window.location.href = `case-detail.html?id=${id}`;
        }
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "cases", title: "Resolve Case", requireExecutive: true });
      if (!user) return;
      if (!id) { showErrors(["No case specified."]); document.getElementById("resolveForm").style.display = "none"; return; }

      const statusChoices = [["OPEN", "Open"], ["IN_PROGRESS", "In Progress"], ["RESOLVED", "Resolved"]];
      const statusSel = document.getElementById("status");
      statusChoices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });

      try {
        const meta = await window.OYA_API.apiFetch(`/operations/api/cases/${id}/form-meta/`);
        const reportedSel = document.getElementById("resolved_by");
        meta.task_force_members.forEach((t) => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.name; reportedSel.appendChild(o); });

        const { case: c } = await window.OYA_API.apiFetch(`/operations/api/cases/${id}/`);
        document.getElementById("caseSubtitle").textContent = `${c.case_number}: ${c.title}`;
        statusSel.value = c.status === "OPEN" ? "IN_PROGRESS" : c.status;
        if (c.reported_to) reportedSel.value = c.reported_to.id;
        document.getElementById("resolved_date").value = new Date().toISOString().slice(0, 10);
      } catch (err) {
        showErrors([err.message || "Couldn't load the case."]);
      }
    })();
