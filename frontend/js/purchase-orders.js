/* ================================================================
   PURCHASE ORDERS PAGE
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "po-cancel" ||
        e.target.id === "po-modal-close" ||
        e.target.id === "po-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closePOModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("po-modal");
        if (modal && !modal.hidden) _closePOModal();
    }
});

function _closePOModal() {
    const modal = document.getElementById("po-modal");
    if (!modal) return;
    modal.hidden = true;
    const errBox = document.getElementById("po-form-error");
    if (errBox) errBox.hidden = true;
}

function _openPOModal(title) {
    const modal = document.getElementById("po-modal");
    if (!modal) return;
    const t = document.getElementById("po-modal-title");
    if (t) t.textContent = title;
    const errBox = document.getElementById("po-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initPurchaseOrders() {
        const body = document.getElementById("po-body");
        if (!body) return;

        const state = {
            page: 1,
            limit: 20,
            status: "",
        };

        let orders = [];
        let products = [];
        let suppliers = [];
        let poItems = [];

        const errBox = document.getElementById("po-form-error");
        const saveBtn = document.getElementById("po-save");

        // ---------- LOAD REFS ----------
        async function loadRefs() {
            const [p, s] = await Promise.all([
                API.get("/api/products?limit=1000"),
                API.get("/api/suppliers"),
            ]);
            if (p.ok && p.data.success) products = p.data.products || [];
            if (s.ok && s.data.success) suppliers = s.data.suppliers || [];

            const supSel = document.getElementById("po-supplier");
            if (supSel) {
                supSel.innerHTML = `<option value="">Select supplier</option>` +
                    suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
            }
        }

        // ---------- LOAD ORDERS ----------
        async function load() {
            body.innerHTML = `<tr><td colspan="7" class="empty">Loading…</td></tr>`;

            const params = new URLSearchParams();
            params.set("page", state.page);
            params.set("limit", state.limit);
            if (state.status) params.set("status", state.status);

            // Try to load from API, fallback to localStorage
            let rows = [];
            try {
                const res = await API.get("/api/purchase-orders?" + params.toString());
                if (res.ok && res.data.success) {
                    rows = res.data.orders || [];
                }
            } catch (e) {
                rows = [];
            }

            // Fallback: localStorage
            if (!rows.length) {
                const stored = JSON.parse(localStorage.getItem("sms-purchase-orders") || "[]");
                rows = stored.filter((o) => !state.status || o.status === state.status);
            }

            orders = rows;

            if (!rows.length) {
                body.innerHTML = `<tr><td colspan="7" class="empty">No purchase orders yet</td></tr>`;
                renderPagination({ page: 1, pages: 1, total: 0 });
                return;
            }

            body.innerHTML = rows.map((o) => {
                        const statusClass = o.status === "received" ? "status-badge active" :
                            o.status === "pending" ? "status-badge low" :
                            o.status === "cancelled" ? "status-badge out" : "status-badge inactive";

                        const itemCount = o.items ? o.items.length : (o.item_count || 0);

                        return `
                <tr>
                    <td><strong>${escapeHtml(o.po_number || o.id)}</strong></td>
                    <td>${escapeHtml(o.supplier_name || "-")}</td>
                    <td>${itemCount} item${itemCount === 1 ? "" : "s"}</td>
                    <td>₱${Number(o.total_amount || 0).toFixed(2)}</td>
                    <td><span class="${statusClass}">${escapeHtml(o.status || "pending")}</span></td>
                    <td>${o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                        ${o.status === "pending" ? `
                            <button class="btn btn-small btn-primary" data-receive="${o.id}">Receive</button>
                            <button class="btn btn-small btn-danger" data-cancel-po="${o.id}">Cancel</button>
                        ` : `<span style="color:var(--muted);font-size:12px;">—</span>`}
                    </td>
                </tr>
            `;
        }).join("");

        body.querySelectorAll("[data-receive]").forEach((b) => {
            b.addEventListener("click", () => receiveOrder(b.dataset.receive));
        });
        body.querySelectorAll("[data-cancel-po]").forEach((b) => {
            b.addEventListener("click", () => cancelOrder(b.dataset.cancelPo));
        });

        renderPagination({ page: state.page, pages: 1, total: rows.length });
    }

    // ---------- PAGINATION ----------
    function renderPagination(p) {
        const el = document.getElementById("po-pagination");
        if (!el) return;
        el.innerHTML = `<span style="color:var(--muted);font-size:13px;">${p.total} order${p.total === 1 ? "" : "s"}</span>`;
    }

    // ---------- NEW ORDER MODAL ----------
    function openNewOrder() {
        poItems = [];
        document.getElementById("po-supplier").value = "";
        document.getElementById("po-notes").value = "";
        document.getElementById("po-item-product").innerHTML =
            `<option value="">Select product</option>` +
            products.map((p) => `<option value="${p.id}" data-cost="${p.cost_price}">${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`).join("");
        document.getElementById("po-item-qty").value = "1";
        document.getElementById("po-item-cost").value = "0";
        renderItemsTable();
        _openPOModal("New Purchase Order");
    }

    function renderItemsTable() {
        const tbody = document.getElementById("po-items-body");
        const totalEl = document.getElementById("po-total");
        if (!tbody) return;

        if (!poItems.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No items added yet</td></tr>`;
            if (totalEl) totalEl.textContent = "₱0.00";
            return;
        }

        let total = 0;
        tbody.innerHTML = poItems.map((item, idx) => {
            const lineTotal = item.quantity * item.unit_cost;
            total += lineTotal;
            return `
                <tr>
                    <td>${escapeHtml(item.product_name)}</td>
                    <td>${item.quantity}</td>
                    <td>₱${Number(item.unit_cost).toFixed(2)}</td>
                    <td>₱${lineTotal.toFixed(2)}</td>
                    <td>
                        <button type="button" class="btn btn-small btn-danger" data-remove-item="${idx}">×</button>
                    </td>
                </tr>
            `;
        }).join("");

        if (totalEl) totalEl.textContent = "₱" + total.toFixed(2);

        tbody.querySelectorAll("[data-remove-item]").forEach((b) => {
            b.addEventListener("click", () => {
                poItems.splice(parseInt(b.dataset.removeItem, 10), 1);
                renderItemsTable();
            });
        });
    }

    const addItemBtn = document.getElementById("po-add-item");
    if (addItemBtn) {
        addItemBtn.addEventListener("click", () => {
            const prodId = document.getElementById("po-item-product").value;
            const qty = parseInt(document.getElementById("po-item-qty").value, 10) || 1;
            const cost = parseFloat(document.getElementById("po-item-cost").value) || 0;

            if (!prodId) {
                showToast("Select a product", "warning");
                return;
            }

            const prod = products.find((p) => p.id == prodId);
            if (!prod) return;

            poItems.push({
                product_id: prod.id,
                product_name: prod.name,
                sku: prod.sku,
                quantity: qty,
                unit_cost: cost || prod.cost_price || 0,
            });

            renderItemsTable();
            document.getElementById("po-item-qty").value = "1";
            document.getElementById("po-item-cost").value = "0";
        });
    }

    // Auto-fill cost when product selected
    const prodSelect = document.getElementById("po-item-product");
    if (prodSelect) {
        prodSelect.addEventListener("change", (e) => {
            const opt = e.target.selectedOptions[0];
            if (opt && opt.dataset.cost) {
                document.getElementById("po-item-cost").value = opt.dataset.cost;
            }
        });
    }

    // ---------- SAVE ORDER ----------
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            if (errBox) errBox.hidden = true;

            const supplierId = document.getElementById("po-supplier").value;
            if (!supplierId) {
                if (errBox) {
                    errBox.textContent = "Please select a supplier";
                    errBox.hidden = false;
                }
                return;
            }

            if (!poItems.length) {
                if (errBox) {
                    errBox.textContent = "Add at least one item";
                    errBox.hidden = false;
                }
                return;
            }

            const supplier = suppliers.find((s) => s.id == supplierId);
            const total = poItems.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

            const order = {
                id: "PO-" + Date.now(),
                po_number: "PO-" + String(Date.now()).slice(-6),
                supplier_id: parseInt(supplierId, 10),
                supplier_name: supplier ? supplier.name : "",
                items: poItems,
                item_count: poItems.length,
                total_amount: total,
                status: "pending",
                notes: document.getElementById("po-notes").value.trim(),
                created_at: new Date().toISOString(),
            };

            // Save to localStorage (fallback) + try API
            const stored = JSON.parse(localStorage.getItem("sms-purchase-orders") || "[]");
            stored.unshift(order);
            localStorage.setItem("sms-purchase-orders", JSON.stringify(stored));

            // Try API
            try {
                await API.post("/api/purchase-orders", order);
            } catch (e) {
                // Local-only is fine
            }

            showToast("Purchase order created", "success");
            _closePOModal();
            load();
        });
    }

    // ---------- RECEIVE ORDER ----------
    async function receiveOrder(id) {
        if (!confirmAction("Mark this order as received? Stock will be added.")) return;

        const stored = JSON.parse(localStorage.getItem("sms-purchase-orders") || "[]");
        const order = stored.find((o) => String(o.id) === String(id));
        if (!order) {
            showToast("Order not found", "error");
            return;
        }

        // Add stock for each item
        for (const item of (order.items || [])) {
            try {
                await API.post("/api/inventory/stock-in", {
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost,
                    reference: order.po_number,
                    notes: "Received from PO " + order.po_number,
                });
            } catch (e) {
                // continue
            }
        }

        order.status = "received";
        order.received_at = new Date().toISOString();
        localStorage.setItem("sms-purchase-orders", JSON.stringify(stored));

        showToast("Order received! Stock updated.", "success");
        load();
    }

    // ---------- CANCEL ORDER ----------
    async function cancelOrder(id) {
        if (!confirmAction("Cancel this purchase order?")) return;
        const stored = JSON.parse(localStorage.getItem("sms-purchase-orders") || "[]");
        const order = stored.find((o) => String(o.id) === String(id));
        if (order) {
            order.status = "cancelled";
            localStorage.setItem("sms-purchase-orders", JSON.stringify(stored));
        }
        showToast("Order cancelled", "info");
        load();
    }

    // ---------- NEW ORDER BUTTON ----------
    const newBtn = document.getElementById("new-po-btn");
    if (newBtn) {
        newBtn.addEventListener("click", async () => {
            await loadRefs();
            openNewOrder();
        });
    }

    // ---------- STATUS FILTER ----------
    const statusFilter = document.getElementById("po-status-filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            state.status = e.target.value;
            state.page = 1;
            load();
        });
    }

    await load();
})();