	/*
==================================================
QRTalk 3.0
Conexão P2P, sala, QR Code e ciclo da sessão
==================================================
*/

"use strict";

(() => {
    const HEARTBEAT_INTERVAL = 5000;
    const CONNECTION_TIMEOUT = 17000;
    const MAX_RECONNECT_DELAY = 10000;
    const MAX_RECONNECT_ATTEMPTS = 12;

    const SYSTEM_TYPES = Object.freeze({
        HELLO: "system:hello",
        HELLO_ACK: "system:hello-ack",
        PING: "heartbeat:ping",
        PONG: "heartbeat:pong",
        DISCONNECT: "session:disconnect",
        ROOM_BUSY: "session:room-busy",
        NUDGE: "nudge"
    });

    let reconnectTimer = null;
    let connectionSequence = 0;

    /*
    ==================================================
    COMPATIBILIDADE TEMPORÁRIA
    ==================================================
    */

    /*
    Enquanto o arquivo notifications.js ainda não existir,
    essa função vazia evita que o app.js pare de executar.
    Quando criarmos notifications.js, ela será substituída.
    */

    if (typeof window.initNotifications !== "function") {
        window.initNotifications = () => {};
    }

    /*
    ==================================================
    LOGS
    ==================================================
    */

    function peerLog(...args) {
        console.log("[QRTalk/Peer]", ...args);
    }

    function peerWarn(...args) {
        console.warn("[QRTalk/Peer]", ...args);
    }

    /*
    ==================================================
    STATUS DA TELA INICIAL
    ==================================================
    */

    function setSetupMessage(message) {
        if (typeof window.setSetupStatus === "function") {
            window.setSetupStatus(message);
            return;
        }

        const element = document.getElementById("status-label");

        if (element) {
            element.textContent = message;
        }
    }

    /*
    ==================================================
    STATUS ONLINE/OFFLINE
    ==================================================
    */

    function updateOnlineState(isOnline, text) {
        if (isOnline) {
            if (typeof window.setOnline === "function") {
                window.setOnline();
            }
        } else if (typeof window.setOffline === "function") {
            window.setOffline();
        }

        if (text && typeof window.setStatus === "function") {
            window.setStatus(text);
        }
    }

    /*
    ==================================================
    EVENTOS INTERNOS DO QRTALK
    ==================================================
    */

    function emit(name, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(name, {
                detail
            })
        );
    }

    /*
    ==================================================
    URL DA SALA
    ==================================================
    */

    function createRoomUrl(peerId) {
        const url = new URL(window.location.href);

        url.search = "";
        url.hash = "";
        url.searchParams.set("sala", peerId);

        return url.toString();
    }

    function getTargetPeerId() {
        const value = new URLSearchParams(
            window.location.search
        ).get("sala");

        return value ? value.trim() : "";
    }

    /*
    ==================================================
    QR CODE
    ==================================================
    */

    function renderQrCode(roomUrl) {
        const container = QRTalk.elements.qrcode;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (typeof window.QRCode !== "function") {
            setSetupMessage(
                "Não foi possível carregar o gerador de QR Code."
            );

            return;
        }

        new QRCode(container, {
            text: roomUrl,
            width: 184,
            height: 184,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    /*
    ==================================================
    COPIAR LINK
    ==================================================
    */

    async function copyRoomLink() {
        const roomUrl = QRTalk.roomUrl;

        if (!roomUrl) {
            setSetupMessage(
                "O link da sala ainda não está disponível."
            );

            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(roomUrl);
            } else {
                const input = document.createElement("textarea");

                input.value = roomUrl;
                input.setAttribute("readonly", "");
                input.style.position = "fixed";
                input.style.opacity = "0";

                document.body.appendChild(input);

                input.select();

                document.execCommand("copy");

                input.remove();
            }

            setSetupMessage("Link da sala copiado.");
        } catch (error) {
            peerWarn("Falha ao copiar o link:", error);

            setSetupMessage(
                "Não foi possível copiar. Selecione o endereço do navegador."
            );
        }
    }

    /*
    ==================================================
    TIMER DE RECONEXÃO
    ==================================================
    */

    function clearReconnectTimer() {
        if (!reconnectTimer) {
            return;
        }

        clearTimeout(reconnectTimer);

        reconnectTimer = null;
    }

    /*
    ==================================================
    HEARTBEAT
    ==================================================
    */

    function stopHeartbeat() {
        if (!QRTalk.heartbeat) {
            return;
        }

        clearInterval(QRTalk.heartbeat);

        QRTalk.heartbeat = null;
    }

    function startHeartbeat(connectionId) {
        stopHeartbeat();

        QRTalk.lastSeenAt = Date.now();

        QRTalk.heartbeat = window.setInterval(() => {
            if (
                !QRTalk.conn ||
                !QRTalk.conn.open ||
                QRTalk.activeConnectionId !== connectionId
            ) {
                stopHeartbeat();

                return;
            }

            const silentFor =
                Date.now() - QRTalk.lastSeenAt;

            if (silentFor > CONNECTION_TIMEOUT) {
                peerWarn(
                    "Tempo limite da conexão atingido."
                );

                updateOnlineState(
                    false,
                    "Conexão perdida"
                );

                try {
                    QRTalk.conn.close();
                } catch (error) {
                    peerWarn(
                        "Erro ao fechar conexão expirada:",
                        error
                    );
                }

                stopHeartbeat();

                return;
            }

            sendPeerPacket({
                type: SYSTEM_TYPES.PING,
                sentAt: Date.now()
            });
        }, HEARTBEAT_INTERVAL);
    }

    /*
    ==================================================
    VALIDAÇÃO DOS PACOTES
    ==================================================
    */

    function normalizePacket(data) {
        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return null;
        }

        return data;
    }

    /*
    ==================================================
    ENCAMINHAR PACOTES PARA OS OUTROS MÓDULOS
    ==================================================
    */

    function dispatchApplicationPacket(packet) {
        const event = new CustomEvent(
            "qrtalk:packet",
            {
                detail: packet,
                cancelable: true
            }
        );

        window.dispatchEvent(event);

        /*
        O futuro chat.js poderá chamar event.preventDefault()
        para informar que tratou o pacote.

        Enquanto chat.js ainda não estiver pronto, mensagens
        simples de texto continuam podendo ser exibidas.
        */

        if (event.defaultPrevented) {
            return;
        }

        if (
            packet.type === "text" &&
            typeof window.addTextMessage === "function"
        ) {
            window.addTextMessage(
                String(packet.content ?? ""),
                "received"
            );
        }
    }

    /*
    ==================================================
    CHAMAR ATENÇÃO
    ==================================================
    */

    function handleNudgeReceived() {
        if ("vibrate" in navigator) {
            navigator.vibrate([
                180,
                90,
                180,
                90,
                320
            ]);
        }

        const chatScreen =
            QRTalk.elements.chatScreen;

        if (chatScreen) {
            chatScreen.classList.remove("shake");

            /*
            Força o navegador a reiniciar a animação,
            mesmo quando o botão for usado várias vezes.
            */

            void chatScreen.offsetWidth;

            chatScreen.classList.add("shake");

            window.setTimeout(() => {
                chatScreen.classList.remove("shake");
            }, 550);
        }

        playNudgeSound();

        if (
            typeof window.addSystemMessage === "function"
        ) {
            window.addSystemMessage(
                "🔔 A outra pessoa chamou sua atenção."
            );
        }

        document.title =
            "🔔 QRTalk — atenção";

        emit("qrtalk:nudge");
    }

    function playNudgeSound() {
        try {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) {
                return;
            }

            const context =
                new AudioContextClass();

            const oscillator =
                context.createOscillator();

            const gain =
                context.createGain();

            oscillator.type = "sine";

            oscillator.frequency.setValueAtTime(
                880,
                context.currentTime
            );

            gain.gain.setValueAtTime(
                0.08,
                context.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.35
            );

            oscillator.connect(gain);

            gain.connect(context.destination);

            oscillator.start();

            oscillator.stop(
                context.currentTime + 0.35
            );

            oscillator.addEventListener(
                "ended",
                () => {
                    context.close();
                }
            );
        } catch (error) {
            peerWarn(
                "Não foi possível reproduzir o alerta:",
                error
            );
        }
    }

    /*
    ==================================================
    RECEBIMENTO DE DADOS
    ==================================================
    */

    function handleIncomingData(rawData) {
        QRTalk.lastSeenAt = Date.now();

        const packet =
            normalizePacket(rawData);

        if (
            !packet ||
            typeof packet.type !== "string"
        ) {
            peerWarn(
                "Pacote inválido recebido:",
                rawData
            );

            return;
        }

        switch (packet.type) {
            case SYSTEM_TYPES.HELLO:
                sendPeerPacket({
                    type: SYSTEM_TYPES.HELLO_ACK,
                    version: QRTalk.version,
                    sentAt: Date.now()
                });

                emit("qrtalk:hello", packet);

                break;

            case SYSTEM_TYPES.HELLO_ACK:
                emit(
                    "qrtalk:hello-ack",
                    packet
                );

                break;

            case SYSTEM_TYPES.PING:
                sendPeerPacket({
                    type: SYSTEM_TYPES.PONG,
                    pingSentAt:
                        packet.sentAt || null,
                    sentAt: Date.now()
                });

                break;

            case SYSTEM_TYPES.PONG:
                QRTalk.lastPongAt =
                    Date.now();

                break;

            case SYSTEM_TYPES.DISCONNECT:
                handleRemoteDisconnect(
                    packet.reason ||
                    "A outra pessoa encerrou a conversa."
                );

                break;

            case SYSTEM_TYPES.ROOM_BUSY:
                QRTalk.leaving = true;

                updateOnlineState(
                    false,
                    "Sala ocupada"
                );

                setSetupMessage(
                    "Esta sala já está sendo usada por duas pessoas."
                );

                window.setTimeout(
                    resetToHome,
                    2500
                );

                break;

            case SYSTEM_TYPES.NUDGE:
                handleNudgeReceived();

                break;

            default:
                dispatchApplicationPacket(
                    packet
                );

                break;
        }
    }

    /*
    ==================================================
    ACEITAR CONEXÃO
    ==================================================
    */

    function acceptConnection(connection) {
        if (!connection) {
            return;
        }

        const current = QRTalk.conn;

        /*
        A sala permite apenas duas pessoas.

        Se já houver alguém conectado, qualquer terceira
        conexão será rejeitada.
        */

        if (
            current &&
            current.open &&
            current !== connection
        ) {
            try {
                connection.on("open", () => {
                    connection.send({
                        type:
                            SYSTEM_TYPES.ROOM_BUSY,

                        sentAt:
                            Date.now()
                    });

                    connection.close();
                });
            } catch (error) {
                peerWarn(
                    "Erro ao rejeitar conexão adicional:",
                    error
                );
            }

            return;
        }

        clearReconnectTimer();

        QRTalk.conn = connection;

        QRTalk.activeConnectionId =
            ++connectionSequence;

        const connectionId =
            QRTalk.activeConnectionId;

        /*
        ==================================================
        CONEXÃO ABERTA
        ==================================================
        */

        connection.on("open", () => {
            if (
                QRTalk.activeConnectionId !==
                connectionId
            ) {
                return;
            }

            QRTalk.connected = true;
            QRTalk.reconnectAttempts = 0;
            QRTalk.lastSeenAt = Date.now();

            if (
                typeof window.showChat ===
                "function"
            ) {
                window.showChat();
            }

            updateOnlineState(
                true,
                "Online"
            );

            sendPeerPacket({
                type: SYSTEM_TYPES.HELLO,
                version: QRTalk.version,
                role: QRTalk.mode,
                sentAt: Date.now()
            });

            startHeartbeat(connectionId);

            if (
                !QRTalk.hasConnectedBefore &&
                typeof window.addSystemMessage ===
                    "function"
            ) {
                window.addSystemMessage(
                    "Conversa P2P iniciada."
                );
            } else if (
                QRTalk.hasConnectedBefore &&
                typeof window.addSystemMessage ===
                    "function"
            ) {
                window.addSystemMessage(
                    "Conexão restabelecida."
                );
            }

            QRTalk.hasConnectedBefore = true;

            emit("qrtalk:connected", {
                peerId: connection.peer,
                mode: QRTalk.mode
            });
        });

        /*
        ==================================================
        DADOS RECEBIDOS
        ==================================================
        */

        connection.on(
            "data",
            handleIncomingData
        );

        /*
        ==================================================
        ERRO DA CONEXÃO
        ==================================================
        */

        connection.on(
            "error",
            (error) => {
                peerWarn(
                    "Erro na conexão de dados:",
                    error
                );

                emit(
                    "qrtalk:connection-error",
                    {
                        error
                    }
                );
            }
        );

        /*
        ==================================================
        CONEXÃO FECHADA
        ==================================================
        */

        connection.on("close", () => {
            if (
                QRTalk.activeConnectionId !==
                connectionId
            ) {
                return;
            }

            stopHeartbeat();

            QRTalk.connected = false;

            updateOnlineState(
                false,
                QRTalk.leaving
                    ? "Encerrado"
                    : "Reconectando..."
            );

            emit(
                "qrtalk:disconnected",
                {
                    intentional:
                        QRTalk.leaving,

                    peerId:
                        connection.peer
                }
            );

            if (
                !QRTalk.leaving &&
                QRTalk.mode === "guest"
            ) {
                scheduleGuestReconnect();
            } else if (
                !QRTalk.leaving &&
                QRTalk.mode === "host"
            ) {
                QRTalk.conn = null;

                setSetupMessage(
                    "Aguardando a outra pessoa reconectar..."
                );
            }
        });
    }

    /*
    ==================================================
    CONECTAR AO CRIADOR DA SALA
    ==================================================
    */

    function connectToHost() {
        if (
            QRTalk.leaving ||
            !QRTalk.peer ||
            QRTalk.peer.destroyed ||
            !QRTalk.targetPeerId
        ) {
            return;
        }

        if (
            QRTalk.conn &&
            QRTalk.conn.open
        ) {
            return;
        }

        if (
            QRTalk.reconnectAttempts > 0
        ) {
            setSetupMessage(
                `Reconectando... tentativa ${QRTalk.reconnectAttempts}`
            );
        } else {
            setSetupMessage(
                "Conectando ao criador da sala..."
            );
        }

        try {
            const connection =
                QRTalk.peer.connect(
                    QRTalk.targetPeerId,
                    {
                        reliable: true,

                        /*
                        O formato binary permite enviar,
                        nos próximos módulos, ArrayBuffer,
                        arquivos, imagens, áudio e vídeo.
                        */

                        serialization:
                            "binary",

                        metadata: {
                            app: "QRTalk",
                            version:
                                QRTalk.version
                        }
                    }
                );

            acceptConnection(connection);
        } catch (error) {
            peerWarn(
                "Falha ao iniciar conexão:",
                error
            );

            scheduleGuestReconnect();
        }
    }

    /*
    ==================================================
    RECONEXÃO DO CONVIDADO
    ==================================================
    */

    function scheduleGuestReconnect() {
        if (
            QRTalk.leaving ||
            QRTalk.mode !== "guest"
        ) {
            return;
        }

        if (reconnectTimer) {
            return;
        }

        QRTalk.reconnectAttempts =
            (QRTalk.reconnectAttempts || 0) + 1;

        if (
            QRTalk.reconnectAttempts >
            MAX_RECONNECT_ATTEMPTS
        ) {
            updateOnlineState(
                false,
                "Não foi possível reconectar"
            );

            setSetupMessage(
                "A sala não está mais disponível."
            );

            return;
        }

        /*
        A espera aumenta gradualmente:

        1 segundo
        1,55 segundo
        2,4 segundos
        ...

        Até o máximo de 10 segundos.
        */

        const delay = Math.min(
            1000 *
                Math.pow(
                    1.55,
                    QRTalk.reconnectAttempts - 1
                ),

            MAX_RECONNECT_DELAY
        );

        updateOnlineState(
            false,
            "Reconectando..."
        );

        reconnectTimer =
            window.setTimeout(() => {
                reconnectTimer = null;

                connectToHost();
            }, delay);
    }

    /*
    ==================================================
    EVENTOS DO PEERJS
    ==================================================
    */

    function configurePeerEvents(
        peerInstance
    ) {
        /*
        ==================================================
        PEER PRONTO
        ==================================================
        */

        peerInstance.on(
            "open",
            (id) => {
                QRTalk.peerId = id;

                peerLog(
                    "Peer aberto:",
                    id
                );

                if (
                    QRTalk.mode === "host"
                ) {
                    QRTalk.roomId = id;

                    QRTalk.roomUrl =
                        createRoomUrl(id);

                    renderQrCode(
                        QRTalk.roomUrl
                    );

                    setSetupMessage(
                        "Aguardando a 2ª pessoa escanear..."
                    );
                } else {
                    connectToHost();
                }
            }
        );

        /*
        ==================================================
        CONEXÃO RECEBIDA
        ==================================================
        */

        peerInstance.on(
            "connection",
            (connection) => {
                /*
                Somente o criador da sala deve aceitar
                conexões recebidas.
                */

                if (
                    QRTalk.mode !== "host"
                ) {
                    connection.on(
                        "open",
                        () => {
                            connection.close();
                        }
                    );

                    return;
                }

                acceptConnection(
                    connection
                );
            }
        );

        /*
        ==================================================
        DESCONECTOU DO SERVIDOR DE SINALIZAÇÃO
        ==================================================
        */

        peerInstance.on(
            "disconnected",
            () => {
                peerWarn(
                    "Peer desconectado do servidor de sinalização."
                );

                if (
                    QRTalk.leaving ||
                    peerInstance.destroyed
                ) {
                    return;
                }

                setSetupMessage(
                    "Restabelecendo o serviço P2P..."
                );

                window.setTimeout(() => {
                    if (
                        !peerInstance.destroyed &&
                        peerInstance.disconnected
                    ) {
                        try {
                            peerInstance.reconnect();
                        } catch (error) {
                            peerWarn(
                                "Falha ao reconectar o PeerJS:",
                                error
                            );
                        }
                    }
                }, 1200);
            }
        );

        /*
        ==================================================
        PEER ENCERRADO
        ==================================================
        */

        peerInstance.on(
            "close",
            () => {
                peerWarn(
                    "Peer encerrado."
                );

                stopHeartbeat();

                QRTalk.connected = false;

                if (!QRTalk.leaving) {
                    updateOnlineState(
                        false,
                        "Serviço P2P encerrado"
                    );
                }
            }
        );

        /*
        ==================================================
        ERROS DO PEERJS
        ==================================================
        */

        peerInstance.on(
            "error",
            (error) => {
                peerWarn(
                    "Erro PeerJS:",
                    error.type,
                    error
                );

                switch (error.type) {
                    case "peer-unavailable":
                        if (
                            QRTalk.mode ===
                            "guest"
                        ) {
                            scheduleGuestReconnect();
                        }

                        break;

                    case "network":
                    case "server-error":
                    case "socket-error":
                        updateOnlineState(
                            false,
                            "Problema de conexão"
                        );

                        break;

                    case "browser-incompatible":
                        setSetupMessage(
                            "Este navegador não oferece suporte ao chat P2P."
                        );

                        break;

                    default:
                        setSetupMessage(
                            "Ocorreu um erro no serviço P2P."
                        );

                        break;
                }

                emit(
                    "qrtalk:peer-error",
                    {
                        error
                    }
                );
            }
        );
    }

    /*
    ==================================================
    EVENTOS DOS BOTÕES
    ==================================================
    */

    function bindPeerButtons() {
        if (QRTalk.peerButtonsBound) {
            return;
        }

        QRTalk.peerButtonsBound = true;

        /*
        Copiar link da sala.
        */

        QRTalk.elements.copyBtn?.addEventListener(
            "click",
            copyRoomLink
        );

        /*
        Encerrar conversa.
        */

        QRTalk.elements.restartBtn?.addEventListener(
            "click",
            () => {
                const confirmed =
                    window.confirm(
                        "Deseja encerrar esta conversa e criar uma nova sala?"
                    );

                if (confirmed) {
                    resetToHome();
                }
            }
        );

        /*
        Chamar atenção.
        */

        QRTalk.elements.nudgeBtn?.addEventListener(
            "click",
            () => {
                if (!isPeerConnected()) {
                    return;
                }

                sendPeerPacket({
                    type:
                        SYSTEM_TYPES.NUDGE,

                    sentAt:
                        Date.now()
                });

                if (
                    typeof window.addSystemMessage ===
                    "function"
                ) {
                    window.addSystemMessage(
                        "Você chamou a atenção da outra pessoa."
                    );
                }
            }
        );

        /*
        Restaurar título ao voltar para a aba.
        */

        window.addEventListener(
            "focus",
            () => {
                document.title = "QRTalk";
            }
        );

        /*
        Avisar o outro dispositivo quando a página fechar.
        */

        window.addEventListener(
            "pagehide",
            () => {
                if (
                    isPeerConnected() &&
                    !QRTalk.leaving
                ) {
                    try {
                        QRTalk.conn.send({
                            type:
                                SYSTEM_TYPES.DISCONNECT,

                            reason:
                                "A outra pessoa saiu da conversa.",

                            sentAt:
                                Date.now()
                        });
                    } catch (_) {
                        /*
                        Alguns navegadores impedem envios
                        durante o fechamento da página.
                        */
                    }
                }
            }
        );
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initPeer() {
        if (QRTalk.peerInitialized) {
            return;
        }

        QRTalk.peerInitialized = true;

        bindPeerButtons();

        updateOnlineState(
            false,
            "Aguardando conexão..."
        );

        if (
            typeof window.Peer !== "function"
        ) {
            setSetupMessage(
                "Não foi possível carregar o PeerJS."
            );

            return;
        }

        QRTalk.targetPeerId =
            getTargetPeerId();

        QRTalk.mode =
            QRTalk.targetPeerId
                ? "guest"
                : "host";

        QRTalk.roomId =
            QRTalk.targetPeerId || null;

        QRTalk.reconnectAttempts = 0;
        QRTalk.lastSeenAt = 0;
        QRTalk.lastPongAt = 0;
        QRTalk.hasConnectedBefore = false;

        if (QRTalk.mode === "guest") {
            setSetupMessage(
                "Preparando conexão com a sala..."
            );
        } else {
            setSetupMessage(
                "Conectando ao serviço P2P..."
            );
        }

        try {
            QRTalk.peer =
                new Peer(
                    undefined,
                    {
                        debug: 1
                    }
                );

            configurePeerEvents(
                QRTalk.peer
            );
        } catch (error) {
            peerWarn(
                "Falha ao criar Peer:",
                error
            );

            setSetupMessage(
                "Não foi possível iniciar o chat P2P."
            );
        }
    }

    /*
    ==================================================
    ENVIO DE PACOTES
    ==================================================
    */

    function sendPeerPacket(packet) {
        if (
            !packet ||
            typeof packet !== "object"
        ) {
            peerWarn(
                "Tentativa de enviar pacote inválido:",
                packet
            );

            return false;
        }

        if (!isPeerConnected()) {
            peerWarn(
                "Não há conexão aberta para envio."
            );

            return false;
        }

        const outgoing = {
            ...packet,

            protocol: "qrtalk/3",

            packetSentAt:
                Date.now()
        };

        try {
            QRTalk.conn.send(
                outgoing
            );

            return true;
        } catch (error) {
            peerWarn(
                "Falha ao enviar pacote:",
                error
            );

            return false;
        }
    }

    /*
    ==================================================
    CONSULTAR CONEXÃO
    ==================================================
    */

    function isPeerConnected() {
        return Boolean(
            QRTalk.connected &&
            QRTalk.conn &&
            QRTalk.conn.open
        );
    }

    /*
    ==================================================
    DESCONEXÃO REMOTA
    ==================================================
    */

    function handleRemoteDisconnect(
        reason
    ) {
        if (QRTalk.leaving) {
            return;
        }

        QRTalk.leaving = true;

        stopHeartbeat();

        clearReconnectTimer();

        updateOnlineState(
            false,
            "Conversa encerrada"
        );

        if (
            typeof window.addSystemMessage ===
            "function"
        ) {
            window.addSystemMessage(
                reason
            );
        }

        emit(
            "qrtalk:session-ended",
            {
                reason,
                remote: true
            }
        );

        window.setTimeout(() => {
            window.location.href =
                window.location.pathname;
        }, 1800);
    }

    /*
    ==================================================
    ENCERRAR CONEXÃO
    ==================================================
    */

    function disconnectPeer(
        reason =
            "A outra pessoa encerrou a conversa."
    ) {
        QRTalk.leaving = true;

        stopHeartbeat();

        clearReconnectTimer();

        if (isPeerConnected()) {
            try {
                QRTalk.conn.send({
                    type:
                        SYSTEM_TYPES.DISCONNECT,

                    reason,

                    sentAt:
                        Date.now()
                });
            } catch (error) {
                peerWarn(
                    "Falha ao avisar encerramento:",
                    error
                );
            }
        }

        try {
            QRTalk.conn?.close();
        } catch (_) {
            /*
            A conexão já pode estar encerrada.
            */
        }

        try {
            if (
                QRTalk.peer &&
                !QRTalk.peer.destroyed
            ) {
                QRTalk.peer.destroy();
            }
        } catch (_) {
            /*
            O Peer já pode estar destruído.
            */
        }

        QRTalk.connected = false;
    }

    /*
    ==================================================
    VOLTAR PARA A TELA INICIAL
    ==================================================
    */

    function resetToHome() {
        disconnectPeer();

        window.location.href =
            window.location.pathname;
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initPeer =
        initPeer;

    window.sendPeerPacket =
        sendPeerPacket;

    window.isPeerConnected =
        isPeerConnected;

    window.disconnectPeer =
        disconnectPeer;

    window.resetToHome =
        resetToHome;

    window.handleRemoteDisconnect =
        handleRemoteDisconnect;
})();