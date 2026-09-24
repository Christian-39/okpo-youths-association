function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    (async function () {
      const user = await window.OYA_SHELL.init({ page: "finance", title: "Finance" });
      if (!user) return;
      try {
        const data = await window.OYA_API.apiFetch("/finance/api/expenses/?page=1");
        document.getElementById("kpiTreasury").textContent = naira(data.treasury_balance);
        document.getElementById("kpiIncome").textContent = naira(data.total_income);
        document.getElementById("kpiExpenses").textContent = naira(data.total_expenses);
        document.getElementById("kpiMonth").textContent = naira(data.this_month_expenses);
      } catch (err) {
        // These are financial figures — a silent blank "—" could be
        // mistaken for an actual zero balance, so this failure must be
        // visible, not hidden.
        window.OYA?.showToast("Finance figures are temporarily unavailable.", "error");
        document.getElementById("kpiRow").insertAdjacentHTML("afterend",
          `<div class="alert alert-danger" style="margin-bottom:1.5rem;">Couldn't load the figures above — they are not reliable right now. (${err.message || "network error"})</div>`);
      }
    })();
