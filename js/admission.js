/*
==================================================
QRTalk 3.1
Confirmação de entrada nos dois lados
==================================================
*/

"use strict";

(() => {
    const TYPES = Object.freeze({
        REQUEST: "admission:request",
        ACCEPTED: "admission:accepted",
        REJECTED: "admission:rejected",
        CANCELLED: "admission:cancelled"
    });

    const query = new URLSearchParams(window.location.search);
    const isGuest = Boolean(query.get("sala"));

    const state = {
        initialized: false,
        connected: false,
        admitted: false,
        preflightAccepted: !isGuest,
        requestSent: false,
        requestReceived: false,
        timeoutId: null,
        peerId: null
    };

    let ui = null;

    function config() {
        return window.QRTalkSafetyConfig?.admission || {
            requestTimeoutMs: 120000
        };
    }

    function preventPacket(event) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
    }

    function safeSend(packet) {
        if (typeof window.sendPeerPacket !== "function") return false;
        return window.sendPeerPacket(packet);
    }

    function isConnected() {
        if (typeof window.isPeerConnected === "function") {
            return window.isPeerConnected();
        }
        return Boolean(window.QRTalk?.conn?.open);
    }

    function goHome() {
        const destination = `${window.location.origin}${window.location.pathname}`;
        window.location.replace(destination);
    }

    function closeConnection() {
        try {
            if (typeof window.disconnectPeer === "function") {
                window.disconnectPeer();
                return;
            }
        } catch (error) {
            console.warn("[QRTalk/Admission] Falha ao usar disconnectPeer:", error);
        }

        try {
            window.QRTalk?.conn?.close?.();
        } catch (_error) {
            // A conexão já pode estar fechada.
        }
    }

    function setComposerEnabled(enabled) {
        const selectors = [
            "#message-input",
            "#send-btn",
            "#emoji-btn",
            "#camera-btn",
            "#gallery-btn",
            "#attach-btn",
            "#audio-btn"
        ];

        selectors.forEach((selector) => {
            const element = document.querySelector(selector);
            if (!element) return;
            element.disabled = !enabled;
            element.setAttribute("aria-disabled", String(!enabled));
        });

        document.documentElement.classList.toggle(
            "qrtalk-admission-locked",
            !enabled
        );
    }

    function ensureUi() {
        if (ui) return ui;

        const overlay = document.createElement("div");
        overlay.id = "qrtalk-admission-overlay";
        overlay.className = "qrtalk-safety-overlay hidden";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "qrtalk-admission-title");

        overlay.innerHTML = `
            <div class="qrtalk-safety-card qrtalk-safety-card--info">
                <div class="qrtalk-safety-icon" id="qrtalk-admission-icon">🔐</div>
                <h2 id="qrtalk-admission-title"></h2>
                <p id="qrtalk-admission-message"></p>
                <p id="qrtalk-admission-detail" class="qrtalk-safety-detail"></p>
                <div id="qrtalk-admission-progress" class="qrtalk-safety-progress hidden" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
                <div id="qrtalk-admission-actions" class="qrtalk-safety-actions"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        ui = {
            overlay,
            card: overlay.querySelector(".qrtalk-safety-card"),
            icon: overlay.querySelector("#qrtalk-admission-icon"),
            title: overlay.querySelector("#qrtalk-admission-title"),
            message: overlay.querySelector("#qrtalk-admission-message"),
            detail: overlay.querySelector("#qrtalk-admission-detail"),
            progress: overlay.querySelector("#qrtalk-admission-progress"),
            actions: overlay.querySelector("#qrtalk-admission-actions")
        };

        return ui;
    }

    function makeButton(label, variant, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `qrtalk-safety-button qrtalk-safety-button--${variant}`;
        button.textContent = label;
        button.addEventListener("click", handler, { once: true });
        return button;
    }

    function showDialog(options) {
        const elements = ensureUi();
        elements.overlay.classList.remove("hidden");
        elements.card.className = `qrtalk-safety-card qrtalk-safety-card--${options.kind || "info"}`;
        elements.icon.textContent = options.icon || "🔐";
        elements.title.textContent = options.title || "QRTalk";
        elements.message.textContent = options.message || "";
        elements.detail.textContent = options.detail || "";
        elements.detail.classList.toggle("hidden", !options.detail);
        elements.progress.classList.toggle("hidden", !options.progress);
        elements.actions.replaceChildren();

        (options.actions || []).forEach((action) => {
            elements.actions.appendChild(
                makeButton(action.label, action.variant || "secondary", action.handler)
            );
        });

        window.requestAnimationFrame(() => {
            elements.actions.querySelector("button")?.focus();
        });
    }

    function hideDialog() {
        ensureUi().overlay.classList.add("hidden");
    }

    function clearAdmissionTimeout() {
        if (state.timeoutId) {
            window.clearTimeout(state.timeoutId);
            state.timeoutId = null;
        }
    }

    function startAdmissionTimeout() {
        clearAdmissionTimeout();

        state.timeoutId = window.setTimeout(() => {
            if (state.admitted) return;

            safeSend({
                type: TYPES.CANCELLED,
                reason: "timeout",
                createdAt: Date.now()
            });

            showDialog({
                kind: "warning",
                icon: "⌛",
                title: "Solicitação expirada",
                message: "A entrada não foi confirmada dentro do prazo.",
                detail: "Nenhuma conversa foi iniciada.",
                actions: [
                    {
                        label: "Voltar ao início",
                        variant: "primary",
                        handler: goHome
                    }
                ]
            });

            closeConnection();
        }, config().requestTimeoutMs);
    }

    function showGuestPreflight() {
        setComposerEnabled(false);

        showDialog({
            kind: "info",
            icon: "📱",
            title: "Entrar nesta sala temporária?",
            message: "Você está prestes a entrar em uma sala privada do QRTalk.",
            detail: "Entre somente se reconhecer a pessoa ou o estabelecimento que forneceu este QR Code. A sala não exige nome, telefone ou cadastro.",
            actions: [
                {
                    label: "Cancelar",
                    variant: "secondary",
                    handler: () => {
                        safeSend({
                            type: TYPES.CANCELLED,
                            reason: "guest-cancelled",
                            createdAt: Date.now()
                        });
                        closeConnection();
                        goHome();
                    }
                },
                {
                    label: "Entrar na sala",
                    variant: "primary",
                    handler: acceptGuestPreflight
                }
            ]
        });
    }

    function showGuestWaiting() {
        showDialog({
            kind: "info",
            icon: "⏳",
            title: state.connected ? "Aguardando o criador" : "Conectando à sala",
            message: state.connected
                ? "Sua solicitação foi enviada. O criador da sala precisa aceitar sua entrada."
                : "Aguarde enquanto o QRTalk localiza o criador da sala.",
            detail: "Nenhuma mensagem ou arquivo será liberado antes da confirmação.",
            progress: true,
            actions: [
                {
                    label: "Cancelar",
                    variant: "secondary",
                    handler: () => {
                        safeSend({
                            type: TYPES.CANCELLED,
                            reason: "guest-cancelled",
                            createdAt: Date.now()
                        });
                        closeConnection();
                        goHome();
                    }
                }
            ]
        });
    }

    function showHostWaiting() {
        showDialog({
            kind: "info",
            icon: "🔗",
            title: "Conexão recebida",
            message: "Um aparelho abriu o QR Code desta sala.",
            detail: "Aguardando a pessoa confirmar que deseja entrar.",
            progress: true,
            actions: [
                {
                    label: "Cancelar conexão",
                    variant: "secondary",
                    handler: () => rejectAdmission("host-cancelled")
                }
            ]
        });
    }

    function showHostRequest() {
        showDialog({
            kind: "info",
            icon: "👤",
            title: "Solicitação de entrada",
            message: "Uma pessoa confirmou que deseja entrar nesta sala temporária.",
            detail: "A sala aceitará somente você e este participante.",
            actions: [
                {
                    label: "Recusar",
                    variant: "danger",
                    handler: () => rejectAdmission("host-rejected")
                },
                {
                    label: "Aceitar entrada",
                    variant: "primary",
                    handler: acceptAdmission
                }
            ]
        });
    }

    function acceptGuestPreflight() {
        state.preflightAccepted = true;
        showGuestWaiting();

        if (state.connected || isConnected()) {
            sendAdmissionRequest();
        }
    }

    function sendAdmissionRequest() {
        if (!isGuest || !state.preflightAccepted || state.requestSent || state.admitted) {
            return;
        }

        const sent = safeSend({
            type: TYPES.REQUEST,
            protocol: 1,
            createdAt: Date.now()
        });

        if (sent) {
            state.requestSent = true;
            showGuestWaiting();
        }
    }

    function unlockChat(role) {
        state.admitted = true;
        clearAdmissionTimeout();
        setComposerEnabled(true);
        hideDialog();

        window.showChat?.();
        window.scrollBottom?.();
        window.addSystemMessage?.("✅ Entrada confirmada nos dois aparelhos.");

        window.dispatchEvent(new CustomEvent("qrtalk:admission-ready", {
            detail: {
                role,
                peerId: state.peerId,
                createdAt: Date.now()
            }
        }));
    }

    function acceptAdmission() {
        if (isGuest || state.admitted || !state.requestReceived) return;

        const sent = safeSend({
            type: TYPES.ACCEPTED,
            protocol: 1,
            createdAt: Date.now()
        });

        if (!sent) {
            window.toast?.("Não foi possível confirmar a entrada.", "error");
            return;
        }

        unlockChat("host");
    }

    function rejectAdmission(reason = "rejected") {
        safeSend({
            type: TYPES.REJECTED,
            reason,
            createdAt: Date.now()
        });

        clearAdmissionTimeout();

        showDialog({
            kind: "warning",
            icon: "🚫",
            title: "Entrada recusada",
            message: "A conexão foi encerrada antes do início da conversa.",
            actions: [
                {
                    label: "Voltar ao início",
                    variant: "primary",
                    handler: goHome
                }
            ]
        });

        window.setTimeout(closeConnection, 350);
    }

    function handleAdmissionPacket(event, packet) {
        preventPacket(event);

        switch (packet.type) {
            case TYPES.REQUEST:
                if (isGuest || state.admitted) return;
                state.requestReceived = true;
                showHostRequest();
                break;

            case TYPES.ACCEPTED:
                if (!isGuest || state.admitted) return;
                unlockChat("guest");
                break;

            case TYPES.REJECTED:
                clearAdmissionTimeout();
                setComposerEnabled(false);
                showDialog({
                    kind: "warning",
                    icon: "🚫",
                    title: "Entrada não autorizada",
                    message: "O criador da sala não autorizou esta conexão.",
                    detail: "Nenhuma conversa foi iniciada.",
                    actions: [
                        {
                            label: "Voltar ao início",
                            variant: "primary",
                            handler: goHome
                        }
                    ]
                });
                window.setTimeout(closeConnection, 350);
                break;

            case TYPES.CANCELLED:
                clearAdmissionTimeout();
                setComposerEnabled(false);
                showDialog({
                    kind: "warning",
                    icon: "↩️",
                    title: "Solicitação cancelada",
                    message: "A outra pessoa cancelou a entrada na sala.",
                    actions: [
                        {
                            label: "Voltar ao início",
                            variant: "primary",
                            handler: goHome
                        }
                    ]
                });
                window.setTimeout(closeConnection, 350);
                break;

            default:
                break;
        }
    }

    function isUserContentPacket(packet) {
        const type = String(packet?.type || "").toLowerCase();
        if (!type) return false;

        if (
            type.startsWith("admission:") ||
            type.startsWith("crypto:") ||
            type.startsWith("presence:") ||
            type.startsWith("receipt:") ||
            type.startsWith("policy:") ||
            type.startsWith("session:") ||
            type.startsWith("heartbeat") ||
            type.startsWith("peer:")
        ) {
            return false;
        }

        return (
            type.startsWith("chat:") ||
            type.startsWith("transfer:") ||
            type.startsWith("file:") ||
            type.startsWith("audio:") ||
            type.startsWith("camera:") ||
            ["text", "image", "video", "audio", "file", "nudge"].includes(type)
        );
    }

    function handlePacket(event) {
        const packet = event.detail;
        if (!packet || typeof packet !== "object") return;

        if (String(packet.type || "").startsWith("admission:")) {
            handleAdmissionPacket(event, packet);
            return;
        }

        if (!state.admitted && isUserContentPacket(packet)) {
            preventPacket(event);
            console.warn("[QRTalk/Admission] Pacote bloqueado antes da confirmação:", packet.type);
        }
    }

    function handleConnected(event) {
        state.connected = true;
        state.admitted = false;
        state.requestSent = false;
        state.requestReceived = false;
        state.peerId = event.detail?.peerId || window.QRTalk?.conn?.peer || null;

        setComposerEnabled(false);
        startAdmissionTimeout();

        if (isGuest) {
            if (state.preflightAccepted) {
                showGuestWaiting();
                sendAdmissionRequest();
            } else {
                showGuestPreflight();
            }
        } else {
            showHostWaiting();
        }
    }

    function handleDisconnected() {
        clearAdmissionTimeout();
        state.connected = false;
        state.admitted = false;
        state.requestSent = false;
        state.requestReceived = false;
        state.peerId = null;
        setComposerEnabled(false);
    }

    function initAdmission() {
        if (state.initialized) return;
        state.initialized = true;

        ensureUi();
        setComposerEnabled(false);

        if (isGuest) {
            showGuestPreflight();
        }

        window.addEventListener("qrtalk:connected", handleConnected);
        window.addEventListener("qrtalk:disconnected", handleDisconnected);
        window.addEventListener("qrtalk:session-ended", handleDisconnected);
    }

    /*
    O listener de pacotes é instalado imediatamente para ficar antes
    dos módulos de chat que serão carregados depois deste arquivo.
    */
    window.addEventListener("qrtalk:packet", handlePacket);

    window.QRTalkAdmission = {
        init: initAdmission,
        isGuest: () => isGuest,
        isAdmitted: () => state.admitted,
        getState: () => ({ ...state })
    };

    window.initAdmission = initAdmission;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAdmission);
    } else {
        initAdmission();
    }
})();
