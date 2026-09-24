/* ================================================================
   BARCODE / QR SCANNER PAGE — Enhanced with diagnostics
   ================================================================ */

(async function initScanner() {
    const video = document.getElementById("scanner-video");
    const canvas = document.getElementById("scanner-canvas");
    const resultBox = document.getElementById("scanner-result");
    const manualInput = document.getElementById("scanner-manual");
    const manualBtn = document.getElementById("scanner-manual-btn");
    const startBtn = document.getElementById("scanner-start");
    const stopBtn = document.getElementById("scanner-stop");

    if (!video) return;

    let stream = null;
    let scanning = false;
    let lastResult = "";
    let lastTime = 0;
    let rafId = null;

    // ---------- DIAGNOSTICS ----------
    function logEnvironment() {
        console.group("[Scanner] Environment");
        console.log("Protocol:", window.location.protocol);
        console.log("Hostname:", window.location.hostname);
        console.log("Port:", window.location.port);
        console.log("Full URL:", window.location.href);
        console.log("isSecureContext:", window.isSecureContext);
        console.log("navigator.mediaDevices:", !!navigator.mediaDevices);
        console.log(
            "getUserMedia:", !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        );
        console.log(
            "jsQR loaded:",
            typeof jsQR === "function"
        );
        console.groupEnd();
    }

    // ---------- START CAMERA ----------
    async function startCamera() {
        startBtn.disabled = true;
        startBtn.textContent = "Starting…";

        logEnvironment();

        // ----- 1. Secure context check (HTTPS or localhost) -----
        if (!window.isSecureContext) {
            const isLocalhost =
                window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname === "::1";

            if (!isLocalhost) {
                showToast(
                    "Camera needs HTTPS. Use https:// or open via localhost.",
                    "error",
                    7000
                );
                console.error(
                    "[Scanner] Not a secure context. Protocol:",
                    window.location.protocol
                );
                startBtn.disabled = false;
                startBtn.textContent = "▶ Start Camera";
                return;
            }
        }

        // ----- 2. mediaDevices API check -----
        if (!navigator.mediaDevices) {
            showToast(
                "navigator.mediaDevices unavailable. Browser too old or blocked.",
                "error",
                7000
            );
            startBtn.disabled = false;
            startBtn.textContent = "▶ Start Camera";
            return;
        }

        // ----- 3. getUserMedia check -----
        if (!navigator.mediaDevices.getUserMedia) {
            showToast(
                "getUserMedia not supported. Use a modern browser (Chrome/Edge/Firefox/Safari).",
                "error",
                7000
            );
            startBtn.disabled = false;
            startBtn.textContent = "▶ Start Camera";
            return;
        }

        // ----- 4. Check if any camera device exists -----
        try {
            if (navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cams = devices.filter((d) => d.kind === "videoinput");
                console.log("[Scanner] Cameras found:", cams.length, cams);

                if (cams.length === 0) {
                    // Note: on some browsers, labels are empty until permission granted
                    const hasLabels = cams.some((c) => c.label);
                    if (!hasLabels) {
                        console.warn(
                            "[Scanner] No labeled cameras. Permission may not be granted yet — will try getUserMedia anyway."
                        );
                    } else {
                        showToast(
                            "No camera device detected on this device.",
                            "error",
                            7000
                        );
                        startBtn.disabled = false;
                        startBtn.textContent = "▶ Start Camera";
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn("[Scanner] enumerateDevices failed:", e);
        }

        // ----- 5. Try to get the stream -----
        try {
            console.log("[Scanner] Requesting camera…");

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            console.log("[Scanner] Stream acquired:", stream);

            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.setAttribute("autoplay", true);
            video.muted = true;

            // Wait for metadata
            await new Promise((resolve) => {
                const onLoaded = () => {
                    video.removeEventListener("loadedmetadata", onLoaded);
                    resolve();
                };
                video.addEventListener("loadedmetadata", onLoaded);
                setTimeout(resolve, 3000);
            });

            await video.play();

            console.log(
                "[Scanner] Video playing. Size:",
                video.videoWidth,
                "x",
                video.videoHeight
            );

            scanning = true;
            startBtn.disabled = true;
            startBtn.textContent = "▶ Start Camera";
            stopBtn.disabled = false;

            rafId = requestAnimationFrame(scanLoop);
            showToast("Camera started", "success");
        } catch (err) {
            console.error("[Scanner] getUserMedia error:", err);
            console.error("  name:", err.name);
            console.error("  message:", err.message);

            let msg = "Camera error: " + (err.message || err.name);

            switch (err.name) {
                case "NotAllowedError":
                case "PermissionDeniedError":
                    msg =
                        "Camera permission denied. Click the camera icon in the address bar to allow.";
                    break;
                case "NotFoundError":
                case "DevicesNotFoundError":
                    msg = "No camera found on this device.";
                    break;
                case "NotReadableError":
                case "TrackStartError":
                    msg =
                        "Camera is already in use by another app or tab. Close other apps and try again.";
                    break;
                case "OverconstrainedError":
                case "ConstraintNotSatisfiedError":
                    msg =
                        "Camera does not support the requested settings. Trying default…";
                    // Retry with no constraints
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: false,
                        });
                        video.srcObject = stream;
                        video.setAttribute("playsinline", true);
                        video.muted = true;
                        await video.play();
                        scanning = true;
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        rafId = requestAnimationFrame(scanLoop);
                        showToast("Camera started (default settings)", "success");
                        return;
                    } catch (e2) {
                        msg =
                            "Could not start camera with fallback: " +
                            (e2.message || e2.name);
                    }
                    break;
                case "SecurityError":
                    msg =
                        "Camera blocked by security policy. HTTPS is required.";
                    break;
                case "TypeError":
                    msg =
                        "Invalid camera request. Check browser/OS camera permissions.";
                    break;
                case "AbortError":
                    msg = "Camera request was aborted. Try again.";
                    break;
            }

            showToast(msg, "error", 7000);

            startBtn.disabled = false;
            startBtn.textContent = "▶ Start Camera";
        }
    }

    // ---------- STOP CAMERA ----------
    function stopCamera() {
        scanning = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            stream = null;
        }
        video.srcObject = null;
        startBtn.disabled = false;
        startBtn.textContent = "▶ Start Camera";
        stopBtn.disabled = true;
    }

    // ---------- SCAN LOOP ----------
    function scanLoop() {
        if (!scanning) return;

        if (!video.videoWidth || !video.videoHeight) {
            rafId = requestAnimationFrame(scanLoop);
            return;
        }

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof jsQR === "function") {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
                const now = Date.now();
                if (code.data !== lastResult || now - lastTime > 2500) {
                    lastResult = code.data;
                    lastTime = now;
                    handleScanResult(code.data);
                }
            }
        } else {
            // jsQR missing — log once
            if (!scanLoop._warnedJsQR) {
                console.warn("[Scanner] jsQR not loaded — scanning disabled");
                scanLoop._warnedJsQR = true;
            }
        }

        if (scanning) rafId = requestAnimationFrame(scanLoop);
    }

    // ---------- HANDLE RESULT ----------
    async function handleScanResult(code) {
        showToast("Scanned: " + code, "info");
        resultBox.hidden = false;
        resultBox.innerHTML = `<div class="scan-loading">Looking up product…</div>`;

        const res = await API.get(
            `/api/products?search=${encodeURIComponent(code)}&limit=5`
        );
        if (res.ok && res.data.success && res.data.products.length) {
            const p = res.data.products[0];
            resultBox.innerHTML = `
                <div class="scan-result-card">
                    <div class="scan-result-header">
                        <span class="scan-badge">✓ Found</span>
                        <span class="scan-code">${escapeHtml(code)}</span>
                    </div>
                    <h3>${escapeHtml(p.name)}</h3>
                    <div class="scan-result-grid">
                        <div><span>SKU:</span><strong>${escapeHtml(p.sku)}</strong></div>
                        <div><span>Category:</span><strong>${escapeHtml(p.category_name || "-")}</strong></div>
                        <div><span>Stock:</span><strong>${p.current_stock}</strong></div>
                        <div><span>Price:</span><strong>₱${Number(p.selling_price).toFixed(2)}</strong></div>
                    </div>
                    <div class="scan-result-actions">
                        <a href="/products" class="btn btn-primary">View in Products</a>
                        <button class="btn" onclick="this.closest('.scan-result-card').remove()">Clear</button>
                    </div>
                </div>
            `;
        } else {
            resultBox.innerHTML = `
                <div class="scan-result-card scan-not-found">
                    <div class="scan-result-header">
                        <span class="scan-badge out">✗ Not Found</span>
                        <span class="scan-code">${escapeHtml(code)}</span>
                    </div>
                    <p>No product matches this barcode/QR code.</p>
                    <div class="scan-result-actions">
                        <a href="/products" class="btn btn-primary">Add Product</a>
                    </div>
                </div>
            `;
        }
    }

    // ---------- MANUAL INPUT ----------
    if (manualBtn) {
        manualBtn.addEventListener("click", () => {
            const val = manualInput.value.trim();
            if (val) {
                handleScanResult(val);
                manualInput.value = "";
            }
        });
    }

    if (manualInput) {
        manualInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                manualBtn.click();
            }
        });
    }

    // ---------- START/STOP ----------
    if (startBtn) startBtn.addEventListener("click", startCamera);
    if (stopBtn) stopBtn.addEventListener("click", stopCamera);

    stopBtn.disabled = true;

    window.addEventListener("beforeunload", stopCamera);

    // Log environment on page load
    logEnvironment();
})();