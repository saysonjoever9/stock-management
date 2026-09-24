/* ================================================================
   PRODUCTS PAGE
   ================================================================ */

// ============================================================
// GLOBAL EVENT DELEGATION — walay timing issues
// ============================================================
document.addEventListener("click", function(e) {
    // Cancel button
    if (e.target && e.target.id === "product-cancel") {
        e.preventDefault();
        e.stopPropagation();
        _closeProductModal();
        return false;
    }
    // X (close) button
    if (e.target && e.target.id === "product-modal-close") {
        e.preventDefault();
        e.stopPropagation();
        _closeProductModal();
        return false;
    }
    // Backdrop click — only close if clicking the backdrop itself
    if (e.target && e.target.id === "product-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeProductModal();
        return false;
    }
});

// Escape key — global listener
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("product-modal");
        if (modal && !modal.hidden) {
            _closeProductModal();
        }
    }
});

// Helper functions
function _closeProductModal() {
    const modal = document.getElementById("product-modal");
    if (!modal) return;
    modal.hidden = true;

    // Reset fields
    const fields = [
        "product-id", "p-sku", "p-barcode", "p-name", "p-description",
        "p-category", "p-supplier", "p-unit", "p-cost", "p-sell",
        "p-stock", "p-min", "p-max"
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.tagName !== "SELECT") el.value = "";
    });
    const pCat = document.getElementById("p-category");
    const pSup = document.getElementById("p-supplier");
    const pStat = document.getElementById("p-status");
    if (pCat) pCat.value = "";
    if (pSup) pSup.value = "";
    if (pStat) pStat.value = "active";
    const unit = document.getElementById("p-unit");
    if (unit) unit.value = "pcs";
    const cost = document.getElementById("p-cost");
    const sell = document.getElementById("p-sell");
    const stock = document.getElementById("p-stock");
    const min = document.getElementById("p-min");
    const max = document.getElementById("p-max");
    if (cost) cost.value = "0";
    if (sell) sell.value = "0";
    if (stock) stock.value = "0";
    if (min) min.value = "0";
    if (max) max.value = "0";

    const errBox = document.getElementById("product-form-error");
    if (errBox) errBox.hidden = true;
}

