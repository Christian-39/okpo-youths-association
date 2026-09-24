function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") Object.entries(errors).forEach(([f, m]) => (Array.isArray(m) ? m : [m]).forEach((x) => lines.push(`${f}: ${x.message || x}`)));
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }
    const id = new URLSearchParams(window.location.search).get("id");
    const isEdit = !!id;

    document.getElementById("caseForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const payload = new URLSearchParams({
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        fine_amount: document.getElementById("fine_amount").value || "0",
        status: document.getElementById("status").value,
        respondent: document.getElementById("respondent").value,
        reported_to: document.getElementById("reported_to").value,
      });
      try {
        const endpoint = isEdit ? `/operations/api/cases/${id}/update/` : "/operations/api/cases/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload.toString() });
        window.location.href = `case-detail.html?id=${data.case.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "cases", title: isEdit ? "Edit Case" : "File Case", requireExecutive: true });
      if (!user) return;

      const statusChoices = [["OPEN", "Open"], ["IN_PROGRESS", "In Progress"], ["RESOLVED", "Resolved"]];
      const statusSel = document.getElementById("status");
      statusChoices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });

      try {
        const metaEndpoint = isEdit ? `/operations/api/cases/${id}/form-meta/` : "/operations/api/cases/form-meta/";
        const meta = await window.OYA_API.apiFetch(metaEndpoint);
        const respSel = document.getElementById("respondent");
        meta.respondents.forEach((m) => { const o = document.createElement("option"); o.value = m.id; o.textContent = m.full_name; respSel.appendChild(o); });
        const reportedSel = document.getElementById("reported_to");
        meta.task_force_members.forEach((t) => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.name; reportedSel.appendChild(o); });

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Case";
          const { case: c } = await window.OYA_API.apiFetch(`/operations/api/cases/${id}/`);
          document.getElementById("title").value = c.title;
          document.getElementById("description").value = c.description || "";
          document.getElementById("fine_amount").value = c.fine_amount;
          statusSel.value = c.status;
          if (c.respondent) respSel.value = c.respondent.id;
          if (c.reported_to) reportedSel.value = c.reported_to.id;
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
