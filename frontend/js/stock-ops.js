/* ================================================================
   STOCK OPERATIONS — Stock In, Stock Out, Adjustment
   ================================================================ */

document.addEventListener("DOMContentLoaded", async() => {
    const form = document.getElementById("stock-op-form");
    if (!form) return;

    const mode = form.dataset.mode || "in"; // "in", "out", or "adjust"

    const productSel = document.getElementById("op-product");
    const qtyInput = document.getElementById("op-quantity");
    const reasonInput = document.getElementById("op-reason");
    const referenceInput = document.getElementById("op-reference");
    const notesInput = document.getElementById("op-notes");
    const submitBtn = document.getElementById("op-submit");
    const errBox = document.getElementById("op-error");

    const stockPreview = document.getElementById("op-stock-preview");

    // ---------- LOAD PRODUCTS ----------
    async function loadProducts() {
        const res = await API.get("/api/products?limit=1000&status=active");
        if (!res.ok || !res.data.success) {
            productSel.innerHTML = `<option value="">Failed to load products</option>`;
            return;
        }

        const products = res.data.products || [];
        productSel.innerHTML = `<option value="">Select a product…</option>` +
            products.map((p) => `
                <option value="${p.id}" data-stock="${p.current_stock}" data-name="${escapeHtml(p.name)}">
                    ${escapeHtml(p.name)} (${escapeHtml(p.sku)}) — Stock: ${p.current_stock}
                </option>
            `).join("");
    }

    // ---------- UPDATE PREVIEW ----------
    function updatePreview() {
        if (!stockPreview) return;
        const opt = productSel.selectedOptions[0];
        if (!opt || !opt.value) {
            stockPreview.innerHTML = `<span style="color:var(--muted);">Select a product to see stock preview</span>`;
            return;
        }

        const current = parseInt(opt.dataset.stock, 10) || 0;
        const qty = parseInt(qtyInput.value, 10) || 0;

        let newStock = current;
        let label = "";

        if (mode === "in") {
            newStock = current + qty;
            label = "Current → New";
        } else if (mode === "out") {
            newStock = current - qty;
            label = "Current → New";
        } else if (mode === "adjust") {
            newStock = qty;
            label = "Set to";
        }

        const color = newStock < 0 ? "var(--danger)" : newStock === 0 ? "var(--warning)" : "var(--success)";

        stockPreview.innerHTML = `
            <div class="stock-preview-row">
                <span>${label}</span>
                <strong style="color:${color};">
                    ${current} → ${newStock}
                </strong>
            </div>
        `;
    }

    productSel.addEventListener("change", updatePreview);
    qtyInput.addEventListener("input", updatePreview);

    // ---------- SUBMIT ----------
    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        if (errBox) errBox.hidden = true;

        const productId = productSel.value;
        const quantity = parseInt(qtyInput.value, 10);

        if (!productId) {
            if (errBox) {
                errBox.textContent = "Please select a product";
                errBox.hidden = false;
            }
            return;
        }

        if (!quantity || quantity < 0 || (mode !== "adjust" && quantity < 1)) {
            if (errBox) {
                errBox.textContent = "Please enter a valid quantity";
                errBox.hidden = false;
            }
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Processing…";

        let res;

        if (mode === "in") {
            res = await API.post("/api/inventory/stock-in", {
                product_id: parseInt(productId, 10),
                quantity,
                reference: referenceInput ? referenceInput.value.trim() : null,
                notes: notesInput ? notesInput.value.trim() : null,
            });
        } else if (mode === "out") {
            res = await API.post("/api/inventory/stock-out", {
                product_id: parseInt(productId, 10),
                quantity,
                reason: reasonInput ? reasonInput.value.trim() : null,
                reference: referenceInput ? referenceInput.value.trim() : null,
                notes: notesInput ? notesInput.value.trim() : null,
            });
        } else {
            res = await API.post("/api/inventory/adjustment", {
                product_id: parseInt(productId, 10),
                new_quantity: quantity,
                reason: reasonInput ? reasonInput.value.trim() : null,
                notes: notesInput ? notesInput.value.trim() : null,
            });
        }

        if (res.ok && res.data.success) {
            showToast(
                mode === "in" ? "Stock added successfully" :
                mode === "out" ? "Stock removed successfully" :
                "Stock adjusted successfully",
                "success"
            );

            form.reset();
            productSel.value = "";
            qtyInput.value = mode === "adjust" ? "0" : "1";
            if (stockPreview) stockPreview.innerHTML = "";
            updatePreview();

            // Reload product list to refresh stock counts
            await loadProducts();
        } else {
            if (errBox) {
                errBox.textContent = (res.data && res.data.message) || "Operation failed";
                errBox.hidden = false;
            }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    });

    await loadProducts();
    updatePreview();
});