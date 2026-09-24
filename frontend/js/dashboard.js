/* ================================================================
   DASHBOARD — Role-Based Rendering
   ================================================================ */

(async function initDashboard() {
    if (!document.getElementById("stats-grid")) return;

    let user;
    try {
        const res = await fetch("/api/auth/me", {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        const data = await res.json();
        if (!res.ok || !data.success) return;
        user = data.user;
    } catch (e) {
        return;
    }

    const titleEl = document.querySelector(".page-title");
    if (titleEl) {
        titleEl.textContent = user.role === "admin" ?
            "Admin Dashboard" :
            "Staff Dashboard";
    }
    const subtitleEl = document.querySelector(".page-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = user.role === "admin" ?
            "Full system overview and management" :
            "Your daily operations and quick actions";
    }

    if (user.role === "admin") {
        await renderAdminDashboard();
    } else {
        await renderStaffDashboard(user);
    }
})();


// ================================================================
// ADMIN DASHBOARD
// ================================================================
async function renderAdminDashboard() {
    const res = await API.get("/api/reports/dashboard");
    if (!res.ok || !res.data.success) {
        showToast((res.data && res.data.message) || "Failed to load dashboard", "error");
        return;
    }

    const { stats, recent_transactions } = res.data;

    const cards = [
        { label: "Total Products", value: stats.total_products, cls: "" },
        { label: "Total Stock Units", value: stats.total_stock, cls: "" },
        {
            label: "Inventory Value",
            value: "₱" + Number(stats.inventory_value).toFixed(2),
            cls: "success",
        },
        { label: "Low Stock", value: stats.low_stock, cls: "warning" },
        { label: "Out of Stock", value: stats.out_of_stock, cls: "danger" },
        { label: "Categories", value: stats.total_categories, cls: "" },
        { label: "Suppliers", value: stats.total_suppliers, cls: "" },
        { label: "Pending Users", value: stats.pending_users || 0, cls: "warning" },
    ];

    document.getElementById("stats-grid").innerHTML = cards.map((c) => `
        <div class="stat-card ${c.cls}">
            <div class="stat-label">${c.label}</div>
            <div class="stat-value">${c.value}</div>
        </div>
    `).join("");

    renderRecentTransactions(recent_transactions, "All Recent Transactions");
}


// ================================================================
// STAFF DASHBOARD — Quick Actions removed
// ================================================================
async function renderStaffDashboard(user) {
    const res = await API.get("/api/reports/dashboard");
    if (!res.ok || !res.data.success) {
        showToast((res.data && res.data.message) || "Failed to load dashboard", "error");
        return;
    }

    const { stats, recent_transactions } = res.data;

    const cards = [
        { label: "Today's Sales", value: "₱" + Number(stats.today_sales || 0).toFixed(2), cls: "success" },
        { label: "Items Sold Today", value: stats.items_sold || 0, cls: "" },
        { label: "My Transactions", value: stats.my_transactions || 0, cls: "" },
    ];

    document.getElementById("stats-grid").innerHTML = cards.map((c) => `
        <div class="stat-card ${c.cls}">
            <div class="stat-label">${c.label}</div>
            <div class="stat-value">${c.value}</div>
        </div>
    `).join("");

    // Quick Actions section removed per request

    renderRecentTransactions(recent_transactions, "My Recent Transactions");
}


// ================================================================
// SHARED: Recent transactions table
// ================================================================
function renderRecentTransactions(transactions, title) {
    const panelHeader = document.querySelector(".panel-header h2");
    if (panelHeader) panelHeader.textContent = title;

    const body = document.getElementById("recent-tx-body");
    if (!body) return;

    if (!transactions || transactions.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="empty">No recent transactions</td></tr>`;
        return;
    }

    body.innerHTML = transactions.map((tx) => `
        <tr>
            <td>${new Date(tx.created_at).toLocaleString()}</td>
            <td>${escapeHtml(tx.product_name || "")}</td>
            <td>${escapeHtml(tx.type || "")}</td>
            <td>${tx.quantity || 0}</td>
            <td>${escapeHtml(tx.username || "")}</td>
        </tr>
    `).join("");
}