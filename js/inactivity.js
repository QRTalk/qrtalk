/*
==================================================
QRTalk 3.1
Encerramento após 10 minutos de inatividade
==================================================
*/

"use strict";

(() => {
    const TYPES = Object.freeze({
        ACTIVITY: "session:activity",
        KEEPALIVE: "session:keepalive",
        EXPIRED: "session:expired"
    });

    const state = {
        initialized: false,
        active: false,
        lastActivityAt: 0,
        lastBroadcastAt: 0,
        intervalId: null,
        warningVisible: false,
        expiring: false
    };

    let ui = null;

    function config() {
        return window.QRTalkSafetyConfig?.inactivity || {
            timeoutMs: 600000,
            warningBeforeMs: 60000,
            activityBroadcastIntervalMs: 45000
        };
    }

    function safeSend(packet) {
        if (typeof window.sendPeerPacket !== "function") return false;
        return window.sendPeerPacket(packet);
    }

    function formatRemaining(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function ensureUi() {
        if (ui) return ui;

        const overlay = document.createElement("div");
        overlay.id = "qrtalk-inactivity-overlay";
        overlay.className = "qrtalk-safety-overlay hidden";
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "qrtalk-inactivity-title");

        overlay.innerHTML = `
            <div class="qrtalk-safety-card qrtalk-safety-card--warning">
                <div class="qrtalk-safety-icon">⌛</div>
                <h2 id="qrtalk-inactivity-title">Sessão quase encerrando</h2>
                <p id="qrtalk-inactivity-message">A conversa ficou sem atividade.</p>
                <div id="qrtalk-inactivity-countdown" class="qrtalk-safety-countdown">1:00</div>
                <p id="qrtalk-inactivity-detail" class="qrtalk-safety-detail">Toque em continuar para manter a sala aberta.</p>
                <div class="qrtalk-safety-actions">
                    <button type="button" id="qrtalk-continue-session" class="qrtalk-safety-button qrtalk-safety-button--primary">
                        Continuar sessão
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        ui = {
            overlay,
            card: overlay.querySelector(".qrtalk-safety-card"),
            icon: overlay.querySelector(".qrtalk-safety-icon"),
            title: overlay.querySelector("#qrtalk-inactivity-title"),
            message: overlay.querySelector("#qrtalk-inactivity-message"),
            countdown: overlay.querySelector("#qrtalk-inactivity-countdown"),
            detail: overlay.querySelector("#qrtalk-inactivity-detail"),
            continueButton: overlay.querySelector("#qrtalk-continue-session"),
            actions: overlay.querySelector(".qrtalk-safety-actions")
        };

        ui.continueButton.addEventListener("click", () => {
            markActivity("continue-button", true);
        });

        return ui;
    }

    function hideWarning() {
        state.warningVisible = false;
        ensureUi().overlay.classList.add("hidden");
    }

    function showWarning(remainingMs) {
        const elements = ensureUi();
        state.warningVisible = true;
        elements.overlay.classList.remove("hidden");
        elements.card.className = "qrtalk-safety-card qrtalk-safety-card--warning";
        elements.icon.textContent = "⌛";
        elements.title.textContent = "Sessão quase encerrando";
        elements.message.textContent = "A conversa ficou sem atividade.";
        elements.detail.textContent = "Toque em continuar para manter a sala aberta.";
        elements.countdown.textContent = formatRemaining(remainingMs);
        elements.countdown.classList.remove("hidden");
        elements.actions.classList.remove("hidden");
        elements.continueButton.disabled = false;
    }

    function showExpired(message) {
        const elements = ensureUi();
        state.warningVisible = true;
        elements.overlay.classList.remove("hidden");
        elements.card.className = "qrtalk-safety-card qrtalk-safety-card--warning";
        elements.icon.textContent = "⌛";
        elements.title.textContent = "Sessão encerrada por inatividade";
        elements.message.textContent = message || "A sala ficou 10 minutos sem atividade.";
        elements.detail.textContent = "Para conversar novamente, será necessário gerar ou escanear um novo QR Code.";
        elements.countdown.classList.add("hidden");
        elements.actions.classList.add("hidden");
    }

    function isMeaningfulPacket(packet) {
        const type = String(packet?.type || "");
        if (!type) return false;

        return (
            type.startsWith("chat:") ||
            type.startsWith("transfer:") ||
            type.startsWith("file:") ||
            type.startsWith("audio:") ||
            type.startsWith("camera:") ||
            ["text", "image", "video", "audio", "file", "nudge"].includes(type)
        );
    }

    function broadcastActivity(force = false) {
        const cfg = config();
        const now = Date.now();

        if (!force && now - state.lastBroadcastAt < cfg.activityBroadcastIntervalMs) {
            return;
        }

        state.lastBroadcastAt = now;
        safeSend({
            type: force ? TYPES.KEEPALIVE : TYPES.ACTIVITY,
            createdAt: now
        });
    }

    function markActivity(_source, broadcast = false) {
        if (!state.active || state.expiring) return;

        state.lastActivityAt = Date.now();
        hideWarning();

        if (broadcast) {
            broadcastActivity(false);
        }
    }

    function closeConnectionSoon(delay = 700) {
        window.setTimeout(() => {
            try {
                if (typeof window.disconnectPeer === "function") {
                    window.disconnectPeer();
                    return;
                }
                window.QRTalk?.conn?.close?.();
            } catch (error) {
                console.warn("[QRTalk/Inactivity] Falha ao encerrar conexão:", error);
            }
        }, delay);
    }

    function expireLocalSession() {
        if (!state.active || state.expiring) return;

        state.expiring = true;
        state.active = false;

        safeSend({
            type: TYPES.EXPIRED,
            reason: "inactivity",
            createdAt: Date.now()
        });

        showExpired();

        window.dispatchEvent(new CustomEvent("qrtalk:inactivity-expired", {
            detail: {
                createdAt: Date.now()
            }
        }));

        closeConnectionSoon();
    }

    function tick() {
        if (!state.active || state.expiring) return;

        const cfg = config();
        const elapsed = Date.now() - state.lastActivityAt;
        const remaining = cfg.timeoutMs - elapsed;

        if (remaining <= 0) {
            expireLocalSession();
            return;
        }

        if (remaining <= cfg.warningBeforeMs) {
            showWarning(remaining);
        } else if (state.warningVisible) {
            hideWarning();
        }
    }

    function startTimer() {
        stopTimer();

        state.active = true;
        state.expiring = false;
        state.lastActivityAt = Date.now();
        state.lastBroadcastAt = 0;
        hideWarning();

        state.intervalId = window.setInterval(tick, 1000);
        broadcastActivity(true);
    }

    function stopTimer() {
        state.active = false;
        state.expiring = false;

        if (state.intervalId) {
            window.clearInterval(state.intervalId);
            state.intervalId = null;
        }

        hideWarning();
    }

    function preventPacket(event) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
    }

    function handlePacket(event) {
        const packet = event.detail;
        if (!packet || typeof packet !== "object") return;

        if (packet.type === TYPES.ACTIVITY || packet.type === TYPES.KEEPALIVE) {
            preventPacket(event);
            markActivity("remote-activity", false);
            return;
        }

        if (packet.type === TYPES.EXPIRED) {
            preventPacket(event);
            state.expiring = true;
            state.active = false;
            showExpired("A outra pessoa também permaneceu sem atividade e a sala foi encerrada.");
            closeConnectionSoon();
            return;
        }

        if (isMeaningfulPacket(packet)) {
            markActivity("remote-content", false);
        }
    }

    function handleLocalInteraction(event) {
        if (!state.active || state.expiring) return;

        const target = event.target;

        /* O próprio aviso só deve ser fechado pelo botão Continuar.
        Escondê-lo no pointerdown poderia cancelar o click do botão. */
        if (target?.closest?.("#qrtalk-inactivity-overlay")) return;

        const relevant =
            target?.closest?.("#chat-screen") ||
            target?.id === "message-input" ||
            target?.closest?.(".qrtalk-safety-overlay");

        if (relevant) {
            markActivity("local-interaction", true);
        }
    }

    function initInactivity() {
        if (state.initialized) return;
        state.initialized = true;

        ensureUi();

        window.addEventListener("qrtalk:admission-ready", startTimer);
        window.addEventListener("qrtalk:disconnected", stopTimer);
        window.addEventListener("qrtalk:session-ended", stopTimer);
        window.addEventListener("qrtalk:policy-closed", stopTimer);

        window.addEventListener("qrtalk:message-sent", () => markActivity("message-sent", true));
        window.addEventListener("qrtalk:message-received", () => markActivity("message-received", false));

        document.addEventListener("pointerdown", handleLocalInteraction, { passive: true });
        document.addEventListener("touchstart", handleLocalInteraction, { passive: true });
        document.addEventListener("keydown", handleLocalInteraction, { passive: true });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) tick();
        });
    }

    /* Instalado antes de chat.js para consumir os pacotes session:* */
    window.addEventListener("qrtalk:packet", handlePacket);

    window.QRTalkInactivity = {
        init: initInactivity,
        start: startTimer,
        stop: stopTimer,
        markActivity,
        getState: () => ({ ...state })
    };

    window.initInactivity = initInactivity;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initInactivity);
    } else {
        initInactivity();
    }
})();
