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

    function toggleFundraisingFields() {
      document.getElementById("fundraisingFields").style.display = document.getElementById("enable_fundraising").checked ? "flex" : "none";
    }
    document.getElementById("enable_fundraising").addEventListener("change", toggleFundraisingFields);

    document.getElementById("projectForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const payload = new URLSearchParams({
        title: document.getElementById("title").value,
        budget: document.getElementById("budget").value,
        description: document.getElementById("description").value,
        status: document.getElementById("status").value,
        progress_percentage: document.getElementById("progress_percentage").value || "0",
        enable_fundraising: document.getElementById("enable_fundraising").checked ? "on" : "",
        target_amount: document.getElementById("target_amount").value || "0",
        fundraising_start_date: document.getElementById("fundraising_start_date").value,
        fundraising_end_date: document.getElementById("fundraising_end_date").value,
        fundraising_status: document.getElementById("fundraising_status").value,
        include_in_group_reports: document.getElementById("include_in_group_reports").checked ? "on" : "",
      });

      try {
        const endpoint = isEdit ? `/projects/api/${id}/update/` : "/projects/api/create/";
        const data = await window.OYA_API.apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
        });
        window.location.href = `project-detail.html?id=${data.project.id}`;
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "projects", title: isEdit ? "Edit Project" : "Create Project", requireExecutive: true });
      if (!user) return;

      const statusChoices = [["FUTURE", "Future"], ["AT_HAND", "At Hand"], ["FINISHED", "Finished"]];
      const statusSelect = document.getElementById("status");
      statusChoices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSelect.appendChild(o); });

      const fundraisingStatusChoices = [["UPCOMING", "Upcoming"], ["ACTIVE", "Active"], ["CLOSED", "Closed"]];
      const fsSelect = document.getElementById("fundraising_status");
      fundraisingStatusChoices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; fsSelect.appendChild(o); });

      if (isEdit) {
        document.getElementById("formTitle").textContent = "Update Project";
        try {
          const data = await window.OYA_API.apiFetch(`/projects/api/${id}/`);
          const p = data.project;
          document.getElementById("title").value = p.title;
          document.getElementById("budget").value = p.budget;
          document.getElementById("description").value = p.description || "";
          statusSelect.value = p.status;
          document.getElementById("progress_percentage").value = p.progress_percentage;
          document.getElementById("enable_fundraising").checked = p.enable_fundraising;
          document.getElementById("target_amount").value = p.target_amount;
          document.getElementById("fundraising_start_date").value = p.fundraising_start_date || "";
          document.getElementById("fundraising_end_date").value = p.fundraising_end_date || "";
          fsSelect.value = p.fundraising_status;
          document.getElementById("include_in_group_reports").checked = p.include_in_group_reports;
          toggleFundraisingFields();
        } catch (err) {
          showErrors([err.message || "Couldn't load the project."]);
        }
      }
    })();
