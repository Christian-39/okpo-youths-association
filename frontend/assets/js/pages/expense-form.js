function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }

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

    document.getElementById("expenseForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const formData = new FormData(document.getElementById("expenseForm"));
      try {
        await window.OYA_API.apiFetch("/finance/api/expenses/create/", { method: "POST", body: formData });
        window.location.href = "expenses.html";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "expenses", title: "Record Expense", requireExecutive: true });
      if (!user) return;

      const choices = [
        ["ADMINISTRATIVE", "Administrative"], ["PROJECT", "Project"], ["EVENT", "Event"],
        ["MAINTENANCE", "Maintenance"], ["SALARY", "Salary"], ["OTHER", "Other"],
      ];
      const sel = document.getElementById("category");
      choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });

      try {
        const data = await window.OYA_API.apiFetch("/finance/api/expenses/?page=1");
        document.getElementById("treasuryBalance").textContent = naira(data.treasury_balance);
      } catch (err) {
        window.OYA?.showToast("Treasury balance is temporarily unavailable.", "warning");
        document.getElementById("treasuryBalance").textContent = "unavailable";
      }
    })();
