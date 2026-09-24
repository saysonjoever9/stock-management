/* ================================================================
   SETTINGS PAGE
   ================================================================ */

(function initSettings() {
    // ---------- THEME ----------
    const toggleBtn = document.getElementById("settings-theme-toggle");
    const themeLabel = document.getElementById("settings-theme-label");

    function updateThemeLabel() {
        if (themeLabel) {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            themeLabel.textContent = isDark ? "Dark" : "Light";
        }
    }

    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            if (window.toggleTheme) window.toggleTheme();
            setTimeout(updateThemeLabel, 50);
        });
    }

    updateThemeLabel();

    // ---------- CLEAR CACHE ----------
    const clearBtn = document.getElementById("settings-clear-cache");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (!window.confirm("Clear all locally stored data? This cannot be undone.")) return;
            localStorage.removeItem("sms-purchase-orders");
            localStorage.removeItem("sms-stock-requests");
            localStorage.removeItem("sms-customers");
            showToast("Local cache cleared", "success");
        });
    }

    // ---------- EXPORT DATA ----------
    const exportBtn = document.getElementById("settings-export-data");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            const data = {
                purchase_orders: JSON.parse(localStorage.getItem("sms-purchase-orders") || "[]"),
                stock_requests: JSON.parse(localStorage.getItem("sms-stock-requests") || "[]"),
                customers: JSON.parse(localStorage.getItem("sms-customers") || "[]"),
                exported_at: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "stock-manager-export-" + new Date().toISOString().slice(0, 10) + ".json";
            a.click();
            URL.revokeObjectURL(url);
            showToast("Data exported", "success");
        });
    }

    // ---------- BROWSER INFO ----------
    const browserEl = document.getElementById("settings-browser");
    if (browserEl) {
        const ua = navigator.userAgent;
        let browser = "Unknown";
        if (ua.includes("Firefox")) browser = "Firefox";
        else if (ua.includes("Edg")) browser = "Edge";
        else if (ua.includes("Chrome")) browser = "Chrome";
        else if (ua.includes("Safari")) browser = "Safari";
        browserEl.textContent = browser;
    }
})();