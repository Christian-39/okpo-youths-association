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

    let searchDebounce;
    document.getElementById("memberSearch").addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const q = e.target.value.trim();
      const box = document.getElementById("memberResults");
      if (q.length < 1) { box.style.display = "none"; return; }
      searchDebounce = setTimeout(async () => {
        const data = await window.OYA_API.apiFetch(`/accounts/api/users/search/?q=${encodeURIComponent(q)}`);
        const results = data.results || [];
        box.innerHTML = results.length
          ? results.map((r) => `<button type="button" class="dropdown-item" data-id="${r.id}" data-name="${esc(r.text || r.full_name)}" style="width:100%;text-align:left;">${esc(r.text || r.full_name)}</button>`).join("")
          : `<div class="dropdown-item">No matches</div>`;
        box.style.display = "";
        box.querySelectorAll("[data-id]").forEach((btn) => btn.addEventListener("click", () => {
          document.getElementById("member").value = btn.dataset.id;
          document.getElementById("memberSelectedName").textContent = btn.dataset.name;
          document.getElementById("memberSelected").style.display = "";
          document.getElementById("memberSearch").style.display = "none";
          box.style.display = "none";
        }));
      }, 300);
    });
    document.getElementById("memberClear").addEventListener("click", () => {
      document.getElementById("member").value = "";
      document.getElementById("memberSelected").style.display = "none";
      document.getElementById("memberSearch").style.display = "";
      document.getElementById("memberSearch").value = "";
    });

    document.getElementById("incomeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);

      const payload = {
        income_type: document.getElementById("income_type").value,
        amount: document.getElementById("amount").value,
        reason: document.getElementById("reason").value,
        member: document.getElementById("member").value || null,
        paid_by: document.getElementById("paid_by").value,
      };

      try {
        await window.OYA_API.apiFetch("/finance/api/donations/create/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        });
        window.location.href = "contributions.html";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "contributions", title: "Record Contribution", requireExecutive: true });
      if (!user) return;

      // Income type choices (all except DUES — dues are recorded through
      // the dedicated dues tracker, which keeps the original allocation rules).
      const choices = [
        ["DONATION", "Donation / Contribution"],
        ["EVENT", "Event Fee"],
        ["CASE_FINE", "Case Fine / Resolution"],
        ["OTHER", "Other"],
      ];
      const sel = document.getElementById("income_type");
      choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });

      try {
        const expenseData = await window.OYA_API.apiFetch("/finance/api/expenses/?page=1");
        document.getElementById("treasuryBalance").textContent = naira(expenseData.treasury_balance);
      } catch (err) {
        window.OYA?.showToast("Treasury balance is temporarily unavailable.", "warning");
        document.getElementById("treasuryBalance").textContent = "unavailable";
      }
    })();
