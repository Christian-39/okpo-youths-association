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

    document.getElementById("electionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const payload = new URLSearchParams({
        title: document.getElementById("title").value,
        start_date: document.getElementById("start_date").value,
        end_date: document.getElementById("end_date").value,
        status: document.getElementById("status").value,
        description: document.getElementById("description").value,
      });

      try {
        const endpoint = isEdit ? `/elections/api/${id}/update/` : "/elections/api/create/";
        const data = await window.OYA_API.apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        });
        window.location.href = `election-detail.html?id=${data.election.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "elections", title: isEdit ? "Edit Election" : "Create Election", requireExecutive: true });
      if (!user) return;

      const statusChoices = [["UPCOMING", "Upcoming"], ["ONGOING", "Ongoing"], ["COMPLETED", "Completed"], ["CANCELLED", "Cancelled"]];
      const sel = document.getElementById("status");
      statusChoices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });

      if (isEdit) {
        document.getElementById("formTitle").textContent = "Edit Election";
        try {
          const { election } = await window.OYA_API.apiFetch(`/elections/api/${id}/`);
          document.getElementById("title").value = election.title;
          document.getElementById("start_date").value = election.start_date ? election.start_date.slice(0, 16) : "";
          document.getElementById("end_date").value = election.end_date ? election.end_date.slice(0, 16) : "";
          sel.value = election.status;
          document.getElementById("description").value = election.description || "";
        } catch (err) {
          showErrors([err.message || "Couldn't load the election."]);
        }
      }
    })();
