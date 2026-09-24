/* ================================================================
   CUSTOMERS PAGE
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "customer-cancel" ||
        e.target.id === "customer-modal-close" ||
        e.target.id === "customer-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeCustomerModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("customer-modal");
        if (modal && !modal.hidden) _closeCustomerModal();
    }
});

function _closeCustomerModal() {
    const modal = document.getElementById("customer-modal");
    if (!modal) return;
    modal.hidden = true;
    const idField = document.getElementById("customer-id");
    if (idField) idField.value = "";
    const errBox = document.getElementById("customer-form-error");
    if (errBox) errBox.hidden = true;
}

function _openCustomerModal(title) {
    const modal = document.getElementById("customer-modal");
    if (!modal) return;
    const t = document.getElementById("customer-modal-title");
    if (t) t.textContent = title;
    const errBox = document.getElementById("customer-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initCustomers() {
    const body = document.getElementById("customers-body");
    if (!body) return;

    let customers = [];

    // ---------- LOAD ----------
    async function load() {
        body.innerHTML = `<tr><td colspan="6" class="empty">Loading…</td></tr>`;

        // Load from localStorage
        customers = JSON.parse(localStorage.getItem("sms-customers") || "[]");

        if (!customers.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty">No customers yet. Click "Add Customer" to create one.</td></tr>`;
            return;
        }

        renderRows(customers);
    }

    function renderRows(rows) {
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty">No matching customers</td></tr>`;
            return;
        }

        body.innerHTML = rows.map((c) => `
            <tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.email || "—")}</td>
                <td>${escapeHtml(c.phone || "—")}</td>
                <td>${escapeHtml(c.address || "—")}</td>
                <td>₱${Number(c.total_purchases || 0).toFixed(2)}</td>
                <td>
                    <button class="btn btn-small" data-edit="${c.id}">Edit</button>
                    <button class="btn btn-small btn-danger" data-del="${c.id}">Delete</button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll("[data-edit]").forEach((b) => {
            b.addEventListener("click", () => openEdit(b.dataset.edit));
        });
        body.querySelectorAll("[data-del]").forEach((b) => {
            b.addEventListener("click", () => remove(b.dataset.del));
        });
    }

    // ---------- ADD / EDIT ----------
    function openAdd() {
        _closeCustomerModal();
        document.getElementById("customer-id").value = "";
        document.getElementById("c-name").value = "";
        document.getElementById("c-email").value = "";
        document.getElementById("c-phone").value = "";
        document.getElementById("c-address").value = "";
        document.getElementById("c-notes").value = "";
        _openCustomerModal("Add Customer");
    }

    function openEdit(id) {
        const c = customers.find((x) => String(x.id) === String(id));
        if (!c) return;
        _closeCustomerModal();
        document.getElementById("customer-id").value = c.id;
        document.getElementById("c-name").value = c.name || "";
        document.getElementById("c-email").value = c.email || "";
        document.getElementById("c-phone").value = c.phone || "";
        document.getElementById("c-address").value = c.address || "";
        document.getElementById("c-notes").value = c.notes || "";
        _openCustomerModal("Edit Customer");
    }

    // ---------- SAVE ----------
    const saveBtn = document.getElementById("customer-save");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const errBox = document.getElementById("customer-form-error");
            if (errBox) errBox.hidden = true;

            const id = document.getElementById("customer-id").value;
            const name = document.getElementById("c-name").value.trim();

            if (!name) {
                if (errBox) {
                    errBox.textContent = "Name is required";
                    errBox.hidden = false;
                }
                return;
            }

            const payload = {
                id: id || "CUST-" + Date.now(),
                name,
                email: document.getElementById("c-email").value.trim() || null,
                phone: document.getElementById("c-phone").value.trim() || null,
                address: document.getElementById("c-address").value.trim() || null,
                notes: document.getElementById("c-notes").value.trim() || null,
                total_purchases: 0,
            };

            if (id) {
                const idx = customers.findIndex((x) => String(x.id) === String(id));
                if (idx >= 0) {
                    payload.total_purchases = customers[idx].total_purchases || 0;
                    customers[idx] = payload;
                }
            } else {
                customers.unshift(payload);
            }

            localStorage.setItem("sms-customers", JSON.stringify(customers));
            showToast(id ? "Customer updated" : "Customer added", "success");
            _closeCustomerModal();
            load();
        });
    }

    // ---------- DELETE ----------
    function remove(id) {
        if (!confirmAction("Delete this customer?")) return;
        customers = customers.filter((c) => String(c.id) !== String(id));
        localStorage.setItem("sms-customers", JSON.stringify(customers));
        showToast("Customer deleted", "success");
        load();
    }

    // ---------- SEARCH ----------
    const searchInput = document.getElementById("customer-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) {
                renderRows(customers);
                return;
            }
            const filtered = customers.filter((c) =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.email || "").toLowerCase().includes(q) ||
                (c.phone || "").toLowerCase().includes(q)
            );
            renderRows(filtered);
        });
    }

    // ---------- ADD BUTTON ----------
    const addBtn = document.getElementById("add-customer-btn");
    if (addBtn) addBtn.addEventListener("click", openAdd);

    await load();
})();