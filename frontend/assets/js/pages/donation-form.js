function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
    function showErrors(errors) {
      const box = document.getElementById("formErrorsBox");
      const lines = [];
      if (Array.isArray(errors)) lines.push(...errors);
      else if (errors && typeof errors === "object") Object.entries(errors).forEach(([f, m]) => (Array.isArray(m) ? m : [m]).forEach((x) => lines.push(`${f}: ${x.message || x}`)));
      box.innerHTML = lines.map((m) => `<div class="alert alert-danger" style="margin-bottom:0.5rem;">${esc(m)}</div>`).join("");
      box.style.display = lines.length ? "" : "none";
    }
    const id = new URLSearchParams(window.location.search).get("id");
    const isEdit = !!id;

    function toggleDonorTypeFields() {
      const isOutside = document.getElementById("donor_type").value === "OUTSIDE";
      document.getElementById("memberGroup").style.display = isOutside ? "none" : "";
      document.getElementById("outsideDonorGroup").style.display = isOutside ? "" : "none";
    }
    function toggleDonationTypeFields() {
      const type = document.getElementById("donation_type").value;
      document.getElementById("moneyFields").style.display = type === "MONEY" ? "flex" : "none";
      document.getElementById("materialFields").style.display = type === "MATERIAL" ? "flex" : "none";
      document.getElementById("labourFields").style.display = type === "LABOUR" ? "flex" : "none";
      document.getElementById("estimatedValueGroup").style.display = (type === "MATERIAL" || type === "LABOUR") ? "flex" : "none";
      document.getElementById("updateTreasuryGroup").style.display = type === "MATERIAL" ? "" : "none";
      document.getElementById("paymentMethodGroup").style.display = type === "MONEY" ? "" : "none";
    }
    document.getElementById("donor_type").addEventListener("change", toggleDonorTypeFields);
    document.getElementById("donation_type").addEventListener("change", toggleDonationTypeFields);

    function wireMemberSearch(searchInputId, hiddenInputId, resultsId) {
      let debounce;
      document.getElementById(searchInputId).addEventListener("input", (e) => {
        clearTimeout(debounce);
        const q = e.target.value.trim();
        const box = document.getElementById(resultsId);
        if (q.length < 1) { box.style.display = "none"; return; }
        debounce = setTimeout(async () => {
          try {
            const data = await window.OYA_API.apiFetch(`/accounts/api/users/search/?q=${encodeURIComponent(q)}`);
            const results = data.results || [];
            box.innerHTML = results.length
              ? results.map((r) => `<button type="button" class="dropdown-item" data-id="${r.id}" data-name="${esc(r.full_name)} (${esc(r.serial_number)})" style="width:100%;text-align:left;">${esc(r.full_name)} (${esc(r.serial_number)})</button>`).join("")
              : `<div class="dropdown-item">No matches</div>`;
            box.style.display = "";
            box.querySelectorAll("[data-id]").forEach((btn) => btn.addEventListener("click", () => {
              document.getElementById(hiddenInputId).value = btn.dataset.id;
              document.getElementById(searchInputId).value = btn.dataset.name;
              box.style.display = "none";
            }));
          } catch (err) { /* ignore transient search errors */ }
        }, 300);
      });
    }
    wireMemberSearch("memberSearch", "member", "memberResults");
    wireMemberSearch("invitedBySearch", "invited_by", "invitedByResults");

    document.getElementById("donationForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      showErrors([]);
      const formData = new FormData(document.getElementById("donationForm"));
      if (!document.getElementById("update_treasury").checked) formData.set("update_treasury", "");
      try {
        const endpoint = isEdit ? `/project-donations/api/donations/${id}/update/` : "/project-donations/api/donations/create/";
        const data = await window.OYA_API.apiFetch(endpoint, { method: "POST", body: formData });
        window.location.href = "donations.html";
      } catch (err) {
        if (err.status === 400 && err.data) showErrors(err.data.errors || err.data);
        else showErrors([err.message || "Something went wrong."]);
        btn.disabled = false;
      }
    });

    (async function () {
      const user = await window.OYA_SHELL.init({ page: "donations", title: isEdit ? "Edit Donation" : "Record Donation", requireExecutive: true });
      if (!user) return;

      try {
        const meta = await window.OYA_API.apiFetch("/project-donations/api/donations/form-meta/");
        const projSel = document.getElementById("project");
        meta.projects.forEach((p) => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.title; projSel.appendChild(o); });
        const donorTypeSel = document.getElementById("donor_type");
        meta.donor_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; donorTypeSel.appendChild(o); });
        const outsideSel = document.getElementById("outside_donor");
        meta.outside_donors.forEach((d) => { const o = document.createElement("option"); o.value = d.id; o.textContent = d.full_name; outsideSel.appendChild(o); });
        const typeSel = document.getElementById("donation_type");
        meta.donation_type_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; typeSel.appendChild(o); });
        const paySel = document.getElementById("payment_method");
        meta.payment_method_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; paySel.appendChild(o); });
        const statusSel = document.getElementById("status");
        meta.status_choices.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; statusSel.appendChild(o); });

        toggleDonorTypeFields();
        toggleDonationTypeFields();

        if (isEdit) {
          document.getElementById("formTitle").textContent = "Edit Donation";
          const { donation } = await window.OYA_API.apiFetch(`/project-donations/api/donations/${id}/`);
          if (donation.project) projSel.value = donation.project.id;
          donorTypeSel.value = donation.donor_type;
          if (donation.donor_type === "MEMBER" && donation.member) {
            document.getElementById("member").value = donation.member.id;
            document.getElementById("memberSearch").value = donation.member.full_name;
          } else if (donation.donor_type === "OUTSIDE" && donation.outside_donor) {
            outsideSel.value = donation.outside_donor.id;
          }
          if (donation.invited_by) {
            document.getElementById("invited_by").value = donation.invited_by.id;
            document.getElementById("invitedBySearch").value = donation.invited_by.full_name;
          }
          typeSel.value = donation.donation_type;
          document.getElementById("amount").value = donation.amount || "";
          document.getElementById("material_name").value = donation.material_name || "";
          document.getElementById("quantity").value = donation.quantity || "";
          document.getElementById("labour_type").value = donation.labour_type || "";
          document.getElementById("number_of_days").value = donation.number_of_days || "";
          document.getElementById("estimated_value").value = donation.estimated_value || "";
          document.getElementById("update_treasury").checked = !!donation.update_treasury;
          document.getElementById("narration").value = donation.narration || "";
          document.getElementById("remarks").value = donation.remarks || "";
          paySel.value = donation.payment_method;
          document.getElementById("reference_number").value = donation.reference_number || "";
          statusSel.value = donation.status;
          document.getElementById("donation_date").value = donation.donation_date;
          toggleDonorTypeFields();
          toggleDonationTypeFields();
        } else {
          document.getElementById("donation_date").value = new Date().toISOString().slice(0, 10);
        }
      } catch (err) {
        showErrors([err.message || "Couldn't load the form."]);
      }
    })();
