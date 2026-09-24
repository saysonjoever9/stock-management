/* ================================================================
   PENDING USERS PAGE
   ----------------------------------------------------------------
   Katuyoan:
     - Magpakita sa tanang staff nga wala pa gi-approve sa admin
     - Mo-allow sa admin pag-approve o reject
   ================================================================ */

(async function initPending() {
    const body = document.getElementById("pending-body");
    if (!body) return;

    const refreshBtn = document.getElementById("refresh-btn");

    // ---------- Load pending users ----------
    async function load() {
        body.innerHTML = `<tr><td colspan="6" class="empty">Loading…</td></tr>`;

        const res = await API.get("/api/users/pending");
        if (!res.ok || !res.data.success) {
            body.innerHTML = `<tr><td colspan="6" class="empty">Failed to load</td></tr>`;
            return;
        }

        const rows = res.data.users || [];
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty">No pending users</td></tr>`;
            return;
        }

        body.innerHTML = rows.map((u) => `
            <tr>
                <td>${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.full_name)}</td>
                <td>${escapeHtml(u.email || "")}</td>
                <td>${escapeHtml(u.role)}</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</td>
                <td>
                    <button class="btn btn-small btn-primary" data-approve="${u.id}">Approve</button>
                    <button class="btn btn-small btn-danger" data-reject="${u.id}">Reject</button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll("[data-approve]").forEach((b) =>
            b.addEventListener("click", () => approve(parseInt(b.dataset.approve, 10)))
        );
        body.querySelectorAll("[data-reject]").forEach((b) =>
            b.addEventListener("click", () => reject(parseInt(b.dataset.reject, 10)))
        );
    }

    // ---------- Approve user ----------
    async function approve(id) {
        if (!confirmAction("Approve this user?")) return;
        const res = await API.post(`/api/users/${id}/approve`);
        if (res.ok && res.data.success) {
            showToast("User approved", "success");
            load();
        } else {
            showToast((res.data && res.data.message) || "Approve failed", "error");
        }
    }

    // ---------- Reject user ----------
    async function reject(id) {
        if (!confirmAction("Reject and delete this user?")) return;
        const res = await API.post(`/api/users/${id}/reject`);
        if (res.ok && res.data.success) {
            showToast("User rejected", "success");
            load();
        } else {
            showToast((res.data && res.data.message) || "Reject failed", "error");
        }
    }

    // ---------- Refresh button ----------
    if (refreshBtn) {
        refreshBtn.addEventListener("click", load);
    }

    // ---------- Initial load ----------
    await load();
})();