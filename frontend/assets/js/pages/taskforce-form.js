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

    document.getElementById("tfForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const payload = new URLSearchParams({
        member: document.getElementById("member").value,
        assigned_date: document.getElementById("assigned_date").value,
        notes: document.getElementById("notes").value,
        is_active: document.getElementById("is_active").checked ? "on" : "",
      });
      try {
        const endpoint = isEdit ? `/operations/api/taskforce/${id}/update/` : "/operations/api/taskforce/create/";
        await window.OYA_API.apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload.toString() });
        window.location.href = "taskforces.html";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "taskforces", title: isEdit ? "Edit Task Force Member" : "Assign Task Force Member", requireExecutive: true });
      if (!user) return;
      try {
        const meta = await window.OYA_API.apiFetch("/operations/api/taskforce/form-meta/");
        const sel = document.getElementById("member");
        meta.available_members.forEach((m) => { const o = document.createElement("option"); o.value = m.id; o.textContent = `${m.full_name} (${m.serial_number})`; sel.appendChild(o); });

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Task Force Member";
          const { taskforce } = await window.OYA_API.apiFetch(`/operations/api/taskforce/${id}/`);
          // Current member may not be in the "available" list (already assigned) — add it explicitly.
          if (![...sel.options].some((o) => o.value == taskforce.member.id)) {
            const o = document.createElement("option"); o.value = taskforce.member.id; o.textContent = taskforce.member.full_name; sel.appendChild(o);
          }
          sel.value = taskforce.member.id;
          document.getElementById("assigned_date").value = taskforce.assigned_date;
          document.getElementById("notes").value = taskforce.notes || "";
          document.getElementById("is_active").checked = taskforce.is_active;
        } else {
          document.getElementById("assigned_date").value = new Date().toISOString().slice(0, 10);
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
