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

    // "is current" / end date are mutually exclusive, same behavior as
    // the original template's inline script.
    document.getElementById("end_date").addEventListener("input", (e) => {
      if (e.target.value) document.getElementById("is_current").checked = false;
    });
    document.getElementById("is_current").addEventListener("change", (e) => {
      if (e.target.checked) document.getElementById("end_date").value = "";
    });

    document.getElementById("execForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const payload = new URLSearchParams({
        member: document.getElementById("member").value,
        post: document.getElementById("post").value,
        start_date: document.getElementById("start_date").value,
        end_date: document.getElementById("end_date").value,
        is_current: document.getElementById("is_current").checked ? "on" : "",
      });

      try {
        const endpoint = isEdit ? `/executives/api/${id}/update/` : "/executives/api/create/";
        const data = await window.OYA_API.apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        });
        window.location.href = `executive-detail.html?id=${data.executive.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "executives", title: isEdit ? "Edit Executive" : "Add Executive" });
      if (!user) return;
      if (!user.is_superuser) {
        // Matches the original template's is_superuser gate on Add/Edit UI.
        showErrors(["Only a superuser can assign or edit executive positions."]);
        document.getElementById("execForm").style.display = "none";
        return;
      }

      if (isEdit) {
        document.getElementById("formTitle").textContent = "Edit Executive Position";
        document.getElementById("formSubtitle").textContent = "Update executive role and tenure details";
        document.getElementById("submitLabel").textContent = "Save Changes";
      }

      try {
        const metaEndpoint = isEdit ? `/executives/api/${id}/form-meta/` : "/executives/api/form-meta/";
        const meta = await window.OYA_API.apiFetch(metaEndpoint);
        const postSelect = document.getElementById("post");
        meta.post_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; postSelect.appendChild(o); });
        const memberSelect = document.getElementById("member");
        meta.available_members.forEach((m) => {
          const o = document.createElement("option");
          o.value = m.id;
          o.textContent = `${m.full_name} (${m.serial_number})${m.clan ? " - " + m.clan : ""}`;
          memberSelect.appendChild(o);
        });

        if (isEdit) {
          const { executive } = await window.OYA_API.apiFetch(`/executives/api/${id}/`);
          memberSelect.value = executive.member.id;
          postSelect.value = executive.post;
          document.getElementById("start_date").value = executive.start_date;
          document.getElementById("end_date").value = executive.end_date || "";
          document.getElementById("is_current").checked = executive.is_current;
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
