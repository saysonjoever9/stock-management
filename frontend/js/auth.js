document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    if (!form) return;

    const errorBox = document.getElementById("login-error");
    const btn = document.getElementById("login-btn");
    const btnLabel = btn.querySelector(".btn-label");

    form.addEventListener("submit", async(e) => {
        e.preventDefault();

        if (errorBox) errorBox.hidden = true;
        btn.disabled = true;
        btnLabel.textContent = "Signing in…";

        const payload = {
            username: document.getElementById("username").value.trim(),
            password: document.getElementById("password").value,
        };

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!data.success) {
                if (errorBox) {
                    errorBox.textContent = data.message || "Login failed";
                    errorBox.hidden = false;
                }
                return;
            }

            // Success — go to dashboard
            window.location.href = "/dashboard";

        } catch (err) {
            if (errorBox) {
                errorBox.textContent = "Network error: " + err.message;
                errorBox.hidden = false;
            }
        } finally {
            btn.disabled = false;
            btnLabel.textContent = "Sign In";
        }
    });
});

async function logout() {
    await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    window.location.href = "/";
}