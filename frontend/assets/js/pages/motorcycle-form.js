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

    document.getElementById("mcForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const payload = new URLSearchParams({
        asset_tag: document.getElementById("asset_tag").value,
        brand: document.getElementById("brand").value,
        model: document.getElementById("model").value,
        year: document.getElementById("year").value,
        condition: document.getElementById("condition").value,
        assigned_to: document.getElementById("assigned_to").value,
      });
      try {
        const endpoint = isEdit ? `/operations/api/motorcycles/${id}/update/` : "/operations/api/motorcycles/create/";
        await window.OYA_API.apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload.toString() });
        window.location.href = "motorcycles.html";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "motorcycles", title: isEdit ? "Edit Motorcycle" : "Register Motorcycle", requireExecutive: true });
      if (!user) return;
      try {
        const meta = await window.OYA_API.apiFetch("/operations/api/motorcycles/form-meta/");
        const condSel = document.getElementById("condition");
        meta.condition_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; condSel.appendChild(o); });
        const memberSel = document.getElementById("assigned_to");
        meta.members.forEach((m) => { const o = document.createElement("option"); o.value = m.id; o.textContent = m.full_name; memberSel.appendChild(o); });

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Motorcycle";
          const { motorcycle } = await window.OYA_API.apiFetch(`/operations/api/motorcycles/${id}/`);
          document.getElementById("asset_tag").value = motorcycle.asset_tag;
          document.getElementById("brand").value = motorcycle.brand || "";
          document.getElementById("model").value = motorcycle.model || "";
          document.getElementById("year").value = motorcycle.year || "";
          condSel.value = motorcycle.condition;
          if (motorcycle.assigned_to) memberSel.value = motorcycle.assigned_to.id;
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
