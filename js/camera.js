/*
==================================================
QRTalk 3.0
Câmera do navegador e captura de fotos
==================================================
*/

"use strict";

(() => {
    let initialized = false;
    let stream = null;
    let facingMode = "environment";
    let capturedFile = null;
    let capturedUrl = null;
    let modal = null;
    let video = null;
    let previewImage = null;
    let statusText = null;
    let captureButton = null;
    let sendButton = null;
    let retakeButton = null;
    let switchButton = null;

    function log(...args) {
        console.log("[QRTalk/Camera]", ...args);
    }

    function warn(...args) {
        console.warn("[QRTalk/Camera]", ...args);
    }

    function ensureStyles() {
        if (document.getElementById("qrtalk-camera-styles")) return;

        const style = document.createElement("style");
        style.id = "qrtalk-camera-styles";
        style.textContent = `
            .camera-modal {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                background: #020617;
                color: #fff;
            }

            .camera-modal.hidden { display: none !important; }

            .camera-topbar {
                min-height: 64px;
                padding: max(12px, env(safe-area-inset-top)) 14px 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                background: rgba(2,6,23,.92);
                border-bottom: 1px solid rgba(255,255,255,.08);
            }

            .camera-title {
                font-size: 16px;
                font-weight: 700;
            }

            .camera-stage {
                position: relative;
                flex: 1;
                min-height: 0;
                display: grid;
                place-items: center;
                overflow: hidden;
                background: #000;
            }

            .camera-video,
            .camera-preview-image {
                width: 100%;
                height: 100%;
                object-fit: contain;
                background: #000;
            }

            .camera-status {
                position: absolute;
                left: 50%;
                bottom: 16px;
                transform: translateX(-50%);
                max-width: calc(100% - 32px);
                padding: 8px 12px;
                border-radius: 999px;
                background: rgba(15,23,42,.76);
                color: #e2e8f0;
                font-size: 13px;
                text-align: center;
                backdrop-filter: blur(8px);
            }

            .camera-controls {
                padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 14px;
                background: #020617;
                border-top: 1px solid rgba(255,255,255,.08);
            }

            .camera-action {
                min-width: 48px;
                height: 48px;
                padding: 0 15px;
                border: 0;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                background: #1e293b;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
            }

            .camera-action:hover { background: #334155; }

            .camera-capture {
                width: 74px;
                height: 74px;
                min-width: 74px;
                padding: 0;
                border: 6px solid #fff;
                background: transparent;
                box-shadow: inset 0 0 0 5px #020617;
            }

            .camera-send {
                background: #2563eb;
            }

            .camera-send:hover { background: #1d4ed8; }

            @media (max-width: 420px) {
                .camera-action .camera-label { display: none; }
                .camera-action { width: 48px; padding: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function buildModal() {
        if (modal) return;

        modal = document.createElement("div");
        modal.id = "camera-modal";
        modal.className = "camera-modal hidden";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Câmera do QRTalk");

        const topbar = document.createElement("div");
        topbar.className = "camera-topbar";

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "camera-action";
        closeButton.title = "Fechar câmera";
        closeButton.innerHTML = "✕ <span class=\"camera-label\">Fechar</span>";
        closeButton.addEventListener("click", closeCamera);

        const title = document.createElement("div");
        title.className = "camera-title";
        title.textContent = "Câmera";

        const galleryButton = document.createElement("button");
        galleryButton.type = "button";
        galleryButton.className = "camera-action";
        galleryButton.title = "Escolher da galeria";
        galleryButton.innerHTML = "🖼️ <span class=\"camera-label\">Galeria</span>";
        galleryButton.addEventListener("click", () => {
            closeCamera();
            document.getElementById("image-input")?.click();
        });

        topbar.append(closeButton, title, galleryButton);

        const stage = document.createElement("div");
        stage.className = "camera-stage";

        video = document.createElement("video");
        video.className = "camera-video";
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        previewImage = document.createElement("img");
        previewImage.className = "camera-preview-image hidden";
        previewImage.alt = "Foto capturada";

        statusText = document.createElement("div");
        statusText.className = "camera-status";
        statusText.textContent = "Preparando câmera...";

        stage.append(video, previewImage, statusText);

        const controls = document.createElement("div");
        controls.className = "camera-controls";

        switchButton = document.createElement("button");
        switchButton.type = "button";
        switchButton.className = "camera-action";
        switchButton.title = "Trocar câmera";
        switchButton.innerHTML = "🔄 <span class=\"camera-label\">Trocar</span>";
        switchButton.addEventListener("click", switchCamera);

        retakeButton = document.createElement("button");
        retakeButton.type = "button";
        retakeButton.className = "camera-action hidden";
        retakeButton.title = "Tirar outra foto";
        retakeButton.innerHTML = "↩️ <span class=\"camera-label\">Refazer</span>";
        retakeButton.addEventListener("click", retakePhoto);

        captureButton = document.createElement("button");
        captureButton.type = "button";
        captureButton.className = "camera-action camera-capture";
        captureButton.title = "Tirar foto";
        captureButton.setAttribute("aria-label", "Tirar foto");
        captureButton.addEventListener("click", capturePhoto);

        sendButton = document.createElement("button");
        sendButton.type = "button";
        sendButton.className = "camera-action camera-send hidden";
        sendButton.title = "Usar esta foto";
        sendButton.innerHTML = "➤ <span class=\"camera-label\">Usar</span>";
        sendButton.addEventListener("click", useCapturedPhoto);

        controls.append(switchButton, retakeButton, captureButton, sendButton);
        modal.append(topbar, stage, controls);
        document.body.appendChild(modal);
    }

    function setStatus(message) {
        if (statusText) statusText.textContent = message;
    }

    function stopStream() {
        if (!stream) return;
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
        if (video) video.srcObject = null;
    }

    function clearCapturedPhoto() {
        capturedFile = null;
        if (capturedUrl) {
            URL.revokeObjectURL(capturedUrl);
            capturedUrl = null;
        }
        if (previewImage) {
            previewImage.removeAttribute("src");
            previewImage.classList.add("hidden");
        }
    }

    function showLiveControls() {
        video?.classList.remove("hidden");
        previewImage?.classList.add("hidden");
        captureButton?.classList.remove("hidden");
        switchButton?.classList.remove("hidden");
        retakeButton?.classList.add("hidden");
        sendButton?.classList.add("hidden");
    }

    function showCapturedControls() {
        video?.classList.add("hidden");
        previewImage?.classList.remove("hidden");
        captureButton?.classList.add("hidden");
        switchButton?.classList.add("hidden");
        retakeButton?.classList.remove("hidden");
        sendButton?.classList.remove("hidden");
    }

    async function startStream() {
        stopStream();
        clearCapturedPhoto();
        showLiveControls();
        setStatus("Solicitando acesso à câmera...");

        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus("Este navegador não oferece câmera integrada.");
            document.getElementById("camera-input")?.click();
            return false;
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            video.srcObject = stream;
            await video.play();
            setStatus(facingMode === "environment" ? "Câmera traseira" : "Câmera frontal");
            return true;
        } catch (error) {
            warn("Falha ao abrir a câmera:", error);
            setStatus("Não foi possível abrir a câmera. Use a câmera do sistema.");
            window.toast?.("Permita o acesso à câmera para tirar fotos.", "error");
            document.getElementById("camera-input")?.click();
            return false;
        }
    }

    async function openCamera() {
        buildModal();
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        await startStream();
    }

    function closeCamera() {
        stopStream();
        clearCapturedPhoto();
        modal?.classList.add("hidden");
        document.body.style.removeProperty("overflow");
    }

    async function switchCamera() {
        facingMode = facingMode === "environment" ? "user" : "environment";
        await startStream();
    }

    async function capturePhoto() {
        if (!video || !stream || !video.videoWidth || !video.videoHeight) {
            window.toast?.("A câmera ainda não está pronta.", "warning");
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        if (facingMode === "user") {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.9);
        });

        if (!blob) {
            window.toast?.("Não foi possível capturar a foto.", "error");
            return;
        }

        const fileName = `qrtalk-foto-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.jpg`;

        try {
            capturedFile = new File([blob], fileName, {
                type: "image/jpeg",
                lastModified: Date.now()
            });
        } catch (_) {
            capturedFile = blob;
            capturedFile.name = fileName;
        }

        capturedUrl = URL.createObjectURL(blob);
        previewImage.src = capturedUrl;
        stopStream();
        showCapturedControls();
        setStatus("Confira a foto antes de usar.");
    }

    async function retakePhoto() {
        clearCapturedPhoto();
        await startStream();
    }

    async function useCapturedPhoto() {
        if (!capturedFile) return;

        const file = capturedFile;
        const name = capturedFile.name || `qrtalk-foto-${Date.now()}.jpg`;
        closeCamera();

        await window.prepareQRTalkFile?.(file, {
            name,
            mime: "image/jpeg",
            messageType: "image",
            source: "camera"
        });
    }

    function handleFallbackCameraInput(event) {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        window.prepareQRTalkFile?.(file, {
            messageType: "image",
            source: "system-camera"
        });
    }

    function handleEscape(event) {
        if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            closeCamera();
        }
    }

    function initCamera() {
        if (initialized) return;
        initialized = true;

        ensureStyles();
        buildModal();

        document.getElementById("camera-btn")?.addEventListener("click", openCamera);
        document.getElementById("camera-input")?.addEventListener("change", handleFallbackCameraInput);
        document.addEventListener("keydown", handleEscape);
        window.addEventListener("pagehide", closeCamera);
        window.addEventListener("qrtalk:disconnected", closeCamera);
        window.addEventListener("qrtalk:session-ended", closeCamera);

        log("Câmera iniciada.");
    }

    window.initCamera = initCamera;
    window.openQRTalkCamera = openCamera;
    window.closeQRTalkCamera = closeCamera;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCamera);
    } else {
        initCamera();
    }
})();
