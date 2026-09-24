/* ================================================================
   CATEGORIES PAGE
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "category-cancel" ||
        e.target.id === "category-modal-close" ||
        e.target.id === "category-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeCategoryModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("category-modal");
        if (modal && !modal.hidden) _closeCategoryModal();
    }
});

function _closeCategoryModal() {
    const modal = document.getElementById("category-modal");
    if (!modal) return;
    modal.hidden = true;
    const idField = document.getElementById("category-id");
    if (idField) idField.value = "";
    const errBox = document.getElementById("category-form-error");
    if (errBox) errBox.hidden = true;
}

function _openCategoryModal(title) {
    const modal = document.getElementById("category-modal");
    if (!modal) return;
    const t = document.getElementById("category-modal-title");
    if (t) t.textContent = title;
    const errBox = document.getElementById("category-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initCategories() {
    const body = document.getElementById("categories-body");
    if (!body) return;

    const errBox = document.getElementById("category-form-error");
    const addBtn = document.getElementById("add-category-btn");
    const saveBtn = document.getElementById("category-save");

    async function load() {
        const res = await API.get("/api/categories");
        if (!res.ok || !res.data.success) {
            body.innerHTML = '<tr><td colspan="4" class="empty">Failed to load</td></tr>';
            return;
        }
        const rows = res.data.categories;
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="4" class="empty">No categories</td></tr>';
            return;
        }
        body.innerHTML = rows.map((c) => `
            <tr>
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.description || "")}</td>
                <td>${c.product_count}</td>
                <td>
                    <button class="btn btn-small" data-edit="${c.id}">Edit</button>
                    <button class="btn btn-small btn-danger" data-del="${c.id}">Delete</button>
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
        _closeCategoryModal();
        _openCategoryModal("Add Category");
    }

    function openEdit(c) {
        _closeCategoryModal();
        document.getElementById("category-id").value = c.id;
        document.getElementById("c-name").value = c.name;
        document.getElementById("c-description").value = c.description || "";
        _openCategoryModal("Edit Category");
    }

    async function remove(id) {
        if (!confirmAction("Delete this category?")) return;
        const res = await API.del(`/api/categories/${id}`);
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
            const id = document.getElementById("category-id").value;
            const payload = {
                name: document.getElementById("c-name").value.trim(),
                description: document.getElementById("c-description").value.trim() || null,
            };
            const res = id ?
                await API.put(`/api/categories/${id}`, payload) :
                await API.post("/api/categories", payload);

            if (res.ok && res.data.success) {
                showToast(id ? "Updated" : "Created", "success");
                _closeCategoryModal();
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