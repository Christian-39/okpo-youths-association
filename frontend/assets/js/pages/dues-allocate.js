function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function naira(n) { return "\u20A6" + Math.round(Number(n) || 0).toLocaleString("en-NG"); }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") Object.entries(errors).forEach(([f, m]) => (Array.isArray(m) ? m : [m]).forEach((x) => lines.push(`${f}: ${x.message || x}`)));
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
        box.querySelectorAll("[data-id]").forEach((btn) => btn.addEventListener("click", async () => {
          document.getElementById("member").value = btn.dataset.id;
          document.getElementById("memberSearch").value = btn.dataset.name;
          box.style.display = "none";
          await loadPreview(btn.dataset.id);
        }));
      }, 300);
    });

    async function loadPreview(memberId) {
      const box = document.getElementById("outstandingPreview");
      try {
        const data = await window.OYA_API.apiFetch(`/finance/api/dues/preview/?member_id=${memberId}`);
        if (!data.outstanding.length) {
          box.innerHTML = `<span style="color:var(--oya-success);">This member has no outstanding dues.</span>`;
        } else {
          box.innerHTML = `<strong>Outstanding years:</strong> ` + data.outstanding.map((o) => `${o.year} (${naira(o.remaining_balance)} owed)`).join(", ");
        }
        box.style.display = "";
      } catch (err) {
        window.OYA?.showToast("Couldn't load the outstanding dues preview.", "error");
        box.innerHTML = `<span style="color:var(--oya-danger);">Couldn't load this member's outstanding dues — you can still enter an amount, but verify the years manually.</span>`;
        box.style.display = "";
      }
    }

    document.getElementById("allocateForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      document.getElementById("resultBox").style.display = "none";

      const payload = new URLSearchParams({
        member: document.getElementById("member").value,
        total_amount: document.getElementById("total_amount").value,
        payment_method: document.getElementById("payment_method").value,
        receipt_reference: document.getElementById("receipt_reference").value,
        payment_date: document.getElementById("payment_date").value,
        notes: document.getElementById("notes").value,
      });

      try {
        const data = await window.OYA_API.apiFetch("/finance/api/dues/allocate/", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload.toString(),
        });
        const summary = data.allocations.map((a) => `${a.year}: ${naira(a.allocated)}`).join(", ");
        const resultBox = document.getElementById("resultBox");
        resultBox.className = "alert alert-success";
        resultBox.innerHTML = `Allocated ${naira(data.total_allocated)} across: ${summary}.` + (data.remaining > 0 ? ` ${naira(data.remaining)} could not be allocated.` : "");
        resultBox.style.display = "";
        document.getElementById("allocateForm").reset();
        document.getElementById("outstandingPreview").style.display = "none";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || [err.data.detail].filter(Boolean));
        else showErrors([err.message || "Something went wrong."]);
      } finally {
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "dues", title: "Record Dues Payment", requireExecutive: true });
      if (!user) return;
      try {
        const meta = await window.OYA_API.apiFetch("/finance/api/dues/allocate/form-meta/");
        const sel = document.getElementById("payment_method");
        meta.payment_method_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
        document.getElementById("payment_date").value = new Date().toISOString().slice(0, 10);
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
