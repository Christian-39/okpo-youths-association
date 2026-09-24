const id = new URLSearchParams(location.search).get("id");
    const esc = (v) => { const n = document.createElement("span"); n.textContent = v == null ? "" : String(v); return n.innerHTML; };
    const errorBox = document.getElementById("formErrors");
    function showErrors(errors) {
      const list = [];
      if (errors && typeof errors === "object" && !Array.isArray(errors)) Object.values(errors).forEach((items) => list.push(...(Array.isArray(items) ? items : [items])));
      else if (Array.isArray(errors)) list.push(...errors); else if (errors) list.push(errors);
      errorBox.innerHTML = list.map((item) => `<div>${esc(item)}</div>`).join(""); errorBox.hidden = !list.length;
    }
    function setValue(name, value) { const el = document.getElementById(name); if (el && value != null) el.value = value; }
    (async function () {
      const user = await window.OYA_SHELL.init({ page: "handover", title: id ? "Edit Handover" : "Create Handover", requireExecutive: true }); if (!user) return;
      if (!user.has_admin_access) document.getElementById("cashGroup").hidden = true;
      try {
        const [meta, detail] = await Promise.all([
          window.OYA_API.apiFetch("/elections/api/handovers/form-meta/"),
          id ? window.OYA_API.apiFetch(`/elections/api/handovers/${encodeURIComponent(id)}/`) : Promise.resolve(null),
        ]);
        const election = document.getElementById("election"), executive = document.getElementById("executive");
        (meta.elections || []).forEach((item) => election.insertAdjacentHTML("beforeend", `<option value="${item.id}">${esc(item.title)} (${esc(item.status)})</option>`));
        (meta.executives || []).forEach((item) => executive.insertAdjacentHTML("beforeend", `<option value="${item.id}">${esc(item.full_name)} — ${esc(item.post)}</option>`));
        if (detail && detail.handover) {
          document.getElementById("pageHeading").textContent = "Edit Handover Ledger";
          const h = detail.handover; setValue("election", h.election && h.election.id); setValue("executive", h.executive && h.executive.id); setValue("cash_remaining", h.cash_remaining); setValue("assets_description", h.assets_description); setValue("notes", h.notes);
        }
      } catch (error) { showErrors(error.message); return; }
      document.getElementById("handoverForm").addEventListener("submit", async (event) => {
        event.preventDefault(); showErrors([]); const button = document.getElementById("saveButton"); button.disabled = true; button.textContent = "Saving…";
        try {
          const data = await window.OYA_API.apiFetch(id ? `/elections/api/handovers/${encodeURIComponent(id)}/update/` : "/elections/api/handovers/create/", { method: "POST", body: new FormData(event.currentTarget), retries: 0 });
          window.OYA.showToast("Handover ledger saved.", "success"); window.setTimeout(() => location.assign(`handover-detail.html?id=${data.handover.id}`), 350);
        } catch (error) { showErrors(error.data && error.data.errors ? error.data.errors : error.message); button.disabled = false; button.textContent = "Save handover"; }
      });
    })();
