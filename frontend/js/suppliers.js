/* ================================================================
   SUPPLIERS PAGE
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "supplier-cancel" ||
        e.target.id === "supplier-modal-close" ||
        e.target.id === "supplier-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeSupplierModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("supplier-modal");
        if (modal && !modal.hidden) _closeSupplierModal();
    }
});

function _closeSupplierModal() {
    const modal = document.getElementById("supplier-modal");
    if (!modal) return;
    modal.hidden = true;
    const idField = document.getElementById("supplier-id");
    if (idField) idField.value = "";
    const errBox = document.getElementById("supplier-form-error");
    if (errBox) errBox.hidden = true;
}

function _openSupplierModal(title) {
    const modal = document.getElementById("supplier-modal");
    if (!modal) return;
    const t = document.getElementById("supplier-modal-title");
    if (t) t.textContent = title;
    const errBox = document.getElementById("supplier-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initSuppliers() {
    const body = document.getElementById("suppliers-body");
    if (!body) return;

    const errBox = document.getElementById("supplier-form-error");
    const addBtn = document.getElementById("add-supplier-btn");
    const saveBtn = document.getElementById("supplier-save");

    async function load() {
        const res = await API.get("/api/suppliers");
        if (!res.ok || !res.data.success) {
            body.innerHTML = '<tr><td colspan="6" class="empty">Failed to load</td></tr>';
            return;
        }
        const rows = res.data.suppliers;
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty">No suppliers</td></tr>';
            return;
        }
        body.innerHTML = rows.map((s) => `
            <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.contact_person || "")}</td>
                <td>${escapeHtml(s.email || "")}</td>
                <td>${escapeHtml(s.phone || "")}</td>
                <td>${s.product_count}</td>
                <td>
                    <button class="btn btn-small" data-edit="${s.id}">Edit</button>
                    <button class="btn btn-small btn-danger" data-del="${s.id}">Delete</button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll("[data-edit]").forEach((b) =>
            b.addEventListener("click", () =>
                openEdit(rows.find((x) => x.id == b.dataset.edit))
            )
        );
        body.querySelectorAll("[data-del]").forEach((b) =>
            b.addEventListener("click", () => remove(parseInt(b.dataset.del, 10)))
        );
    }

    function openAdd() {
        _closeSupplierModal();
        _openSupplierModal("Add Supplier");
    }

    function openEdit(s) {
        _closeSupplierModal();
        document.getElementById("supplier-id").value = s.id;
        document.getElementById("s-name").value = s.name;
        document.getElementById("s-contact").value = s.contact_person || "";
        document.getElementById("s-email").value = s.email || "";
        document.getElementById("s-phone").value = s.phone || "";
        document.getElementById("s-address").value = s.address || "";
        document.getElementById("s-notes").value = s.notes || "";
        _openSupplierModal("Edit Supplier");
    }

    async function remove(id) {
        if (!confirmAction("Delete this supplier?")) return;
        const res = await API.del(`/api/suppliers/${id}`);
        if (res.ok && res.data.success) {
            showToast("Deleted", "success");
            load();
        } else {
            showToast((res.data && res.data.message) || "Delete failed", "error");
        }
    }

    if (addBtn) addBtn.addEventListener("click", openAdd);

    if (saveBtn) {
        saveBtn.addEventListener("click", async() => {
            if (errBox) errBox.hidden = true;
            const id = document.getElementById("supplier-id").value;
            const payload = {
                name: document.getElementById("s-name").value.trim(),
                contact_person: document.getElementById("s-contact").value.trim() || null,
                email: document.getElementById("s-email").value.trim() || null,
                phone: document.getElementById("s-phone").value.trim() || null,
                address: document.getElementById("s-address").value.trim() || null,
                notes: document.getElementById("s-notes").value.trim() || null,
            };
            const res = id ?
                await API.put(`/api/suppliers/${id}`, payload) :
                await API.post("/api/suppliers", payload);

            if (res.ok && res.data.success) {
                showToast(id ? "Updated" : "Created", "success");
                _closeSupplierModal();
                load();
            } else {
                if (errBox) {
                    errBox.textContent = (res.data && res.data.message) || "Save failed";
                    errBox.hidden = false;
                }
            }
        });
    }

    await load();
})();