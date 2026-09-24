/* ================================================================
   AUTH GUARD + SIDEBAR + TOPBAR RENDERER (ROLE-BASED)
   Unified minimalist outline icons — all 18x18, stroke-width 2,
   stroke-linecap="round", stroke-linejoin="round", fill="none"
   ================================================================ */

const ICON_ATTRS = `xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

const ICONS = {
    dashboard: `<svg ${ICON_ATTRS}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
    products: `<svg ${ICON_ATTRS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    categories: `<svg ${ICON_ATTRS}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    suppliers: `<svg ${ICON_ATTRS}><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    pricing: `<svg ${ICON_ATTRS}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    "purchase-orders": `<svg ${ICON_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    customers: `<svg ${ICON_ATTRS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    analytics: `<svg ${ICON_ATTRS}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    reports: `<svg ${ICON_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    audit: `<svg ${ICON_ATTRS}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    pending: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    users: `<svg ${ICON_ATTRS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    settings: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    pos: `<svg ${ICON_ATTRS}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    scanner: `<svg ${ICON_ATTRS}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
    "stock-in": `<svg ${ICON_ATTRS}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    "stock-out": `<svg ${ICON_ATTRS}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    adjustment: `<svg ${ICON_ATTRS}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    "my-transactions": `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    "my-requests": `<svg ${ICON_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
};


// ================================================================
// MAIN
// ================================================================
(async function initSidebarAndTopbar() {
        const sidebarEl = document.getElementById("sidebar");
        const topbarEl = document.getElementById("topbar");
        if (!sidebarEl && !topbarEl) return;

        // ---------- 1. Verify auth ----------
        let user;
        try {
            const res = await fetch("/api/auth/me", {
                credentials: "same-origin",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json",
                },
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                window.location.href = "/";
                return;
            }
            user = data.user;
        } catch (e) {
            window.location.href = "/";
            return;
        }

        // ---------- 2. Determine active page ----------
        const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
        const activeKey = path || "dashboard";

        // ---------- 3. ROLE-BASED NAV ITEMS ----------
        const adminNav = [
            { href: "/dashboard", label: "Dashboard", key: "dashboard" },
            { href: "/products", label: "Products", key: "products" },
            { href: "/categories", label: "Categories", key: "categories" },
            { href: "/suppliers", label: "Suppliers", key: "suppliers" },
            { href: "/pricing", label: "Pricing", key: "pricing" },
            { href: "/purchase-orders", label: "Purchase Orders", key: "purchase-orders" },
            { href: "/customers", label: "Customers", key: "customers" },
            { href: "/analytics", label: "Analytics", key: "analytics" },
            { href: "/reports", label: "Reports", key: "reports" },
            { href: "/audit", label: "Audit Log", key: "audit" },
            { href: "/pending", label: "Pending Users", key: "pending" },
            { href: "/users", label: "Users", key: "users" },
            { href: "/settings", label: "Settings", key: "settings" },
        ];

        const staffNav = [
            { href: "/dashboard", label: "Dashboard", key: "dashboard" },
            { href: "/pos", label: "Point of Sale", key: "pos" },
            { href: "/scanner", label: "Barcode Scanner", key: "scanner" },
            { href: "/products", label: "Products", key: "products" },
            { href: "/stock-in", label: "Stock In", key: "stock-in" },
            { href: "/stock-out", label: "Stock Out", key: "stock-out" },
            { href: "/adjustment", label: "Adjustment", key: "adjustment" },
            { href: "/my-transactions", label: "My Transactions", key: "my-transactions" },
            { href: "/my-requests", label: "My Requests", key: "my-requests" },
            { href: "/customers", label: "Customers", key: "customers" },
        ];

        const items = user.role === "admin" ? adminNav : staffNav;

        // ---------- 4. Render sidebar ----------
        if (sidebarEl) {
            sidebarEl.innerHTML = `
            <div class="brand">
                <span class="brand-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </span>
                <span class="brand-text">Stock Manager</span>
            </div>

            <nav class="sidebar-nav">
                ${items.map((i) => `
                    <a href="${i.href}"
                       class="sidebar-link ${i.key === activeKey ? "active" : ""}"
                       data-key="${i.key}">
                        <span class="nav-icon">${ICONS[i.key] || ICONS.dashboard}</span>
                        <span class="nav-label">${i.label}</span>
                    </a>
                `).join("")}
            </nav>

            <div class="sidebar-footer">
                <div class="user-mini">
                    <div class="user-avatar">
                        ${escapeHtml((user.full_name || user.username).charAt(0).toUpperCase())}
                    </div>
                    <div class="user-mini-info">
                        <div class="user-mini-name">${escapeHtml(user.full_name || user.username)}</div>
                        <div class="user-mini-role ${user.role}">${escapeHtml(user.role)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ---------- 5. Render topbar ----------
    if (topbarEl) {
        const initial = (user.full_name || user.username).charAt(0).toUpperCase();
        topbarEl.innerHTML = `
            <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="topbar-title">${escapeHtml(titleFor(activeKey))}</div>
            <div class="topbar-actions">
                <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme" title="Toggle dark mode">
                    <span class="icon-moon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    </span>
                    <span class="icon-sun">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    </span>
                </button>
                <div class="user-info">
                    <div class="user-avatar-sm">${initial}</div>
                    <strong>${escapeHtml(user.full_name || user.username)}</strong>
                    <span class="user-role-badge ${user.role}">${escapeHtml(user.role)}</span>
                </div>
                <button class="btn-logout" id="logout-btn" title="Logout">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span class="logout-text">Logout</span>
                </button>
            </div>
        `;

        const toggle = document.getElementById("menu-toggle");
        if (toggle && sidebarEl) {
            toggle.addEventListener("click", () => {
                sidebarEl.classList.toggle("open");
            });
        }

        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                logoutBtn.disabled = true;
                try {
                    await fetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "X-Requested-With": "XMLHttpRequest" },
                    });
                } catch (e) {
                    console.warn("Logout error", e);
                }
                window.location.href = "/";
            });
        }
    }

    // ---------- 6. Close sidebar on outside click (mobile) ----------
    document.addEventListener("click", (e) => {
        if (!sidebarEl) return;
        if (!sidebarEl.classList.contains("open")) return;
        if (sidebarEl.contains(e.target)) return;
        const toggle = document.getElementById("menu-toggle");
        if (toggle && toggle.contains(e.target)) return;
        sidebarEl.classList.remove("open");
    });
})();

function titleFor(key) {
    const titles = {
        dashboard: "Dashboard",
        products: "Products",
        categories: "Categories",
        suppliers: "Suppliers",
        inventory: "Inventory Operations",
        transactions: "Transaction History",
        reports: "Reports",
        pending: "Pending Users",
        users: "Users",
        audit: "Audit Log",
        pricing: "Pricing",
        "purchase-orders": "Purchase Orders",
        customers: "Customers",
        analytics: "Analytics",
        settings: "Settings",
        pos: "Point of Sale",
        scanner: "Barcode Scanner",
        "stock-in": "Stock In",
        "stock-out": "Stock Out",
        adjustment: "Stock Adjustment",
        "my-transactions": "My Transactions",
        "my-requests": "My Requests",
    };
    return titles[key] || "Stock Manager";
}