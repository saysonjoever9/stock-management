(async function initTransactions() {
    if (!document.getElementById("tx-body")) return;

    const state = { page: 1, limit: 20, type: "", date_from: "", date_to: "" };

    async function load() {
        const params = new URLSearchParams();
        params.set("page", state.page);
        params.set("limit", state.limit);
        if (state.type) params.set("type", state.type);
        if (state.date_from) params.set("date_from", state.date_from);
        if (state.date_to) params.set("date_to", state.date_to + " 23:59:59");

        const res = await API.get("/api/inventory/transactions?" + params.toString());
        const body = document.getElementById("tx-body");
        if (!res.ok || !res.data.success) {
            body.innerHTML = `<tr><td colspan="9" class="empty">Failed to load</td></tr>`;
            return;
        }

        const rows = res.data.transactions;
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="9" class="empty">No transactions</td></tr>`;
        } else {
            body.innerHTML = rows
                .map(
                    (t) => `
        <tr>
          <td>${new Date(t.created_at).toLocaleString()}</td>
          <td>${escapeHtml(t.product_name)}</td>
          <td>${escapeHtml(t.sku)}</td>
          <td>${escapeHtml(t.type)}</td>
          <td>${t.quantity}</td>
          <td>${t.previous_stock}</td>
          <td>${t.new_stock}</td>
          <td>${escapeHtml(t.username)}</td>
          <td>${escapeHtml(t.reference || "")}</td>
        </tr>
      `
                )
                .join("");
        }

        renderPagination(res.data.pagination);
    }

    function renderPagination(p) {
        const el = document.getElementById("tx-pagination");
        const { page, pages } = p;
        if (pages <= 1) {
            el.innerHTML = "";
            return;
        }
        const parts = [];
        parts.push(
            `<button ${page === 1 ? "disabled" : ""} data-p="${page - 1}">‹</button>`
        );
        for (let i = 1; i <= pages; i++) {
            parts.push(
                `<button class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`
            );
        }
        parts.push(
            `<button ${page === pages ? "disabled" : ""} data-p="${page + 1}">›</button>`
        );
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

    document.getElementById("tx-filter-btn").addEventListener("click", () => {
        state.type = document.getElementById("tx-type").value;
        state.date_from = document.getElementById("tx-date-from").value;
        state.date_to = document.getElementById("tx-date-to").value;
        state.page = 1;
        load();
    });

    document.getElementById("tx-export-btn").addEventListener("click", async() => {
        const params = new URLSearchParams();
        if (state.type) params.set("type", state.type);
        const res = await API.get("/api/reports/transactions?" + params.toString());
        if (!res.ok || !res.data.success) {
            showToast("Export failed", "error");
            return;
        }
        const rows = res.data.report;
        if (!rows.length) {
            showToast("Nothing to export", "warning");
            return;
        }
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(","),
            ...rows.map((r) =>
                headers
                .map((h) => `"${String(r[h] === null || r[h] === undefined ? "" : r[h]).replace(/"/g, '""')}"`)
                .join(",")
            ),
        ].join("\n");
        downloadCSV(csv, "transactions.csv");
    });

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    await load();
})();