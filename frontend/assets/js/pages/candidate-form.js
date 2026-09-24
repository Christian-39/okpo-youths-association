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

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const electionIdParam = params.get("election");
    const isEdit = !!id;

    document.getElementById("photo").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = document.getElementById("photoPreview");
      img.src = URL.createObjectURL(file);
      img.style.display = "";
    });

    document.getElementById("candidateForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const formData = new FormData(document.getElementById("candidateForm"));
      try {
        const endpoint = isEdit ? `/elections/api/candidates/${id}/update/` : "/elections/api/candidates/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        window.location.href = `election-detail.html?id=${data.candidate.election_id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "elections", title: isEdit ? "Edit Candidate" : "Add Candidate", requireExecutive: true });
      if (!user) return;

      try {
        const meta = await window.OYA_API.apiFetch("/elections/api/candidates/form-meta/");
        const memberSelect = document.getElementById("member");
        meta.members.forEach((m) => { const o = document.createElement("option"); o.value = m.id; o.textContent = `${m.full_name} (${m.serial_number})`; memberSelect.appendChild(o); });
        const postSelect = document.getElementById("post");
        meta.post_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; postSelect.appendChild(o); });

        const electionsData = await window.OYA_API.apiFetch("/elections/api/list/?status=UPCOMING");
        const ongoing = await window.OYA_API.apiFetch("/elections/api/list/?status=ONGOING");
        const electionSelect = document.getElementById("election");
        [...electionsData.elections, ...ongoing.elections].forEach((el) => {
          const o = document.createElement("option"); o.value = el.id; o.textContent = el.title; electionSelect.appendChild(o);
        });
        if (electionIdParam) electionSelect.value = electionIdParam;

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Candidate";
          try {
            const { candidate } = await window.OYA_API.apiFetch(`/elections/api/candidates/${id}/`);
            electionSelect.value = candidate.election_id;
            memberSelect.value = candidate.member.id;
            postSelect.value = candidate.post;
            document.getElementById("manifesto").value = candidate.manifesto || "";
            if (candidate.photo_url) {
              const img = document.getElementById("photoPreview");
              img.src = candidate.photo_url; img.style.display = "";
            }
          } catch (err) {
            showErrors([err.message || "Couldn't load the candidate."]);
          }
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
