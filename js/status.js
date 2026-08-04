/*
==================================================
QRTalk 3.0
Status online, ausente e última atividade
==================================================
*/

"use strict";

(() => {
    /*
    ==================================================
    CONFIGURAÇÕES
    ==================================================
    */

    const PACKET_TYPES = Object.freeze({
        STATUS: "presence:status",
        REQUEST: "presence:request"
    });

    /*
    Tempo sem interação até o usuário aparecer
    como ausente.
    */

    const LOCAL_IDLE_DELAY = 90000;

    /*
    Intervalo para atualizar o estado remoto.
    São pacotes muito pequenos.
    */

    const PRESENCE_REFRESH_INTERVAL = 20000;

    /*
    Limita quantas atualizações de atividade podem
    ser enviadas enquanto a pessoa interage.
    */

    const ACTIVITY_SEND_THROTTLE = 10000;

    /*
    Atualiza o texto de "visto por último" sem
    precisar recarregar a página.
    */

    const LAST_SEEN_UPDATE_INTERVAL = 30000;

    const PRESENCE_STATES = Object.freeze({
        ONLINE: "online",
        AWAY: "away",
        OFFLINE: "offline"
    });

    let initialized = false;

    let localIdleTimer = null;
    let presenceRefreshTimer = null;
    let lastSeenUpdateTimer = null;

    let lastPresenceSentAt = 0;
    let lastSentState = null;

    /*
    ==================================================
    LOGS
    ==================================================
    */

    function statusLog(...args) {
        console.log(
            "[QRTalk/Status]",
            ...args
        );
    }

    function statusWarn(...args) {
        console.warn(
            "[QRTalk/Status]",
            ...args
        );
    }

    /*
    ==================================================
    ESTRUTURA DE ESTADO
    ==================================================
    */

    function ensurePresenceState() {
        if (
            !QRTalk.presence ||
            typeof QRTalk.presence !== "object"
        ) {
            QRTalk.presence = {
                local: {
                    state:
                        PRESENCE_STATES.ONLINE,

                    visible:
                        !document.hidden,

                    lastActiveAt:
                        Date.now(),

                    updatedAt:
                        Date.now()
                },

                remote: {
                    state:
                        PRESENCE_STATES.OFFLINE,

                    connected:
                        false,

                    visible:
                        false,

                    lastActiveAt:
                        null,

                    updatedAt:
                        null
                }
            };
        }

        return QRTalk.presence;
    }

    /*
    ==================================================
    ELEMENTOS
    ==================================================
    */

    function getStatusDot() {
        return document.getElementById(
            "status-dot"
        );
    }

    function getStatusText() {
        return document.getElementById(
            "chat-status"
        );
    }

    /*
    ==================================================
    CONEXÃO
    ==================================================
    */

    function isConnected() {
        return Boolean(
            typeof window.isPeerConnected ===
                "function" &&
            window.isPeerConnected()
        );
    }

    /*
    ==================================================
    FORMATAÇÃO DA ÚLTIMA ATIVIDADE
    ==================================================
    */

    function formatTime(timestamp) {
        const date =
            new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString(
            "pt-BR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function isSameCalendarDay(
        first,
        second
    ) {
        return (
            first.getFullYear() ===
                second.getFullYear() &&
            first.getMonth() ===
                second.getMonth() &&
            first.getDate() ===
                second.getDate()
        );
    }

    function formatLastSeen(timestamp) {
        if (!timestamp) {
            return "Offline";
        }

        const date =
            new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "Offline";
        }

        const now =
            new Date();

        const yesterday =
            new Date(now);

        yesterday.setDate(
            now.getDate() - 1
        );

        if (
            isSameCalendarDay(
                date,
                now
            )
        ) {
            return (
                "Visto por último às " +
                formatTime(timestamp)
            );
        }

        if (
            isSameCalendarDay(
                date,
                yesterday
            )
        ) {
            return (
                "Visto ontem às " +
                formatTime(timestamp)
            );
        }

        const dateText =
            date.toLocaleDateString(
                "pt-BR",
                {
                    day: "2-digit",
                    month: "2-digit"
                }
            );

        return (
            `Visto em ${dateText} às ` +
            formatTime(timestamp)
        );
    }

    /*
    ==================================================
    APARÊNCIA DO STATUS
    ==================================================
    */

    function resetDotStyle(dot) {
        if (!dot) {
            return;
        }

        dot.style.removeProperty(
            "background"
        );

        dot.style.removeProperty(
            "box-shadow"
        );
    }

    function renderRemotePresence() {
        const presence =
            ensurePresenceState();

        const remote =
            presence.remote;

        const dot =
            getStatusDot();

        const statusText =
            getStatusText();

        if (!dot || !statusText) {
            return;
        }

        dot.classList.remove(
            "online",
            "offline",
            "away"
        );

        resetDotStyle(dot);

        /*
        Sem conexão de dados aberta.
        */

        if (
            !remote.connected ||
            remote.state ===
                PRESENCE_STATES.OFFLINE
        ) {
            dot.classList.add(
                "offline"
            );

            statusText.textContent =
                formatLastSeen(
                    remote.lastActiveAt
                );

            return;
        }

        /*
        Conectado, mas com a página oculta ou
        sem atividade recente.
        */

        if (
            remote.state ===
            PRESENCE_STATES.AWAY
        ) {
            dot.classList.add(
                "offline",
                "away"
            );

            dot.style.background =
                "#f59e0b";

            dot.style.boxShadow =
                "0 0 10px rgba(245, 158, 11, 0.75)";

            statusText.textContent =
                "Ausente";

            return;
        }

        /*
        Online e ativo.
        */

        dot.classList.add(
            "online"
        );

        statusText.textContent =
            "Online";
    }

    /*
    ==================================================
    ENVIO DO STATUS
    ==================================================
    */

    function createPresencePacket() {
        const presence =
            ensurePresenceState();

        return {
            type:
                PACKET_TYPES.STATUS,

            state:
                presence.local.state,

            visible:
                presence.local.visible,

            lastActiveAt:
                presence.local.lastActiveAt,

            updatedAt:
                Date.now()
        };
    }

    function sendPresence(
        force = false
    ) {
        if (
            !isConnected() ||
            typeof window.sendPeerPacket !==
                "function"
        ) {
            return false;
        }

        const presence =
            ensurePresenceState();

        const now =
            Date.now();

        const stateChanged =
            lastSentState !==
            presence.local.state;

        if (
            !force &&
            !stateChanged &&
            now - lastPresenceSentAt <
                ACTIVITY_SEND_THROTTLE
        ) {
            return false;
        }

        const sent =
            window.sendPeerPacket(
                createPresencePacket()
            );

        if (sent) {
            lastPresenceSentAt = now;

            lastSentState =
                presence.local.state;
        }

        return sent;
    }

    function requestRemotePresence() {
        if (
            !isConnected() ||
            typeof window.sendPeerPacket !==
                "function"
        ) {
            return false;
        }

        return window.sendPeerPacket({
            type:
                PACKET_TYPES.REQUEST,

            requestedAt:
                Date.now()
        });
    }

    /*
    ==================================================
    ALTERAR ESTADO LOCAL
    ==================================================
    */

    function setLocalPresence(
        state,
        options = {}
    ) {
        const presence =
            ensurePresenceState();

        const validState =
            Object.values(
                PRESENCE_STATES
            ).includes(state)
                ? state
                : PRESENCE_STATES.ONLINE;

        const changed =
            presence.local.state !==
            validState;

        presence.local.state =
            validState;

        presence.local.visible =
            !document.hidden;

        presence.local.updatedAt =
            Date.now();

        if (
            options.updateActivity !==
            false
        ) {
            presence.local.lastActiveAt =
                Date.now();
        }

        if (
            options.send !== false &&
            (
                changed ||
                options.force === true
            )
        ) {
            sendPresence(
                options.force === true
            );
        }

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:local-presence",
                {
                    detail: {
                        ...presence.local
                    }
                }
            )
        );
    }

    /*
    ==================================================
    ATIVIDADE LOCAL
    ==================================================
    */

    function clearLocalIdleTimer() {
        if (!localIdleTimer) {
            return;
        }

        window.clearTimeout(
            localIdleTimer
        );

        localIdleTimer = null;
    }

    function scheduleLocalIdle() {
        clearLocalIdleTimer();

        if (document.hidden) {
            return;
        }

        localIdleTimer =
            window.setTimeout(() => {
                setLocalPresence(
                    PRESENCE_STATES.AWAY,
                    {
                        updateActivity:
                            false,

                        force:
                            true
                    }
                );
            }, LOCAL_IDLE_DELAY);
    }

    function markLocalActivity() {
        const presence =
            ensurePresenceState();

        const now =
            Date.now();

        presence.local.lastActiveAt =
            now;

        presence.local.visible =
            !document.hidden;

        presence.local.updatedAt =
            now;

        const wasAway =
            presence.local.state !==
            PRESENCE_STATES.ONLINE;

        presence.local.state =
            PRESENCE_STATES.ONLINE;

        scheduleLocalIdle();

        sendPresence(wasAway);

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:local-activity",
                {
                    detail: {
                        occurredAt:
                            now
                    }
                }
            )
        );
    }

    /*
    ==================================================
    ESTADO REMOTO
    ==================================================
    */

    function updateRemotePresence(
        data = {}
    ) {
        const presence =
            ensurePresenceState();

        const remote =
            presence.remote;

        const validStates =
            Object.values(
                PRESENCE_STATES
            );

        const receivedState =
            validStates.includes(
                data.state
            )
                ? data.state
                : PRESENCE_STATES.ONLINE;

        remote.connected =
            isConnected();

        remote.state =
            remote.connected
                ? receivedState
                : PRESENCE_STATES.OFFLINE;

        remote.visible =
            Boolean(data.visible);

        remote.updatedAt =
            Number(data.updatedAt) ||
            Date.now();

        if (
            Number.isFinite(
                Number(
                    data.lastActiveAt
                )
            )
        ) {
            remote.lastActiveAt =
                Number(
                    data.lastActiveAt
                );
        } else if (
            receivedState ===
            PRESENCE_STATES.ONLINE
        ) {
            remote.lastActiveAt =
                Date.now();
        }

        renderRemotePresence();

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:remote-presence",
                {
                    detail: {
                        ...remote
                    }
                }
            )
        );
    }

    function markRemoteActivity() {
        const presence =
            ensurePresenceState();

        const remote =
            presence.remote;

        remote.connected =
            isConnected();

        remote.lastActiveAt =
            Date.now();

        remote.updatedAt =
            Date.now();

        /*
        Um pacote enviado pela outra pessoa comprova
        atividade, exceto quando ela informou que está
        com a página oculta.
        */

        if (
            remote.connected &&
            remote.visible !== false
        ) {
            remote.state =
                PRESENCE_STATES.ONLINE;
        }

        renderRemotePresence();
    }

    /*
    ==================================================
    PACOTES RECEBIDOS
    ==================================================
    */

    function handlePresencePacket(event) {
        const packet =
            event.detail;

        if (
            !packet ||
            typeof packet.type !==
                "string"
        ) {
            return;
        }

        /*
        Qualquer pacote recebido comprova que a
        conexão remota ainda está ativa.
        */

        if (
            packet.type !==
            PACKET_TYPES.STATUS &&
            packet.type !==
            PACKET_TYPES.REQUEST
        ) {
            markRemoteActivity();

            return;
        }

        event.preventDefault();

        if (
            packet.type ===
            PACKET_TYPES.REQUEST
        ) {
            sendPresence(true);

            return;
        }

        updateRemotePresence(
            packet
        );
    }

    /*
    ==================================================
    CONEXÃO ABERTA
    ==================================================
    */

    function handleConnected() {
        const presence =
            ensurePresenceState();

        presence.remote.connected =
            true;

        presence.remote.state =
            PRESENCE_STATES.ONLINE;

        presence.remote.lastActiveAt =
            Date.now();

        presence.remote.updatedAt =
            Date.now();

        renderRemotePresence();

        lastPresenceSentAt = 0;
        lastSentState = null;

        sendPresence(true);

        window.setTimeout(() => {
            requestRemotePresence();
        }, 250);

        startPresenceRefresh();

        scheduleLocalIdle();
    }

    /*
    ==================================================
    CONEXÃO FECHADA
    ==================================================
    */

    function handleDisconnected() {
        const presence =
            ensurePresenceState();

        const remote =
            presence.remote;

        remote.connected = false;
        remote.state =
            PRESENCE_STATES.OFFLINE;

        remote.lastActiveAt =
            remote.lastActiveAt ||
            Date.now();

        remote.updatedAt =
            Date.now();

        renderRemotePresence();

        stopPresenceRefresh();

        lastPresenceSentAt = 0;
        lastSentState = null;
    }

    /*
    ==================================================
    VISIBILIDADE DA PÁGINA
    ==================================================
    */

    function handleVisibilityChange() {
        const presence =
            ensurePresenceState();

        presence.local.visible =
            !document.hidden;

        presence.local.updatedAt =
            Date.now();

        if (document.hidden) {
            clearLocalIdleTimer();

            setLocalPresence(
                PRESENCE_STATES.AWAY,
                {
                    updateActivity:
                        false,

                    force:
                        true
                }
            );

            return;
        }

        markLocalActivity();

        sendPresence(true);
    }

    /*
    ==================================================
    ATUALIZAÇÃO PERIÓDICA
    ==================================================
    */

    function startPresenceRefresh() {
        stopPresenceRefresh();

        presenceRefreshTimer =
            window.setInterval(() => {
                if (!isConnected()) {
                    return;
                }

                sendPresence(true);
            }, PRESENCE_REFRESH_INTERVAL);
    }

    function stopPresenceRefresh() {
        if (!presenceRefreshTimer) {
            return;
        }

        window.clearInterval(
            presenceRefreshTimer
        );

        presenceRefreshTimer = null;
    }

    function startLastSeenUpdater() {
        stopLastSeenUpdater();

        lastSeenUpdateTimer =
            window.setInterval(() => {
                const presence =
                    ensurePresenceState();

                if (
                    !presence.remote.connected
                ) {
                    renderRemotePresence();
                }
            }, LAST_SEEN_UPDATE_INTERVAL);
    }

    function stopLastSeenUpdater() {
        if (!lastSeenUpdateTimer) {
            return;
        }

        window.clearInterval(
            lastSeenUpdateTimer
        );

        lastSeenUpdateTimer = null;
    }

    /*
    ==================================================
    EVENTOS DE ATIVIDADE
    ==================================================
    */

    function bindActivityEvents() {
        const activityEvents = [
            "pointerdown",
            "keydown",
            "touchstart"
        ];

        activityEvents.forEach(
            (eventName) => {
                document.addEventListener(
                    eventName,
                    markLocalActivity,
                    {
                        passive: true
                    }
                );
            }
        );

        /*
        Movimento do mouse pode disparar centenas de
        eventos. A própria função sendPresence possui
        limite de frequência, mas usamos um listener
        passivo para não atrapalhar a interface.
        */

        document.addEventListener(
            "mousemove",
            markLocalActivity,
            {
                passive: true
            }
        );
    }

    /*
    ==================================================
    ENCERRAMENTO
    ==================================================
    */

    function handlePageHide() {
        clearLocalIdleTimer();
        stopPresenceRefresh();
        stopLastSeenUpdater();

        if (
            isConnected() &&
            typeof window.sendPeerPacket ===
                "function"
        ) {
            try {
                window.sendPeerPacket({
                    type:
                        PACKET_TYPES.STATUS,

                    state:
                        PRESENCE_STATES.OFFLINE,

                    visible:
                        false,

                    lastActiveAt:
                        Date.now(),

                    updatedAt:
                        Date.now()
                });
            } catch (_) {
                /*
                O navegador pode cancelar operações
                durante o fechamento da página.
                */
            }
        }
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initStatus() {
        if (initialized) {
            return;
        }

        initialized = true;

        ensurePresenceState();

        bindActivityEvents();

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener(
            "focus",
            markLocalActivity
        );

        window.addEventListener(
            "qrtalk:packet",
            handlePresencePacket
        );

        window.addEventListener(
            "qrtalk:connected",
            handleConnected
        );

        window.addEventListener(
            "qrtalk:disconnected",
            handleDisconnected
        );

        window.addEventListener(
            "qrtalk:session-ended",
            handleDisconnected
        );

        window.addEventListener(
            "pagehide",
            handlePageHide
        );

        startLastSeenUpdater();

        scheduleLocalIdle();

        /*
        Antes da primeira conexão, o contato remoto
        permanece offline.
        */

        renderRemotePresence();

        statusLog(
            "Controle de presença iniciado."
        );
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initStatus =
        initStatus;

    window.setLocalPresence =
        setLocalPresence;

    window.sendPresence =
        sendPresence;

    window.requestRemotePresence =
        requestRemotePresence;

    window.markLocalActivity =
        markLocalActivity;

    window.renderRemotePresence =
        renderRemotePresence;

    window.getRemotePresence =
        () => ({
            ...ensurePresenceState()
                .remote
        });

    /*
    O app.js não chama initStatus diretamente,
    então o módulo se inicializa sozinho.
    */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initStatus
        );
    } else {
        initStatus();
    }
})();