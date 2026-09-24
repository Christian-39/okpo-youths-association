function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") {
        Object.entries(errors).forEach(([field, msgs]) => (Array.isArray(msgs) ? msgs : [msgs]).forEach((m) => lines.push(`${field}: ${m.message || m}`)));
      }
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }

    const id = new URLSearchParams(window.location.search).get("id");
    const isEdit = !!id;

    document.getElementById("groupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const payload = new URLSearchParams({
        name: document.getElementById("name").value,
        description: document.getElementById("description").value,
        minimum_amount: document.getElementById("minimum_amount").value || "0",
        maximum_amount: document.getElementById("maximum_amount").value,
        is_active: document.getElementById("is_active").checked ? "on" : "",
      });

      try {
        const endpoint = isEdit ? `/settings/api/donation-groups/${id}/update/` : "/settings/api/donation-groups/create/";
        const data = await window.OYA_API.apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        });
        window.location.href = `donation-group-detail.html?id=${data.group.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "donation-groups", title: isEdit ? "Edit Donation Group" : "New Donation Group" });
      if (!user) return;
      if (!(user.has_admin_access || user.has_executive_access)) {
        showErrors(["Admin or Executive access required."]);
        document.getElementById("groupForm").style.display = "none";
        return;
      }
      if (isEdit) {
        document.getElementById("formTitle").textContent = "Edit Donation Group";
        try {
          const data = await window.OYA_API.apiFetch(`/settings/api/donation-groups/${id}/`);
          const g = data.group;
          document.getElementById("name").value = g.name;
          document.getElementById("description").value = g.description || "";
          document.getElementById("minimum_amount").value = g.minimum_amount;
          document.getElementById("maximum_amount").value = g.is_unlimited ? "" : g.maximum_amount;
          document.getElementById("is_active").checked = g.is_active;
        } catch (err) {
          showErrors([err.message || "Couldn't load the group."]);
        }
      }
    })();
