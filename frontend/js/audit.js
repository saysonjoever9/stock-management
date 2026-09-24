/* ================================================================
   AUDIT LOG PAGE — Complete
   ================================================================ */

(async function initAudit() {
    const body = document.getElementById("audit-body");
    if (!body) return;

    const state = {
        page: 1,
        limit: 50,
        username: "",
        action: "",
        resource: "",
        status: "",
        date_from: "",
        date_to: "",
    };

    // ---------- LOAD FILTER OPTIONS ----------
    async function loadFilterOptions() {
        const res = await API.get("/api/audit/filters");
        if (!res.ok || !res.data.success) return;

        const actionSel = document.getElementById("filter-action");
        const resourceSel = document.getElementById("filter-resource");
        const statusSel = document.getElementById("filter-status");

        if (actionSel) {
            actionSel.innerHTML =
                `<option value="">All actions</option>` +
                res.data.actions.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
        }
        if (resourceSel) {
            resourceSel.innerHTML =
                `<option value="">All resources</option>` +
                res.data.resources.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
        }
        if (statusSel) {
            statusSel.innerHTML =
                `<option value="">All statuses</option>` +
                res.data.statuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
        }
    }

    // ---------- LOAD LOGS ----------
    async function load() {
        body.innerHTML = `<tr><td colspan="7" class="empty">Loading…</td></tr>`;

        const params = new URLSearchParams();
        params.set("page", state.page);
        params.set("limit", state.limit);
        if (state.username) params.set("username", state.username);
        if (state.action) params.set("action", state.action);
        if (state.resource) params.set("resource", state.resource);
        if (state.status) params.set("status", state.status);
        if (state.date_from) params.set("date_from", state.date_from);
        if (state.date_to) params.set("date_to", state.date_to);

        const res = await API.get("/api/audit/?" + params.toString());
        if (!res.ok || !res.data.success) {
            body.innerHTML = `<tr><td colspan="7" class="empty">Failed to load audit logs</td></tr>`;
            return;
        }

        const rows = res.data.logs || [];
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="7" class="empty">No audit logs found</td></tr>`;
            renderPagination(res.data.pagination);
            return;
        }

        body.innerHTML = rows.map((log) => {
            const statusClass = log.status === "success" ?
                "status-badge active" :
                (log.status === "failure" || log.status === "error") ?
                "status-badge out" :
                "status-badge inactive";

            const userDisplay = log.username ?
                escapeHtml(log.username) :
                '<span style="color:var(--muted-2);">(anonymous)</span>';

            return `
                <tr>
                    <td style="white-space:nowrap;">${formatDate(log.created_at)}</td>
                    <td>${userDisplay}</td>
                    <td><strong>${escapeHtml(log.action || "")}</strong></td>
                    <td>${escapeHtml(log.resource || "")}</td>
                    <td><span class="${statusClass}">${escapeHtml(log.status || "—")}</span></td>
                    <td><code style="font-size:12px;">${escapeHtml(log.ip_address || "")}</code></td>
                    <td title="${escapeHtml(String(log.details || ""))}" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">
                        ${escapeHtml(String(log.details || ""))}
                    </td>
                </tr>
            `;
        }).join("");

        renderPagination(res.data.pagination);
    }

    // ---------- FORMAT DATE ----------
    function formatDate(iso) {
        if (!iso) return "—";
        try {
            const d = new Date(iso);
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        } catch (e) {
            return iso;
        }
    }

    // ---------- PAGINATION ----------
    function renderPagination(p) {
        const el = document.getElementById("audit-pagination");
        if (!el || !p) return;

        const { page, pages, total } = p;
        if (pages <= 1) {
            el.innerHTML = `<span style="color:var(--muted);font-size:13px;">${total} log${total === 1 ? "" : "s"}</span>`;
            return;
        }

        const parts = [];
        parts.push(`<span style="color:var(--muted);font-size:13px;margin-right:auto;">${total} log${total === 1 ? "" : "s"}</span>`);
        parts.push(`<button ${page === 1 ? "disabled" : ""} data-p="${page - 1}">‹</button>`);

        const range = [];
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || Math.abs(i - page) <= 2) range.push(i);
        }
        let lastShown = 0;
        for (const i of range) {
            if (lastShown && i - lastShown > 1) parts.push(`<button disabled>…</button>`);
            parts.push(`<button class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
            lastShown = i;
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

    // ---------- FILTER EVENTS ----------
    const searchInput = document.getElementById("search-username");
    if (searchInput) {
        let t;
        searchInput.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => {
                state.username = searchInput.value.trim();
                state.page = 1;
                load();
            }, 300);
        });
    }

    ["action", "resource", "status"].forEach((key) => {
        const el = document.getElementById(`filter-${key}`);
        if (el) {
            el.addEventListener("change", (e) => {
                state[key] = e.target.value;
                state.page = 1;
                load();
            });
        }
    });

    ["date_from", "date_to"].forEach((key) => {
        const el = document.getElementById(`filter-${key.replace("_", "-")}`);
        if (el) {
            el.addEventListener("change", (e) => {
                state[key] = e.target.value;
                state.page = 1;
                load();
            });
        }
    });

    const clearBtn = document.getElementById("clear-filters-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            state.username = "";
            state.action = "";
            state.resource = "";
            state.status = "";
            state.date_from = "";
            state.date_to = "";
            state.page = 1;

            if (searchInput) searchInput.value = "";
            ["action", "resource", "status"].forEach((k) => {
                const el = document.getElementById(`filter-${k}`);
                if (el) el.value = "";
            });
            ["date-from", "date-to"].forEach((k) => {
                const el = document.getElementById(`filter-${k}`);
                if (el) el.value = "";
            });

            load();
        });
    }

    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadFilterOptions();
            load();
            showToast("Refreshed", "success");
        });
    }

    await loadFilterOptions();
    await load();
})();