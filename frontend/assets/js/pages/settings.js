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

    document.getElementById("logo").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = document.getElementById("logoPreview");
      img.src = URL.createObjectURL(file);
      img.style.display = "";
    });

    document.getElementById("settingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      document.getElementById("successBox").style.display = "none";

      const formData = new FormData(document.getElementById("settingsForm"));
      try {
        await window.OYA_API.apiFetch("/settings/api/settings/update/", { method: "POST", body: formData });
        document.getElementById("successBox").style.display = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
      } finally {
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "settings", title: "Settings", requireExecutive: true });
      if (!user) return;

      try {
        const { settings } = await window.OYA_API.apiFetch("/settings/api/settings/");
        document.getElementById("association_name").value = settings.association_name;
        document.getElementById("motto").value = settings.motto;
        document.getElementById("yearly_dues").value = settings.yearly_dues;
        document.getElementById("minimum_age").value = settings.minimum_age;
        document.getElementById("past_member_age").value = settings.past_member_age;
        document.getElementById("primary_color").value = settings.primary_color;
        document.getElementById("accent_color").value = settings.accent_color;
        if (settings.logo_url) { document.getElementById("logoPreview").src = settings.logo_url; document.getElementById("logoPreview").style.display = ""; }

        const themeSelect = document.getElementById("theme_mode");
        settings.theme_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; themeSelect.appendChild(o); });
        themeSelect.value = settings.theme_mode;
      } catch (err) {
        showErrors([err.message || "Couldn't load settings."]);
      }
    })();
