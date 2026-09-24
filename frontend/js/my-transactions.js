/* ================================================================
   MY TRANSACTIONS PAGE — Filtered by current user
   ================================================================ */

(async function initMyTransactions() {
    const body = document.getElementById("my-tx-body");
    if (!body) return;

    const state = {
        page: 1,
        limit: 20,
        type: "",
        date_from: "",
        date_to: "",
        currentUser: null,
    };

    // ---------- GET CURRENT USER ----------
    async function loadUser() {
        try {
            const res = await fetch("/api/auth/me", {
                credentials: "same-origin",
                headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                state.currentUser = data.user;
            }
        } catch (e) {
            // ignore
        }
    }

    // ---------- LOAD ----------
    async function load() {
        body.innerHTML = `<tr><td colspan="8" class="empty">Loading…</td></tr>`;

        const params = new URLSearchParams();
        params.set("page", state.page);
        params.set("limit", state.limit);
        if (state.type) params.set("type", state.type);
        if (state.date_from) params.set("date_from", state.date_from);
        if (state.date_to) params.set("date_to", state.date_to + " 23:59:59");

        const res = await API.get("/api/inventory/transactions?" + params.toString());
        if (!res.ok || !res.data.success) {
            body.innerHTML = `<tr><td colspan="8" class="empty">Failed to load</td></tr>`;
            return;
        }

        let rows = res.data.transactions || [];

        // Filter client-side by current user (if API doesn't support it)
        if (state.currentUser) {
            const uname = state.currentUser.username;
            rows = rows.filter((t) => t.username === uname);
        }

        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="8" class="empty">No transactions found</td></tr>`;
            renderPagination({ page: 1, pages: 1, total: 0 });
            return;
        }

        body.innerHTML = rows.map((t) => `
            <tr>
                <td>${new Date(t.created_at).toLocaleString()}</td>
                <td>${escapeHtml(t.product_name || "")}</td>
                <td>${escapeHtml(t.sku || "")}</td>
                <td>${escapeHtml(t.type || "")}</td>
                <td>${t.quantity || 0}</td>
                <td>${t.previous_stock || 0}</td>
                <td>${t.new_stock || 0}</td>
                <td>${escapeHtml(t.reference || "—")}</td>
            </tr>
        `).join("");

        renderPagination(res.data.pagination || { page: 1, pages: 1, total: rows.length });
    }

    // ---------- PAGINATION ----------
    function renderPagination(p) {
        const el = document.getElementById("my-tx-pagination");
        if (!el) return;
        const { page, pages, total } = p;
        if (pages <= 1) {
            el.innerHTML = `<span style="color:var(--muted);font-size:13px;">${total} transaction${total === 1 ? "" : "s"}</span>`;
            return;
        }
        const parts = [];
        parts.push(`<span style="color:var(--muted);font-size:13px;margin-right:auto;">${total} transactions</span>`);
        parts.push(`<button ${page === 1 ? "disabled" : ""} data-p="${page - 1}">‹</button>`);
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || Math.abs(i - page) <= 2) {
                parts.push(`<button class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
            }
        }
        parts.push(`<button ${page === pages ? "disabled" : ""} data-p="${page + 1}">›</button>`);
        el.innerHTML = parts.join("");
        el.querySelectorAll("button[data-p]").forEach((b) => {
            b.addEventListener("click", () => {
                const p2 = parseInt(b.dataset.p, 10);
                if (p2 >= 1 && p2 <= pages) {
                    state.page = p2;
                    load();
                }
            });
        });
    }

    // ---------- FILTERS ----------
    const typeSel = document.getElementById("my-tx-type");
    if (typeSel) {
        typeSel.addEventListener("change", (e) => {
            state.type = e.target.value;
            state.page = 1;
            load();
        });
    }

    const fromDate = document.getElementById("my-tx-date-from");
    if (fromDate) {
        fromDate.addEventListener("change", (e) => {
            state.date_from = e.target.value;
            state.page = 1;
            load();
        });
    }

    const toDate = document.getElementById("my-tx-date-to");
    if (toDate) {
        toDate.addEventListener("change", (e) => {
            state.date_to = e.target.value;
            state.page = 1;
            load();
        });
    }

    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            load();
            showToast("Refreshed", "success");
        });
    }

    await loadUser();
    await load();
})();