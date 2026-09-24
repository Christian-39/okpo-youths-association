function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

    // Mirrors members/models.py's NIGERIAN_STATES list.
    const NIGERIAN_STATES = [
      "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
      "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT - Abuja","Gombe",
      "Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
      "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
      "Taraba","Yobe","Zamfara",
    ];

    const params = new URLSearchParams(window.location.search);
    const memberId = params.get("id");
    const isEdit = !!memberId;

    function toggleAbroadFields() {
      const abroad = document.getElementById("is_abroad").checked;
      document.getElementById("nigerianStateGroup").style.display = abroad ? "none" : "";
      document.getElementById("abroadCountryGroup").style.display = abroad ? "" : "none";
    }

    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") {
        Object.entries(errors).forEach(([field, msgs]) => {
          (Array.isArray(msgs) ? msgs : [msgs]).forEach((m) => lines.push(`${field}: ${m.message || m}`));
        });
      }
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }

    function showPin(pin, label) {
      if (!pin) return;
      const box = document.getElementById("pinNotice");
      box.innerHTML = `<div class="alert alert-success">${label}: <strong style="font-size:1.125rem;letter-spacing:0.1em;">${esc(pin)}</strong> — save this, it won't be shown again.</div>`;
      box.style.display = "";
    }

    async function loadMetaAndMember() {
      // Reuse the existing list endpoint for clan options + status choices
      // rather than adding a separate metadata endpoint.
      const listData = await window.OYA_API.apiFetch("/members/api/list/?page=1");
      const clanSelect = document.getElementById("umu_nna_clan");
      listData.clans.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id; opt.textContent = c.name;
        clanSelect.appendChild(opt);
      });
      const statusSelect = document.getElementById("status");
      listData.status_choices.forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = label;
        statusSelect.appendChild(opt);
      });

      const stateSelect = document.getElementById("nigerian_state");
      NIGERIAN_STATES.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s; opt.textContent = s;
        stateSelect.appendChild(opt);
      });

      if (isEdit) {
        document.getElementById("formTitle").textContent = "Edit Member";
        document.getElementById("pin").placeholder = "Leave blank to keep current PIN";
        const { member } = await window.OYA_API.apiFetch(`/members/api/${memberId}/`);
        document.getElementById("serial_number").value = member.serial_number || "";
        document.getElementById("full_name").value = member.full_name || "";
        document.getElementById("phone").value = member.phone || "";
        document.getElementById("age").value = member.age != null ? member.age : "";
        document.getElementById("year_joined").value = member.year_joined || "";
        if (member.clan) clanSelect.value = member.clan.id;
        statusSelect.value = member.status;
        if (member.photo_url) {
          const img = document.getElementById("photoPreview");
          img.src = member.photo_url; img.style.display = "";
        }
        toggleAbroadFields();
      } else {
        document.getElementById("year_joined").value = new Date().getFullYear();
      }
    }

    document.getElementById("is_abroad").addEventListener("change", toggleAbroadFields);
    document.getElementById("photo").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = document.getElementById("photoPreview");
      img.src = URL.createObjectURL(file);
      img.style.display = "";
    });

    document.getElementById("memberForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const form = document.getElementById("memberForm");
      const formData = new FormData(form);
      // Checkbox only appears in FormData when checked — normalize.
      if (!document.getElementById("is_abroad").checked) formData.set("is_abroad", "");

      try {
        const endpoint = isEdit ? `/members/api/${memberId}/update/` : "/members/api/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        const pin = data.generated_pin || data.updated_pin;
        if (pin) {
          showPin(pin, isEdit ? "Updated PIN" : "Generated PIN");
          setTimeout(() => { window.location.href = `member-detail.html?id=${data.member.id}`; }, 3500);
        } else {
          window.location.href = `member-detail.html?id=${data.member.id}`;
        }
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "members", title: isEdit ? "Edit Member" : "Add Member", requireExecutive: true });
      if (!user) return;
      try {
        await loadMetaAndMember();
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
