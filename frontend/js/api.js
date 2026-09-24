/* ================================================================
   API CLIENT — Auto-detects backend URL
   ================================================================
   
   Kung local (127.0.0.1 / localhost) — relative URLs, works dayon.
   Kung deployed (Vercel/other) — mo-point sa Render backend URL.
   ================================================================ */

// ⚠️ Ilisan kini sa imong actual Render backend URL kung na-deploy na
const PRODUCTION_BACKEND_URL = "https://stock-management-backend.onrender.com";

// Auto-detect: local = relative, deployed = absolute
const IS_LOCAL =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost" ||
    location.hostname === "::1" ||
    location.hostname.startsWith("192.168.") ||
    location.hostname.startsWith("10.") ||
    location.hostname === "";

const API_BASE_URL = IS_LOCAL ? "" : PRODUCTION_BACKEND_URL;

const API = {
    get(url) {
        return apiFetch(url, { method: "GET" });
    },
    post(url, body) {
        return apiFetch(url, {
            method: "POST",
            body: JSON.stringify(body || {}),
        });
    },
    put(url, body) {
        return apiFetch(url, {
            method: "PUT",
            body: JSON.stringify(body || {}),
        });
    },
    del(url) {
        return apiFetch(url, { method: "DELETE" });
    },
};

async function apiFetch(url, options = {}) {
    // I-prepend ang API_BASE_URL kung relative path
    const fullUrl = url.startsWith("http") ? url : (API_BASE_URL + url);

    const opts = {
        method: options.method || "GET",
        credentials: "include",
        headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json",
            ...(options.headers || {}),
        },
    };

    if (options.body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = options.body;
    }

    let res;
    try {
        res = await fetch(fullUrl, opts);
    } catch (e) {
        console.error("[API] Network error:", e);
        return {
            ok: false,
            status: 0,
            data: {
                success: false,
                message: "Network error. Check backend URL.",
            },
        };
    }

    // Handle 401 (not authenticated) — redirect to login
    if (
        res.status === 401 &&
        !url.includes("/api/auth/me") &&
        !url.includes("/api/auth/login")
    ) {
        window.location.href = "/";
        return {
            ok: false,
            status: 401,
            data: { success: false, message: "Not authenticated" },
        };
    }

    // Parse JSON
    let data;
    try {
        data = await res.json();
    } catch (e) {
        console.error("[API] Invalid JSON response from:", fullUrl);
        console.error("[API] Response status:", res.status);
        const text = await res.text().catch(() => "");
        console.error("[API] Response body (first 200 chars):", text.slice(0, 200));
        data = {
            success: false,
            message: `Invalid server response (HTTP ${res.status}). Backend may not be running.`,
        };
    }

    return { ok: res.ok, status: res.status, data };
}

function showToast(message, type = "info", timeout = 3500) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), timeout);
}

function confirmAction(message) {
    return window.confirm(message);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".toggle-password").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const input = document.getElementById(btn.getAttribute("data-target"));
            if (!input) return;
            const eyeOff = btn.querySelector(".icon-eye-off");
            const eyeOn = btn.querySelector(".icon-eye");
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            if (eyeOff) eyeOff.style.display = show ? "none" : "block";
            if (eyeOn) eyeOn.style.display = show ? "block" : "none";
        });
    });
});