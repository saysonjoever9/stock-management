/* ================================================================
   MY REQUESTS PAGE — Staff stock requests
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "request-cancel" ||
        e.target.id === "request-modal-close" ||
        e.target.id === "request-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeRequestModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("request-modal");
        if (modal && !modal.hidden) _closeRequestModal();
    }
});

function _closeRequestModal() {
    const modal = document.getElementById("request-modal");
    if (!modal) return;
    modal.hidden = true;
    const errBox = document.getElementById("request-error");
    if (errBox) errBox.hidden = true;
}

function _openRequestModal() {
    const modal = document.getElementById("request-modal");
    if (!modal) return;
    const errBox = document.getElementById("request-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initMyRequests() {
    const body = document.getElementById("requests-body");
    if (!body) return;

    let currentUser = null;
    let products = [];

    // ---------- LOAD USER ----------
    async function loadUser() {
        try {
            const res = await fetch("/api/auth/me", {
                credentials: "same-origin",
                headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            const data = await res.json();
            if (res.ok && data.success) currentUser = data.user;
        } catch (e) {}
    }

    // ---------- LOAD PRODUCTS ----------
    async function loadProducts() {
        const res = await API.get("/api/products?limit=1000");
        if (res.ok && res.data.success) {
            products = res.data.products || [];
            const sel = document.getElementById("request-product");
            if (sel) {
                sel.innerHTML = `<option value="">Select product…</option>` +
                    products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`).join("");
            }
        }
    }

    // ---------- LOAD REQUESTS ----------
    async function load() {
        body.innerHTML = `<tr><td colspan="6" class="empty">Loading…</td></tr>`;

        // Load from localStorage
        const all = JSON.parse(localStorage.getItem("sms-stock-requests") || "[]");
        const myUsername = currentUser ? currentUser.username : "";
        const rows = all.filter((r) => r.username === myUsername);

        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty">No requests yet. Click "New Request" to create one.</td></tr>`;
            return;
        }

        body.innerHTML = rows.map((r) => {
            const statusClass = r.status === "approved" ? "status-badge active" :
                r.status === "rejected" ? "status-badge out" : "status-badge low";
            return `
                <tr>
                    <td><strong>${escapeHtml(r.id)}</strong></td>
                    <td>${escapeHtml(r.product_name)}</td>
                    <td>${r.quantity}</td>
                    <td><span class="${statusClass}">${escapeHtml(r.status)}</span></td>
                    <td>${new Date(r.created_at).toLocaleString()}</td>
                    <td>${escapeHtml(r.notes || "—")}</td>
                </tr>
            `;
        }).join("");
    }

    // ---------- NEW REQUEST ----------
    const newBtn = document.getElementById("new-request-btn");
    if (newBtn) {
        newBtn.addEventListener("click", async() => {
            await loadProducts();
            document.getElementById("request-product").value = "";
            document.getElementById("request-qty").value = "1";
            document.getElementById("request-notes").value = "";
            _openRequestModal();
        });
    }

    // ---------- SAVE REQUEST ----------
    const saveBtn = document.getElementById("request-save");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const errBox = document.getElementById("request-error");
            if (errBox) errBox.hidden = true;

            const prodId = document.getElementById("request-product").value;
            const qty = parseInt(document.getElementById("request-qty").value, 10);
            const notes = document.getElementById("request-notes").value.trim();

            if (!prodId) {
                if (errBox) {
                    errBox.textContent = "Please select a product";
                    errBox.hidden = false;
                }
                return;
            }
            if (!qty || qty < 1) {
                if (errBox) {
                    errBox.textContent = "Please enter a valid quantity";
                    errBox.hidden = false;
                }
                return;
            }

            const prod = products.find((p) => p.id == prodId);
            const req = {
                id: "REQ-" + Date.now(),
                username: currentUser ? currentUser.username : "unknown",
                product_id: prod ? prod.id : null,
                product_name: prod ? prod.name : "Unknown",
                sku: prod ? prod.sku : "",
                quantity: qty,
                notes: notes || null,
                status: "pending",
                created_at: new Date().toISOString(),
            };

            const all = JSON.parse(localStorage.getItem("sms-stock-requests") || "[]");
            all.unshift(req);
            localStorage.setItem("sms-stock-requests", JSON.stringify(all));

            showToast("Request submitted!", "success");
            _closeRequestModal();
            load();
        });
    }

    await loadUser();
    await load();
})();