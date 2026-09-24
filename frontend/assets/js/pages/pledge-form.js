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

    function toggleDonorTypeFields() {
      const isOutside = document.getElementById("donor_type").value === "OUTSIDE";
      document.getElementById("memberGroup").style.display = isOutside ? "none" : "";
      document.getElementById("outsideDonorGroup").style.display = isOutside ? "" : "none";
    }
    function toggleDonationTypeFields() {
      const type = document.getElementById("donation_type").value;
      document.getElementById("moneyFields").style.display = type === "MONEY" ? "flex" : "none";
      document.getElementById("materialFields").style.display = type === "MATERIAL" ? "flex" : "none";
      document.getElementById("labourFields").style.display = type === "LABOUR" ? "flex" : "none";
      document.getElementById("estimatedValueGroup").style.display = (type === "MATERIAL" || type === "LABOUR") ? "flex" : "none";
    }
    document.getElementById("donor_type").addEventListener("change", toggleDonorTypeFields);
    document.getElementById("donation_type").addEventListener("change", toggleDonationTypeFields);

    let searchDebounce;
    document.getElementById("memberSearch").addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const q = e.target.value.trim();
      const box = document.getElementById("memberResults");
      if (q.length < 1) { box.style.display = "none"; return; }
      searchDebounce = setTimeout(async () => {
        try {
          const data = await window.OYA_API.apiFetch(`/accounts/api/users/search/?q=${encodeURIComponent(q)}`);
          const results = data.results || [];
          box.innerHTML = results.length
            ? results.map((r) => `<button type="button" class="dropdown-item" data-id="${r.id}" data-name="${esc(r.text || r.full_name)}" style="width:100%;text-align:left;">${esc(r.text || r.full_name)}</button>`).join("")
            : `<div class="dropdown-item">No matches</div>`;
          box.style.display = "";
          box.querySelectorAll("[data-id]").forEach((btn) => btn.addEventListener("click", () => {
            document.getElementById("member").value = btn.dataset.id;
            document.getElementById("memberSearch").value = btn.dataset.name;
            box.style.display = "none";
          }));
        } catch (err) { /* ignore transient search errors */ }
      }, 300);
    });

    document.getElementById("pledgeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const formData = new FormData(document.getElementById("pledgeForm"));
      try {
        const endpoint = isEdit ? `/project-donations/api/pledges/${id}/update/` : "/project-donations/api/pledges/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        window.location.href = `pledge-detail.html?id=${data.pledge.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "pledges", title: isEdit ? "Edit Pledge" : "Record Pledge", requireExecutive: true });
      if (!user) return;

      try {
        const meta = await window.OYA_API.apiFetch("/project-donations/api/pledges/form-meta/");
        const projSel = document.getElementById("project");
        meta.projects.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.title; projSel.appendChild(o); });
        const donorTypeSel = document.getElementById("donor_type");
        meta.donor_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; donorTypeSel.appendChild(o); });
        const outsideSel = document.getElementById("outside_donor");
        meta.outside_donors.forEach((d) => { const o = document.createElement("option"); o.value = d.id; o.textContent = d.full_name; outsideSel.appendChild(o); });
        const typeSel = document.getElementById("donation_type");
        meta.donation_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; typeSel.appendChild(o); });
        const statusSel = document.getElementById("status");
        meta.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });

        toggleDonorTypeFields();
        toggleDonationTypeFields();

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Pledge";
          document.getElementById("statusGroup").style.display = "";
          const { pledge } = await window.OYA_API.apiFetch(`/project-donations/api/pledges/${id}/`);
          if (pledge.project) projSel.value = pledge.project.id;
          donorTypeSel.value = pledge.donor_type;
          typeSel.value = pledge.donation_type;
          if (pledge.donor_type === "MEMBER" && pledge.donor) {
            document.getElementById("member").value = pledge.donor.id;
            document.getElementById("memberSearch").value = pledge.donor.full_name;
          } else if (pledge.donor_type === "OUTSIDE" && pledge.donor) {
            outsideSel.value = pledge.donor.id;
          }
          document.getElementById("pledged_amount").value = pledge.pledged_amount || "";
          document.getElementById("material_name").value = pledge.material_name || "";
          document.getElementById("quantity").value = pledge.quantity || "";
          document.getElementById("labour_type").value = pledge.labour_type || "";
          document.getElementById("number_of_days").value = pledge.number_of_days || "";
          document.getElementById("estimated_value").value = pledge.estimated_value || "";
          document.getElementById("due_date").value = pledge.due_date || "";
          document.getElementById("notes").value = pledge.notes || "";
          statusSel.value = pledge.status;
          toggleDonorTypeFields();
          toggleDonationTypeFields();
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
