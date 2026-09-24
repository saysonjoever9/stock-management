(function() {
    "use strict";

    var THEME_KEY = "sms-theme";
    var root = document.documentElement;

    function getStored() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function getSystemPref() {
        return (window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches) ?
            "dark" : "light";
    }

    function getTheme() {
        return getStored() || getSystemPref();
    }

    function applyTheme(theme) {
        if (theme !== "dark" && theme !== "light") theme = "light";
        root.setAttribute("data-theme", theme);
        root.style.colorScheme = theme;
    }

    function toggleTheme() {
        var current = root.getAttribute("data-theme") || getTheme();
        var next = current === "dark" ? "light" : "dark";
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyTheme(next);
    }

    // Apply IMMEDIATELY (before paint)
    applyTheme(getTheme());

    // System preference listener
    if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        var handler = function(e) {
            if (!getStored()) applyTheme(e.matches ? "dark" : "light");
        };
        if (mq.addEventListener) mq.addEventListener("change", handler);
        else if (mq.addListener) mq.addListener(handler);
    }

    document.addEventListener("click", function(e) {
        var target = e.target;
        // Walk up to find the theme-toggle button (in case user clicked on the emoji inside)
        while (target && target !== document) {
            if (target.id === "theme-toggle" || (target.classList && target.classList.contains("theme-toggle"))) {
                e.preventDefault();
                e.stopPropagation();
                toggleTheme();
                return;
            }
            target = target.parentNode;
        }
    }, true); // use capture phase to beat other handlers

    // Expose globally
    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;

    // Debug helper (optional — remove in production)
    window._themeDebug = function() {
        return {
            theme: root.getAttribute("data-theme"),
            stored: getStored(),
            systemPref: getSystemPref()
        };
    };
})();