function _openProductModal(title) {
    const modal = document.getElementById("product-modal");
    if (!modal) return;
    const titleEl = document.getElementById("product-modal-title");
    if (titleEl) titleEl.textContent = title;
    const errBox = document.getElementById("product-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

// ============================================================
// PRODUCTS PAGE LOGIC
// ============================================================
(async function initProducts() {
    const bodyEl = document.getElementById("products-body");
    if (!bodyEl) return;

    const state = {
        page: 1,
        limit: 10,
        search: "",
        category_id: "",
        supplier_id: "",
        status: "",
    };
    let categories = [];
    let suppliers = [];

    const modal = document.getElementById("product-modal");
    const errBox = document.getElementById("product-form-error");
    const saveBtn = document.getElementById("product-save");
    const addBtn = document.getElementById("add-product-btn");

    // ============================================================
    // LOAD REFS
    // ============================================================
    async function loadRefs() {
        const [c, s] = await Promise.all([
            API.get("/api/categories"),
            API.get("/api/suppliers"),
        ]);
        if (c.ok && c.data.success) categories = c.data.categories;
        if (s.ok && s.data.success) suppliers = s.data.suppliers;

        const catSel = document.getElementById("filter-category");
        const supSel = document.getElementById("filter-supplier");
        if (catSel) {
            catSel.innerHTML =
                `<option value="">All categories</option>` +
                categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        }
        if (supSel) {
            supSel.innerHTML =
                `<option value="">All suppliers</option>` +
                suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
        }

        const pCat = document.getElementById("p-category");
        const pSup = document.getElementById("p-supplier");
        if (pCat) {
            pCat.innerHTML =
                `<option value="">—</option>` +
                categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        }
        if (pSup) {
            pSup.innerHTML =
                `<option value="">—</option>` +
                suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
        }
    }

    // ============================================================
    // LOAD PRODUCTS
    // ============================================================
    async function loadProducts() {
        const params = new URLSearchParams();
        params.set("page", state.page);
        params.set("limit", state.limit);
        if (state.search) params.set("search", state.search);
        if (state.category_id) params.set("category_id", state.category_id);
        if (state.supplier_id) params.set("supplier_id", state.supplier_id);
        if (state.status) params.set("status", state.status);

        const res = await API.get("/api/products?" + params.toString());
        if (!res.ok || !res.data.success) {
            showToast("Failed to load products", "error");
            return;
        }

        const rows = res.data.products;
        if (!rows.length) {
            bodyEl.innerHTML = `<tr><td colspan="10" class="empty">No products found</td></tr>`;
        } else {
            bodyEl.innerHTML = rows.map((p) => `
                <tr>
                    <td>${escapeHtml(p.sku)}</td>
                    <td>${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.category_name || "-")}</td>
                    <td>${escapeHtml(p.supplier_name || "-")}</td>
                    <td>${p.current_stock}</td>
                    <td>${p.min_stock_level}</td>
                    <td>₱${Number(p.cost_price).toFixed(2)}</td>
                    <td>₱${Number(p.selling_price).toFixed(2)}</td>
                    <td>${escapeHtml(p.status)}</td>
                    <td>
                        <button class="btn btn-small" data-edit="${p.id}">Edit</button>
                        <button class="btn btn-small btn-danger" data-del="${p.id}">Delete</button>
                    </td>
                </tr>
            `).join("");
        }

        renderPagination(res.data.pagination);

        bodyEl.querySelectorAll("[data-edit]").forEach((b) => {
            b.addEventListener("click", () => openEdit(parseInt(b.dataset.edit, 10)));
        });
        bodyEl.querySelectorAll("[data-del]").forEach((b) => {
            b.addEventListener("click", () => deleteProduct(parseInt(b.dataset.del, 10)));
        });
    }

    // ============================================================
    // PAGINATION
    // ============================================================
    function renderPagination(p) {
        const el = document.getElementById("pagination");
        if (!el) return;
        const { page, pages } = p;
        if (pages <= 1) { el.innerHTML = ""; return; }
        const parts = [];
        parts.push(`<button ${page === 1 ? "disabled" : ""} data-p="${page - 1}">‹</button>`);
        for (let i = 1; i <= pages; i++) {
            parts.push(`<button class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
        }
        parts.push(`<button ${page === pages ? "disabled" : ""} data-p="${page + 1}">›</button>`);
        el.innerHTML = parts.join("");
        el.querySelectorAll("button[data-p]").forEach((b) => {
            b.addEventListener("click", () => {
                const p2 = parseInt(b.dataset.p, 10);
                if (p2 >= 1 && p2 <= pages) {
                    state.page = p2;
                    loadProducts();
                }
            });
        });
    }

    // ============================================================
    // ADD / EDIT
    // ============================================================
    function openAdd() {
        _closeProductModal();
        _openProductModal("Add Product");
    }

    async function openEdit(id) {
        const res = await API.get(`/api/products/${id}`);
        if (!res.ok || !res.data.success) {
            showToast("Failed to load product", "error");
            return;
        }
        const p = res.data.product;
        document.getElementById("product-id").value = p.id;
        document.getElementById("p-sku").value = p.sku;
        document.getElementById("p-barcode").value = p.barcode || "";
        document.getElementById("p-name").value = p.name;
        document.getElementById("p-description").value = p.description || "";
        document.getElementById("p-category").value = p.category_id || "";
        document.getElementById("p-supplier").value = p.supplier_id || "";
        document.getElementById("p-unit").value = p.unit || "pcs";
        document.getElementById("p-cost").value = p.cost_price;
        document.getElementById("p-sell").value = p.selling_price;
        document.getElementById("p-stock").value = p.current_stock;
        document.getElementById("p-min").value = p.min_stock_level;
        document.getElementById("p-max").value = p.max_stock_level;
        document.getElementById("p-status").value = p.status;
        _openProductModal("Edit Product");
    }

    async function deleteProduct(id) {
        if (!confirmAction("Deactivate this product?")) return;
        const res = await API.del(`/api/products/${id}`);
        if (res.ok && res.data.success) {
            showToast("Product deactivated", "success");
            loadProducts();
        } else {
            showToast((res.data && res.data.message) || "Delete failed", "error");
        }
    }

    if (addBtn) addBtn.addEventListener("click", openAdd);

    // ============================================================
    // SAVE BUTTON
    // ============================================================
    if (saveBtn) {
        saveBtn.addEventListener("click", async() => {
            if (errBox) errBox.hidden = true;

            const id = document.getElementById("product-id").value;
            const payload = {
                sku: document.getElementById("p-sku").value.trim(),
                barcode: document.getElementById("p-barcode").value.trim() || null,
                name: document.getElementById("p-name").value.trim(),
                description: document.getElementById("p-description").value.trim() || null,
                category_id: document.getElementById("p-category").value || null,
                supplier_id: document.getElementById("p-supplier").value || null,
                unit: document.getElementById("p-unit").value.trim() || "pcs",
                cost_price: parseFloat(document.getElementById("p-cost").value) || 0,
                selling_price: parseFloat(document.getElementById("p-sell").value) || 0,
                current_stock: parseInt(document.getElementById("p-stock").value, 10) || 0,
                min_stock_level: parseInt(document.getElementById("p-min").value, 10) || 0,
                max_stock_level: parseInt(document.getElementById("p-max").value, 10) || 0,
                status: document.getElementById("p-status").value,
            };

            if (!payload.sku || !payload.name) {
                if (errBox) {
                    errBox.textContent = "SKU and Name are required";
                    errBox.hidden = false;
                }
                return;
            }

            const res = id ?
                await API.put(`/api/products/${id}`, payload) :
                await API.post("/api/products", payload);

            if (res.ok && res.data.success) {
                showToast(id ? "Product updated" : "Product created", "success");
                _closeProductModal();
                loadProducts();
            } else {
                if (errBox) {
                    errBox.textContent = (res.data && res.data.message) || "Save failed";
                    errBox.hidden = false;
                }
            }
        });
    }

    // ============================================================
    // FILTERS
    // ============================================================
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.search = searchInput.value.trim();
                state.page = 1;
                loadProducts();
            }, 300);
        });
    }
    const filterCat = document.getElementById("filter-category");
    if (filterCat) {
        filterCat.addEventListener("change", (e) => {
            state.category_id = e.target.value;
            state.page = 1;
            loadProducts();
        });
    }
    const filterSup = document.getElementById("filter-supplier");
    if (filterSup) {
        filterSup.addEventListener("change", (e) => {
            state.supplier_id = e.target.value;
            state.page = 1;
            loadProducts();
        });
    }
    const filterStat = document.getElementById("filter-status");
    if (filterStat) {
        filterStat.addEventListener("change", (e) => {
            state.status = e.target.value;
            state.page = 1;
            loadProducts();
        });
    }

    await loadRefs();
    await loadProducts();
})();