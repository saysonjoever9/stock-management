document.addEventListener("DOMContentLoaded", async() => {
    const form = document.getElementById("register-form");
    if (!form) return;

    const errorBox = document.getElementById("register-error");
    const okBox = document.getElementById("register-ok");
    const btn = document.getElementById("register-btn");
    const btnLabel = btn.querySelector(".btn-label");
    const roleSelect = document.getElementById("role");
    const adminOption = document.getElementById("admin-option");
    const adminHint = document.getElementById("admin-hint");

    // ---------- HELPERS ----------
    function showError(msg) {
        if (okBox) okBox.hidden = true;
        if (errorBox) {
            errorBox.textContent = msg;
            errorBox.hidden = false;
        } else {
            alert(msg);
        }
    }

    function showOk(msg) {
        if (errorBox) errorBox.hidden = true;
        if (okBox) {
            okBox.textContent = msg;
            okBox.hidden = false;
        }
    }

    function validateUsername(u) {
        if (!u || u.length < 3) return "Username must be at least 3 characters";
        if (u.length > 50) return "Username must be at most 50 characters";
        if (!/^[A-Za-z0-9_]+$/.test(u))
            return "Username can only contain letters, numbers, and underscore (_)";
        return null;
    }

    function validatePassword(p) {
        if (!p || p.length < 8) return "Password must be at least 8 characters";
        if (!/[A-Z]/.test(p)) return "Password must include an UPPERCASE letter";
        if (!/[a-z]/.test(p)) return "Password must include a lowercase letter";
        if (!/[0-9]/.test(p)) return "Password must include a number";
        return null;
    }

    function validateEmail(e) {
        if (!e) return "Email is required";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
            return "Please enter a valid email address";
        return null;
    }

    // ---------- CHECK IF ADMIN EXISTS ----------
    try {
        const res = await fetch("/api/auth/admin-exists", {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        const data = await res.json();
        if (data.success && data.exists) {
            adminOption.disabled = true;
            roleSelect.value = "staff";
            if (adminHint) adminHint.style.display = "block";
        }
    } catch (e) {
        console.warn("Could not check admin status", e);
    }

    // ---------- SUBMIT ----------
    form.addEventListener("submit", async(e) => {
        e.preventDefault();

        if (errorBox) errorBox.hidden = true;
        if (okBox) okBox.hidden = true;

        const full_name = document.getElementById("full_name").value.trim();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const role = roleSelect.value;

        // Frontend validation
        if (!full_name) {
            showError("Full name is required");
            return;
        }

        const userErr = validateUsername(username);
        if (userErr) {
            showError(userErr);
            return;
        }

        const emailErr = validateEmail(email);
        if (emailErr) {
            showError(emailErr);
            return;
        }

        const pwErr = validatePassword(password);
        if (pwErr) {
            showError(pwErr);
            return;
        }

        // Disable button
        btn.disabled = true;
        btnLabel.textContent = "Creating account…";

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ full_name, username, email, password, role }),
            });

            const data = await res.json();

            if (!data.success) {
                showError(data.message || "Registration failed");
                return;
            }

            showOk(data.message || "Account created! Redirecting to sign in…");

            setTimeout(() => {
                window.location.href = "/";
            }, 2000);

        } catch (err) {
            showError("Network error: " + err.message);
        } finally {
            btn.disabled = false;
            btnLabel.textContent = "Create Account";
        }
    });
});