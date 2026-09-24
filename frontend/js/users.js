/* ================================================================
   USERS PAGE
   ================================================================ */

document.addEventListener("click", function(e) {
    if (!e.target) return;
    if (e.target.id === "user-cancel" ||
        e.target.id === "user-modal-close" ||
        e.target.id === "user-modal") {
        e.preventDefault();
        e.stopPropagation();
        _closeUserModal();
        return false;
    }
});

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("user-modal");
        if (modal && !modal.hidden) _closeUserModal();
    }
});

function _closeUserModal() {
    const modal = document.getElementById("user-modal");
    if (!modal) return;
    modal.hidden = true;
    const form = document.getElementById("user-form");
    if (form) form.reset();
    const idField = document.getElementById("user-id");
    if (idField) idField.value = "";
    const errBox = document.getElementById("user-form-error");
    if (errBox) errBox.hidden = true;
    const username = document.getElementById("u-username");
    if (username) username.disabled = false;
}

function _openUserModal(title) {
    const modal = document.getElementById("user-modal");
    if (!modal) return;
    const t = document.getElementById("user-modal-title");
    if (t) t.textContent = title;
    const errBox = document.getElementById("user-form-error");
    if (errBox) errBox.hidden = true;
    modal.hidden = false;
}

(async function initUsers() {
    const body = document.getElementById("users-body");
    if (!body) return;

    const form = document.getElementById("user-form");
    const errBox = document.getElementById("user-form-error");
    const addBtn = document.getElementById("add-user-btn");

    async function load() {
        const res = await API.get("/api/users/");
        if (!res.ok || !res.data.success) {
            body.innerHTML = `<tr><td colspan="7" class="empty">Failed to load</td></tr>`;
            return;
        }
        const rows = res.data.users;
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="7" class="empty">No users</td></tr>`;
            return;
        }
        body.innerHTML = rows.map((u) => `
            <tr>
                <td>${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.full_name)}</td>
                <td>${escapeHtml(u.email || "")}</td>
                <td>${escapeHtml(u.role)}</td>
                <td>${u.is_active ? "Yes" : "No"}</td>
                <td>${u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                <td>
                    <button class="btn btn-small" data-edit="${u.id}">Edit</button>
                    <button class="btn btn-small" data-reset="${u.id}">Reset PW</button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll("[data-edit]").forEach((b) =>
            b.addEventListener("click", () =>
                openEdit(rows.find((x) => x.id == b.dataset.edit))
            )
        );
        body.querySelectorAll("[data-reset]").forEach((b) =>
            b.addEventListener("click", () =>
                resetPassword(parseInt(b.dataset.reset, 10))
            )
        );
    }

    function openAdd() {
        _closeUserModal();
        document.getElementById("password-group").hidden = false;
        document.getElementById("active-group").hidden = true;
        document.getElementById("u-role").disabled = false;
        _openUserModal("Add User");
    }

    function openEdit(u) {
        _closeUserModal();
        document.getElementById("user-id").value = u.id;
        document.getElementById("u-username").value = u.username;
        document.getElementById("u-username").disabled = true;
        document.getElementById("u-fullname").value = u.full_name;
        document.getElementById("u-email").value = u.email || "";
        document.getElementById("u-role").value = u.role;
        document.getElementById("u-role").disabled = false;
        document.getElementById("password-group").hidden = true;
        document.getElementById("active-group").hidden = false;
        document.getElementById("u-active").value = u.is_active ? "true" : "false";
        _openUserModal("Edit User");
    }

    async function resetPassword(id) {
        const pw = prompt("New password (8+ chars, upper, lower, digit):");
        if (!pw) return;
        const res = await API.post(`/api/users/${id}/reset-password`, { password: pw });
        if (res.ok && res.data.success) showToast("Password reset", "success");
        else showToast((res.data && res.data.message) || "Reset failed", "error");
    }

    if (addBtn) addBtn.addEventListener("click", openAdd);

    if (form) {
        form.addEventListener("submit", async(e) => {
            e.preventDefault();
            if (errBox) errBox.hidden = true;
            const id = document.getElementById("user-id").value;

            if (id) {
                const payload = {
                    full_name: document.getElementById("u-fullname").value.trim(),
                    email: document.getElementById("u-email").value.trim() || null,
                    role: document.getElementById("u-role").value,
                    is_active: document.getElementById("u-active").value === "true",
                };
                const res = await API.put(`/api/users/${id}`, payload);
                if (res.ok && res.data.success) {
                    showToast("Updated", "success");
                    _closeUserModal();
                    load();
                } else {
                    if (errBox) {
                        errBox.textContent = (res.data && res.data.message) || "Update failed";
                        errBox.hidden = false;
                    }
                }
            } else {
                const payload = {
                    username: document.getElementById("u-username").value.trim(),
                    full_name: document.getElementById("u-fullname").value.trim(),
                    email: document.getElementById("u-email").value.trim() || null,
                    role: document.getElementById("u-role").value,
                    password: document.getElementById("u-password").value,
                };
                const res = await API.post("/api/users/", payload);
                if (res.ok && res.data.success) {
                    showToast("Created", "success");
                    _closeUserModal();
                    load();
                } else {
                    if (errBox) {
                        errBox.textContent = (res.data && res.data.message) || "Create failed";
                        errBox.hidden = false;
                    }
                }
            }
        });
    }

    await load();
})();