function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = Array.isArray(errors) ? errors : [String(errors)];
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }
    document.getElementById("photo").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = document.getElementById("photoPreview");
      img.src = URL.createObjectURL(file);
      img.style.display = "";
    });

    const id = new URLSearchParams(window.location.search).get("id");
    const isEdit = !!id;

    document.getElementById("userForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const formData = new FormData(document.getElementById("userForm"));
      // Checkbox only appears in FormData when checked — CheckboxInput's
      // value_from_datadict treats an absent key as False, so nothing
      // extra is needed for the unchecked case.
      try {
        const endpoint = isEdit ? `/accounts/api/users/${id}/update/` : "/accounts/api/users/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        window.location.href = `user-detail.html?id=${data.user.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "users", title: isEdit ? "Edit User" : "Create User", requireExecutive: true });
      if (!user) return;

      if (isEdit) {
        document.getElementById("formTitle").textContent = "Edit User";
        document.getElementById("serialGroup").style.display = "none";
        document.getElementById("serial_number").required = false;
        document.getElementById("roleGroup").style.display = "";
        document.getElementById("pinGroup").style.display = "none";
        document.getElementById("pin").required = false;
        document.getElementById("newPinGroup").style.display = "";

        try {
          const roleSel = document.getElementById("role");
          ["ADMIN", "EXECUTIVE", "FLOOR_MEMBER"].forEach((v) => {
            const labels = { ADMIN: "Admin", EXECUTIVE: "Executive", FLOOR_MEMBER: "Floor Member" };
            const o = document.createElement("option"); o.value = v; o.textContent = labels[v]; roleSel.appendChild(o);
          });

          const { user: u } = await window.OYA_API.apiFetch(`/accounts/api/users/${id}/`);
          document.getElementById("full_name").value = u.full_name || "";
          document.getElementById("phone").value = u.phone || "";
          document.getElementById("state").value = u.state || "";
          roleSel.value = u.role;
          document.getElementById("is_active").checked = u.is_active !== false;
          if (u.photo_url) {
            const img = document.getElementById("photoPreview");
            img.src = u.photo_url; img.style.display = "";
          }
        } catch (err) {
          showErrors([err.message || "Couldn't load this user."]);
        }
      } else {
        // Creating here always produces an admin account (server enforces
        // this too) — the role field is intentionally hidden on create.
        document.getElementById("formTitle").textContent = "Create Admin User";
      }
    })();
