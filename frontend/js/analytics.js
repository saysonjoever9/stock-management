/* ================================================================
   ANALYTICS PAGE — Charts + Insights
   ================================================================ */

(async function initAnalytics() {
        const summaryGrid = document.getElementById("summary-grid");
        if (!summaryGrid) return;

        let salesChart = null;
        let categoryChart = null;

        // ---------- LOAD SUMMARY ----------
        async function loadSummary() {
            const res = await API.get("/api/reports/dashboard");
            if (!res.ok || !res.data.success) {
                showToast("Failed to load analytics", "error");
                return;
            }

            const { stats } = res.data;

            const cards = [
                { label: "Total Products", value: stats.total_products, cls: "" },
                { label: "Total Stock Units", value: stats.total_stock, cls: "" },
                { label: "Inventory Value", value: "₱" + Number(stats.inventory_value).toFixed(2), cls: "success" },
                { label: "Low Stock", value: stats.low_stock, cls: "warning" },
                { label: "Out of Stock", value: stats.out_of_stock, cls: "danger" },
                { label: "Categories", value: stats.total_categories, cls: "" },
            ];

            summaryGrid.innerHTML = cards.map((c) => `
            <div class="stat-card ${c.cls}">
                <div class="stat-label">${c.label}</div>
                <div class="stat-value">${c.value}</div>
            </div>
        `).join("");
        }

        // ---------- SALES TREND CHART ----------
        async function loadSalesChart() {
            const res = await API.get("/api/reports/transactions?limit=500");
            if (!res.ok || !res.data.success) return;

            const rows = res.data.report || [];
            const dailySales = {};

            rows.forEach((r) => {
                if (r.type !== "out" && r.type !== "sale") return;
                const d = new Date(r.created_at);
                const key = d.toISOString().slice(0, 10);
                dailySales[key] = (dailySales[key] || 0) + (r.quantity || 0);
            });

            // Last 30 days
            const labels = [];
            const values = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
                values.push(dailySales[key] || 0);
            }

            const ctx = document.getElementById("sales-chart");
            if (!ctx) return;

            if (salesChart) salesChart.destroy();

            salesChart = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [{
                        label: "Items Sold",
                        data: values,
                        borderColor: "#6366f1",
                        backgroundColor: "rgba(99, 102, 241, 0.12)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        borderWidth: 2,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { grid: { display: false } },
                    },
                },
            });
        }

        // ---------- CATEGORY CHART ----------
        async function loadCategoryChart() {
            const res = await API.get("/api/categories");
            if (!res.ok || !res.data.success) return;

            const cats = res.data.categories || [];
            if (!cats.length) return;

            const labels = cats.map((c) => c.name);
            const values = cats.map((c) => c.product_count || 0);

            const palette = [
                "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
                "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
            ];

            const ctx = document.getElementById("category-chart");
            if (!ctx) return;

            if (categoryChart) categoryChart.destroy();

            categoryChart = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                        borderWidth: 2,
                        borderColor: "var(--panel)",
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { boxWidth: 10, padding: 10, font: { size: 11 } },
                        },
                    },
                    cutout: "60%",
                },
            });
        }

        // ---------- TOP PRODUCTS ----------
        async function loadTopProducts() {
            const list = document.getElementById("top-products-list");
            if (!list) return;

            const res = await API.get("/api/reports/transactions?limit=1000");
            if (!res.ok || !res.data.success) {
                list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No data</p>`;
                return;
            }

            const rows = res.data.report || [];
            const counts = {};

            rows.forEach((r) => {
                if (r.type !== "out" && r.type !== "sale") return;
                const name = r.product || r.product_name || "Unknown";
                counts[name] = (counts[name] || 0) + (r.quantity || 0);
            });

            const sorted = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (!sorted.length) {
                list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No sales data yet</p>`;
                return;
            }

            list.innerHTML = sorted.map(([name, qty], i) => `
            <div class="top-item">
                <span class="top-item-name">${i + 1}. ${escapeHtml(name)}</span>
                <span class="top-item-meta">${qty} sold</span>
            </div>
        `).join("");
        }

        // ---------- LOW STOCK ALERTS ----------
        async function loadLowStock() {
            const list = document.getElementById("low-stock-list");
            if (!list) return;

            const res = await API.get("/api/reports/low-stock");
            if (!res.ok || !res.data.success) {
                list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No data</p>`;
                return;
            }

            const rows = res.data.report || [];
            if (!rows.length) {
                list.innerHTML = `<p style="color:var(--muted);font-size:13px;">All products are well-stocked ✅</p>`;
                return;
            }

            list.innerHTML = rows.slice(0, 8).map((r) => {
                        const out = (r.current_stock || 0) <= 0;
                        return `
                <div class="low-item ${out ? "out" : ""}">
                    <span>${escapeHtml(r.name || r.sku)}</span>
                    <span>${out ? "OUT OF STOCK" : `${r.current_stock} left (min ${r.min_stock_level})`}</span>
                </div>
            `;
        }).join("");
    }

    // ---------- REFRESH ----------
    async function loadAll() {
        await Promise.all([
            loadSummary(),
            loadSalesChart(),
            loadCategoryChart(),
            loadTopProducts(),
            loadLowStock(),
        ]);
    }

    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await loadAll();
            showToast("Analytics refreshed", "success");
        });
    }

    await loadAll();
})();