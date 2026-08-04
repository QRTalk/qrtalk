/*
==================================================
QRTalk 3.0
Notificações, toasts, sons e vibração
==================================================
*/

"use strict";

(() => {
    let initialized = false;
    let permissionRequested = false;
    let audioContext = null;
    let userInteracted = false;
    const activeNotifications = new Set();

    function log(...args) {
        console.log("[QRTalk/Notifications]", ...args);
    }

    function warn(...args) {
        console.warn("[QRTalk/Notifications]", ...args);
    }

    function ensureStyles() {
        if (document.getElementById("qrtalk-notification-styles")) return;

        const style = document.createElement("style");
        style.id = "qrtalk-notification-styles";
        style.textContent = `
            #qrtalk-toast-container {
                position: fixed;
                top: calc(14px + env(safe-area-inset-top));
                left: 50%;
                z-index: 20000;
                width: min(92vw, 420px);
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }

            .qrtalk-toast {
                padding: 11px 14px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(15,23,42,.96);
                color: #fff;
                border: 1px solid rgba(255,255,255,.1);
                box-shadow: 0 12px 35px rgba(0,0,0,.32);
                backdrop-filter: blur(10px);
                pointer-events: auto;
                animation: qrtalkToastIn .2s ease;
            }

            .qrtalk-toast.success { border-color: rgba(34,197,94,.45); }
            .qrtalk-toast.warning { border-color: rgba(245,158,11,.5); }
            .qrtalk-toast.error { border-color: rgba(239,68,68,.55); }

            .qrtalk-toast-icon {
                width: 28px;
                height: 28px;
                flex: 0 0 28px;
                display: grid;
                place-items: center;
                border-radius: 50%;
                background: rgba(255,255,255,.08);
            }

            .qrtalk-toast-message {
                min-width: 0;
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }

            .qrtalk-toast-close {
                width: 30px;
                height: 30px;
                flex: 0 0 30px;
                border: 0;
                border-radius: 50%;
                background: transparent;
                color: #cbd5e1;
                cursor: pointer;
            }

            .qrtalk-toast.leaving {
                animation: qrtalkToastOut .18s ease forwards;
            }

            @keyframes qrtalkToastIn {
                from { opacity: 0; transform: translateY(-10px) scale(.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            @keyframes qrtalkToastOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-8px); }
            }
        `;
        document.head.appendChild(style);
    }

    function getToastContainer() {
        let container = document.getElementById("qrtalk-toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "qrtalk-toast-container";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "false");
            document.body.appendChild(container);
        }
        return container;
    }

    function toast(message, type = "info", options = {}) {
        const text = String(message || "").trim();
        if (!text) return null;

        const container = getToastContainer();
        const element = document.createElement("div");
        element.className = `qrtalk-toast ${type}`;
        element.setAttribute("role", type === "error" ? "alert" : "status");

        const icons = {
            info: "ℹ️",
            success: "✅",
            warning: "⚠️",
            error: "❌"
        };

        const icon = document.createElement("div");
        icon.className = "qrtalk-toast-icon";
        icon.textContent = icons[type] || icons.info;

        const messageElement = document.createElement("div");
        messageElement.className = "qrtalk-toast-message";
        messageElement.textContent = text;

        const close = document.createElement("button");
        close.type = "button";
        close.className = "qrtalk-toast-close";
        close.title = "Fechar";
        close.textContent = "✕";

        const remove = () => {
            if (!element.isConnected) return;
            element.classList.add("leaving");
            window.setTimeout(() => element.remove(), 190);
        };

        close.addEventListener("click", remove);
        element.append(icon, messageElement, close);
        container.appendChild(element);

        const duration = Number(options.duration ?? 3600);
        if (duration > 0) window.setTimeout(remove, duration);

        return element;
    }

    function ensureAudioContext() {
        if (!userInteracted) return null;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;

        if (!audioContext || audioContext.state === "closed") {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }

        return audioContext;
    }

    function playTone(frequency = 660, duration = 0.12, volume = 0.035) {
        const context = ensureAudioContext();
        if (!context) return;

        try {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, context.currentTime);
            gain.gain.setValueAtTime(volume, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + duration);
        } catch (error) {
            warn("Não foi possível reproduzir o som:", error);
        }
    }

    function playIncomingSound() {
        playTone(740, 0.10, 0.03);
        window.setTimeout(() => playTone(940, 0.14, 0.03), 90);
    }

    function vibrate(pattern) {
        if ("vibrate" in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (_) {
                // Vibração não disponível neste contexto.
            }
        }
    }

    async function requestNotificationPermission() {
        if (!("Notification" in window)) return "unsupported";
        if (Notification.permission !== "default") return Notification.permission;
        if (permissionRequested) return Notification.permission;

        permissionRequested = true;

        try {
            return await Notification.requestPermission();
        } catch (error) {
            warn("Não foi possível solicitar notificações:", error);
            return Notification.permission;
        }
    }

    function closeNotification(notification) {
        try {
            notification.close();
        } catch (_) {
            // A notificação já pode estar fechada.
        }
        activeNotifications.delete(notification);
    }

    function showSystemNotification(title, options = {}) {
        if (!("Notification" in window) || Notification.permission !== "granted") {
            return null;
        }

        try {
            const notification = new Notification(title, {
                body: options.body || "",
                tag: options.tag || undefined,
                renotify: options.renotify === true,
                silent: options.silent === true,
                requireInteraction: options.requireInteraction === true
            });

            activeNotifications.add(notification);
            notification.addEventListener("click", () => {
                window.focus();
                closeNotification(notification);
            });
            notification.addEventListener("close", () => {
                activeNotifications.delete(notification);
            });

            const timeout = Number(options.timeout ?? 8000);
            if (timeout > 0) window.setTimeout(() => closeNotification(notification), timeout);
            return notification;
        } catch (error) {
            warn("Falha ao criar notificação:", error);
            return null;
        }
    }

    function getMessagePreview(packet) {
        switch (packet?.messageType) {
            case "image":
                return "📷 Você recebeu uma imagem.";
            case "audio":
                return "🎤 Você recebeu uma mensagem de áudio.";
            case "video":
                return "🎬 Você recebeu um vídeo.";
            case "file":
                return `📎 Você recebeu ${packet.fileName || "um arquivo"}.`;
            case "location":
                return "📍 Você recebeu uma localização.";
            default: {
                const text = String(packet?.content || "Nova mensagem").replace(/\s+/g, " ").trim();
                return text.length > 100 ? `${text.slice(0, 100)}…` : text;
            }
        }
    }

    function handleMessageReceived(event) {
        const packet = event.detail?.packet;

        if (document.hidden) {
            showSystemNotification("Nova mensagem no QRTalk", {
                body: getMessagePreview(packet),
                tag: "qrtalk-message",
                renotify: true
            });
        }

        playIncomingSound();
        vibrate([90]);
    }

    function handleNudge() {
        if (document.hidden) {
            showSystemNotification("QRTalk — chamando atenção", {
                body: "A outra pessoa chamou sua atenção.",
                tag: "qrtalk-nudge",
                renotify: true,
                requireInteraction: true,
                timeout: 12000
            });
        }
    }

    function handleConnected() {
        toast("Conexão P2P estabelecida.", "success", { duration: 2400 });
    }

    function handleDisconnected(event) {
        if (event.detail?.intentional) return;
        toast("A conexão foi interrompida. Tentando reconectar...", "warning", {
            duration: 4200
        });
    }

    function handlePeerError() {
        toast("O serviço P2P encontrou um problema de conexão.", "error", {
            duration: 5000
        });
    }

    function registerUserInteraction() {
        userInteracted = true;
        ensureAudioContext();
        requestNotificationPermission();
    }

    function bindPermissionGesture() {
        const options = { once: true, passive: true };
        document.addEventListener("pointerdown", registerUserInteraction, options);
        document.addEventListener("keydown", registerUserInteraction, options);
        document.addEventListener("touchstart", registerUserInteraction, options);
    }

    function handleFocus() {
        activeNotifications.forEach(closeNotification);
        document.title = "QRTalk";
    }

    function cleanup() {
        activeNotifications.forEach(closeNotification);
        activeNotifications.clear();
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
    }

    function initNotifications() {
        if (initialized) return;
        initialized = true;

        ensureStyles();
        getToastContainer();
        bindPermissionGesture();

        window.addEventListener("qrtalk:message-received", handleMessageReceived);
        window.addEventListener("qrtalk:nudge", handleNudge);
        window.addEventListener("qrtalk:connected", handleConnected);
        window.addEventListener("qrtalk:disconnected", handleDisconnected);
        window.addEventListener("qrtalk:peer-error", handlePeerError);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("pagehide", cleanup);

        log("Notificações iniciadas.");
    }

    window.initNotifications = initNotifications;
    window.toast = toast;
    window.requestQRTalkNotifications = requestNotificationPermission;
    window.showQRTalkNotification = showSystemNotification;
    window.playQRTalkIncomingSound = playIncomingSound;

    if (document.readyState !== "loading") {
        initNotifications();
    }
})();
