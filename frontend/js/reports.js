(async function initReports() {
        const tableEl = document.getElementById("report-table");
        if (!tableEl) return;

        const state = {
            report: "inventory",
            data: [],
            columns: [],
            title: "",
        };

        const COLUMNS = {
            inventory: [
                "sku", "name", "category", "supplier",
                "cost_price", "selling_price",
                "current_stock", "min_stock_level", "stock_value",
            ],
            "low-stock": ["sku", "name", "category", "current_stock", "min_stock_level"],
            "out-of-stock": ["sku", "name", "category", "min_stock_level"],
            transactions: [
                "id", "product", "sku", "type", "quantity",
                "previous_stock", "new_stock",
                "username", "created_at", "reference",
            ],
            "audit-logs": [
                "id", "action", "resource", "resource_id", "status",
                "ip_address", "created_at", "username",
            ],
        };

        const LABELS = {
            inventory: "Current Inventory",
            "low-stock": "Low Stock Products",
            "out-of-stock": "Out of Stock Products",
            transactions: "Transaction History",
            "audit-logs": "Audit Log",
        };

        async function loadUser() {
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
                const nameEl = document.getElementById("reports-user-name");
                const roleEl = document.getElementById("reports-user-role");
                if (nameEl) nameEl.textContent = data.user.full_name || data.user.username;
                if (roleEl) {
                    roleEl.textContent = data.user.role;
                    roleEl.className = "user-role-badge " + data.user.role;
                }
            } catch (e) {
                window.location.href = "/";
            }
        }

        function formatCell(value, key) {
            if (value === null || value === undefined) return "";
            if (key === "created_at" || key === "updated_at") {
                try {
                    return new Date(value).toLocaleString();
                } catch {
                    return String(value);
                }
            }
            if (key === "cost_price" || key === "selling_price" || key === "stock_value") {
                const n = Number(value);
                if (!isNaN(n)) return "$" + n.toFixed(2);
            }
            return String(value);
        }

        function columnLabel(key) {
            return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        }

        async function load() {
            const r = state.report;
            const body = document.getElementById("report-body");
            const head = document.getElementById("report-head");
            const titleEl = document.getElementById("report-title");
            const metaEl = document.getElementById("report-meta");

            body.innerHTML = '<tr><td class="empty">Loading…</td></tr>';

            const res = await API.get(`/api/reports/${r}`);
            if (!res.ok || !res.data.success) {
                body.innerHTML = '<tr><td class="empty">Failed to load or forbidden</td></tr>';
                head.innerHTML = "";
                state.data = [];
                if (metaEl) metaEl.textContent = "Failed to load";
                return;
            }

            const rows = res.data.report || [];
            state.data = rows;
            state.columns = COLUMNS[r];
            state.title = LABELS[r];

            if (titleEl) titleEl.textContent = state.title;

            const cols = state.columns;
            head.innerHTML = `<tr>${cols.map((c) => `<th>${columnLabel(c)}</th>`).join("")}</tr>`;

        if (metaEl) {
            const ts = new Date().toLocaleString();
            metaEl.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"} · generated ${ts}`;
        }

        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="${cols.length}" class="empty">No data</td></tr>`;
            return;
        }

        body.innerHTML = rows.map((row) => `
            <tr>
                ${cols.map((c) => `<td>${escapeHtml(formatCell(row[c], c))}</td>`).join("")}
            </tr>
        `).join("");
    }

    function exportExcel() {
        if (!state.data.length) {
            showToast("Nothing to export", "warning");
            return;
        }
        if (typeof XLSX === "undefined") {
            showToast("Excel library failed to load", "error");
            return;
        }

        const cols = state.columns;
        const headers = cols.map(columnLabel);

        const data = state.data.map((row) => {
            const obj = {};
            cols.forEach((c) => {
                obj[columnLabel(c)] = formatCell(row[c], c);
            });
            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, state.title.slice(0, 30));

        const filename = `${state.report}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast("Excel downloaded", "success");
    }

    function exportPdf() {
        if (!state.data.length) {
            showToast("Nothing to export", "warning");
            return;
        }
        if (typeof window.jspdf === "undefined") {
            showToast("PDF library failed to load", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

        const cols = state.columns;
        const headers = cols.map(columnLabel);

        const body = state.data.map((row) =>
            cols.map((c) => formatCell(row[c], c))
        );

        // Title
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        doc.text(state.title, 40, 40);

        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58);

        // Table
        doc.autoTable({
            head: [headers],
            body: body,
            startY: 75,
            styles: {
                fontSize: 8,
                cellPadding: 4,
                overflow: "linebreak",
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: 255,
                fontStyle: "bold",
                fontSize: 8,
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251],
            },
            margin: { left: 40, right: 40 },
        });

        const filename = `${state.report}-${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        showToast("PDF downloaded", "success");
    }

    function printReport() {
        window.print();
    }

    document.querySelectorAll(".reports-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".reports-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            state.report = tab.dataset.report;
            load();
        });
    });

    const excelBtn = document.getElementById("report-excel");
    const pdfBtn = document.getElementById("report-pdf");
    const printBtn = document.getElementById("report-print");
    const logoutBtn = document.getElementById("logout-btn");

    if (excelBtn) excelBtn.addEventListener("click", exportExcel);
    if (pdfBtn) pdfBtn.addEventListener("click", exportPdf);
    if (printBtn) printBtn.addEventListener("click", printReport);

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
                /* ignore */
            }
            window.location.href = "/";
        });
    }

    await loadUser();
    await load();
})();