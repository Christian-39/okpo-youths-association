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

    document.getElementById("profile_picture").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = document.getElementById("photoPreview");
      img.src = URL.createObjectURL(file); img.style.display = "";
    });

    document.getElementById("donorForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const formData = new FormData(document.getElementById("donorForm"));
      try {
        const endpoint = isEdit ? `/project-donations/api/outside-donors/${id}/update/` : "/project-donations/api/outside-donors/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        window.location.href = `outside-donor-detail.html?id=${data.donor.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "outside-donors", title: isEdit ? "Edit Outside Donor" : "Add Outside Donor", requireExecutive: true });
      if (!user) return;

      let debounce;
      document.getElementById("invitedBySearch").addEventListener("input", (e) => {
        clearTimeout(debounce);
        const q = e.target.value.trim();
        const box = document.getElementById("invitedByResults");
        if (q.length < 1) { box.style.display = "none"; return; }
        debounce = setTimeout(async () => {
          try {
            const data = await window.OYA_API.apiFetch(`/accounts/api/users/search/?q=${encodeURIComponent(q)}`);
            const results = data.results || [];
            box.innerHTML = results.length
              ? results.map((r) => `<button type="button" class="dropdown-item" data-id="${r.id}" data-name="${esc(r.full_name)} (${esc(r.serial_number)})" style="width:100%;text-align:left;">${esc(r.full_name)} (${esc(r.serial_number)})</button>`).join("")
              : `<div class="dropdown-item">No matches</div>`;
            box.style.display = "";
            box.querySelectorAll("[data-id]").forEach((btn) => btn.addEventListener("click", () => {
              document.getElementById("invited_by").value = btn.dataset.id;
              document.getElementById("invitedBySearch").value = btn.dataset.name;
              box.style.display = "none";
            }));
          } catch (err) { /* ignore transient search errors */ }
        }, 300);
      });

      try {
        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Outside Donor";
          const { donor } = await window.OYA_API.apiFetch(`/project-donations/api/outside-donors/${id}/`);
          document.getElementById("full_name").value = donor.full_name;
          document.getElementById("phone_number").value = donor.phone_number || "";
          document.getElementById("address").value = donor.address || "";
          document.getElementById("gender").value = donor.gender || "";
          document.getElementById("occupation").value = donor.occupation || "";
          document.getElementById("notes").value = donor.notes || "";
          if (donor.invited_by) {
            document.getElementById("invited_by").value = donor.invited_by.id;
            document.getElementById("invitedBySearch").value = donor.invited_by.full_name;
          }
          if (donor.profile_picture_url) { document.getElementById("photoPreview").src = donor.profile_picture_url; document.getElementById("photoPreview").style.display = ""; }
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
