/*
==================================================
QRTalk 3.0
Indicador de digitação
==================================================
*/

"use strict";

(() => {
    /*
    ==================================================
    CONFIGURAÇÕES
    ==================================================
    */

    const TYPING_PACKET_TYPE =
        "presence:typing";

    /*
    Depois desse tempo sem digitar, o usuário
    será considerado como parado.
    */

    const LOCAL_IDLE_DELAY = 1300;

    /*
    Se o navegador remoto não enviar uma atualização
    dentro desse prazo, o indicador será escondido.

    Isso evita que "está digitando..." fique preso
    caso a conexão oscile.
    */

    const REMOTE_STALE_DELAY = 5500;

    /*
    Enquanto a pessoa continuar digitando por bastante
    tempo, enviamos uma confirmação periódica.
    */

    const TYPING_REFRESH_INTERVAL = 3500;

    let initialized = false;

    let localIdleTimer = null;
    let localRefreshTimer = null;
    let remoteTypingTimer = null;

    let lastSentState = false;
    let isComposing = false;

    /*
    ==================================================
    LOGS
    ==================================================
    */

    function typingLog(...args) {
        console.log(
            "[QRTalk/Typing]",
            ...args
        );
    }

    function typingWarn(...args) {
        console.warn(
            "[QRTalk/Typing]",
            ...args
        );
    }

    /*
    ==================================================
    ELEMENTOS
    ==================================================
    */

    function getMessageInput() {
        return (
            QRTalk?.elements?.input ||
            document.getElementById(
                "message-input"
            )
        );
    }

    function getTypingIndicator() {
        return (
            QRTalk?.elements?.typing ||
            document.getElementById(
                "typing-indicator"
            )
        );
    }

    /*
    ==================================================
    VERIFICAR CONEXÃO
    ==================================================
    */

    function canSendTypingPacket() {
        return Boolean(
            typeof window.isPeerConnected ===
                "function" &&
            window.isPeerConnected() &&
            typeof window.sendPeerPacket ===
                "function"
        );
    }

    /*
    ==================================================
    ENVIAR ESTADO DE DIGITAÇÃO
    ==================================================
    */

    function sendTypingState(
        isTyping,
        force = false
    ) {
        const state =
            Boolean(isTyping);

        /*
        Não envia novamente o mesmo estado,
        a não ser que seja uma atualização forçada.
        */

        if (
            !force &&
            lastSentState === state
        ) {
            return true;
        }

        if (!canSendTypingPacket()) {
            /*
            Guardamos como falso para que, quando a
            conexão voltar, um novo "digitando" possa
            ser enviado normalmente.
            */

            if (!state) {
                lastSentState = false;
            }

            return false;
        }

        const sent =
            window.sendPeerPacket({
                type:
                    TYPING_PACKET_TYPE,

                typing:
                    state,

                createdAt:
                    Date.now()
            });

        if (sent) {
            lastSentState = state;
        }

        return sent;
    }

    /*
    ==================================================
    LIMPAR TIMERS LOCAIS
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

    function clearLocalRefreshTimer() {
        if (!localRefreshTimer) {
            return;
        }

        window.clearInterval(
            localRefreshTimer
        );

        localRefreshTimer = null;
    }

    /*
    ==================================================
    ATUALIZAÇÃO PERIÓDICA
    ==================================================
    */

    function startTypingRefresh() {
        if (localRefreshTimer) {
            return;
        }

        localRefreshTimer =
            window.setInterval(() => {
                if (
                    !QRTalk.typing ||
                    !canSendTypingPacket()
                ) {
                    return;
                }

                sendTypingState(
                    true,
                    true
                );
            }, TYPING_REFRESH_INTERVAL);
    }

    /*
    ==================================================
    COMEÇOU A DIGITAR
    ==================================================
    */

    function startLocalTyping() {
        const input =
            getMessageInput();

        if (!input) {
            return;
        }

        /*
        Não mostramos "digitando" quando o campo
        estiver vazio.
        */

        if (
            !input.value &&
            !isComposing
        ) {
            stopLocalTyping();

            return;
        }

        clearLocalIdleTimer();

        if (!QRTalk.typing) {
            QRTalk.typing = true;

            sendTypingState(true);

            window.dispatchEvent(
                new CustomEvent(
                    "qrtalk:local-typing-start"
                )
            );
        }

        startTypingRefresh();

        /*
        Cada nova tecla reinicia o tempo de espera.
        */

        localIdleTimer =
            window.setTimeout(() => {
                stopLocalTyping();
            }, LOCAL_IDLE_DELAY);
    }

    /*
    ==================================================
    PAROU DE DIGITAR
    ==================================================
    */

    function stopLocalTyping(
        sendPacket = true
    ) {
        clearLocalIdleTimer();
        clearLocalRefreshTimer();

        const wasTyping =
            Boolean(QRTalk.typing);

        QRTalk.typing = false;

        if (
            sendPacket &&
            (
                wasTyping ||
                lastSentState
            )
        ) {
            sendTypingState(false);
        } else if (!sendPacket) {
            lastSentState = false;
        }

        if (wasTyping) {
            window.dispatchEvent(
                new CustomEvent(
                    "qrtalk:local-typing-stop"
                )
            );
        }
    }

    /*
    ==================================================
    MOSTRAR DIGITAÇÃO REMOTA
    ==================================================
    */

    function showRemoteTyping() {
        const indicator =
            getTypingIndicator();

        if (!indicator) {
            return;
        }

        QRTalk.remoteTyping = true;

        indicator.textContent =
            "A outra pessoa está digitando...";

        if (
            typeof window.showTyping ===
            "function"
        ) {
            window.showTyping();
        } else {
            indicator.classList.remove(
                "hidden"
            );
        }

        resetRemoteTypingTimer();

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:remote-typing-start"
            )
        );
    }

    /*
    ==================================================
    ESCONDER DIGITAÇÃO REMOTA
    ==================================================
    */

    function hideRemoteTyping() {
        if (remoteTypingTimer) {
            window.clearTimeout(
                remoteTypingTimer
            );

            remoteTypingTimer = null;
        }

        const wasTyping =
            Boolean(
                QRTalk.remoteTyping
            );

        QRTalk.remoteTyping = false;

        const indicator =
            getTypingIndicator();

        if (
            typeof window.hideTyping ===
            "function"
        ) {
            window.hideTyping();
        } else {
            indicator?.classList.add(
                "hidden"
            );
        }

        if (wasTyping) {
            window.dispatchEvent(
                new CustomEvent(
                    "qrtalk:remote-typing-stop"
                )
            );
        }
    }

    /*
    ==================================================
    EXPIRAÇÃO DO INDICADOR REMOTO
    ==================================================
    */

    function resetRemoteTypingTimer() {
        if (remoteTypingTimer) {
            window.clearTimeout(
                remoteTypingTimer
            );
        }

        remoteTypingTimer =
            window.setTimeout(() => {
                hideRemoteTyping();
            }, REMOTE_STALE_DELAY);
    }

    /*
    ==================================================
    PACOTES RECEBIDOS
    ==================================================
    */

    function handleTypingPacket(event) {
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
        Também aceita o formato antigo:

        {
            type: "typing",
            status: true
        }
        */

        const isTypingPacket =
            packet.type ===
                TYPING_PACKET_TYPE ||
            packet.type === "typing";

        if (!isTypingPacket) {
            return;
        }

        /*
        Informa ao peer.js que este pacote
        foi tratado por este módulo.
        */

        event.preventDefault();

        const typingState =
            packet.typing ??
            packet.status ??
            packet.isTyping ??
            false;

        if (Boolean(typingState)) {
            showRemoteTyping();
        } else {
            hideRemoteTyping();
        }
    }

    /*
    ==================================================
    EVENTO INPUT
    ==================================================
    */

    function handleInput() {
        const input =
            getMessageInput();

        if (!input) {
            return;
        }

        if (
            input.value.length > 0 ||
            isComposing
        ) {
            startLocalTyping();
        } else {
            stopLocalTyping();
        }
    }

    /*
    ==================================================
    TECLADOS COM COMPOSIÇÃO
    ==================================================

    Necessário para teclados que montam caracteres
    antes de inseri-los, incluindo alguns teclados
    de celular, idiomas asiáticos e corretores.
    */

    function handleCompositionStart() {
        isComposing = true;

        startLocalTyping();
    }

    function handleCompositionEnd() {
        isComposing = false;

        handleInput();
    }

    /*
    ==================================================
    PERDA DE FOCO
    ==================================================
    */

    function handleInputBlur() {
        stopLocalTyping();
    }

    /*
    ==================================================
    VISIBILIDADE DA PÁGINA
    ==================================================
    */

    function handleVisibilityChange() {
        if (document.hidden) {
            stopLocalTyping();
        }
    }

    /*
    ==================================================
    CONEXÃO ABERTA
    ==================================================
    */

    function handleConnectionOpened() {
        lastSentState = false;

        hideRemoteTyping();

        const input =
            getMessageInput();

        if (
            input &&
            document.activeElement ===
                input &&
            input.value.length > 0
        ) {
            /*
            Pequeno atraso para garantir que o
            DataChannel esteja realmente pronto.
            */

            window.setTimeout(() => {
                startLocalTyping();
            }, 250);
        }
    }

    /*
    ==================================================
    CONEXÃO FECHADA
    ==================================================
    */

    function handleConnectionClosed() {
        stopLocalTyping(false);

        hideRemoteTyping();

        lastSentState = false;
    }

    /*
    ==================================================
    MENSAGEM ENVIADA
    ==================================================
    */

    function handleMessageSent() {
        /*
        Depois de enviar uma mensagem, o campo é
        apagado pelo chat.js. O indicador deve parar.
        */

        stopLocalTyping();
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initTyping() {
        if (initialized) {
            return;
        }

        initialized = true;

        QRTalk.typing = false;
        QRTalk.remoteTyping = false;

        const input =
            getMessageInput();

        if (!input) {
            typingWarn(
                "Campo de mensagem não encontrado."
            );

            return;
        }

        input.addEventListener(
            "input",
            handleInput
        );

        input.addEventListener(
            "blur",
            handleInputBlur
        );

        input.addEventListener(
            "compositionstart",
            handleCompositionStart
        );

        input.addEventListener(
            "compositionend",
            handleCompositionEnd
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener(
            "qrtalk:packet",
            handleTypingPacket
        );

        window.addEventListener(
            "qrtalk:connected",
            handleConnectionOpened
        );

        window.addEventListener(
            "qrtalk:disconnected",
            handleConnectionClosed
        );

        window.addEventListener(
            "qrtalk:session-ended",
            handleConnectionClosed
        );

        window.addEventListener(
            "qrtalk:message-sent",
            handleMessageSent
        );

        /*
        Ao fechar ou recarregar a página, tenta
        remover o indicador do outro dispositivo.
        */

        window.addEventListener(
            "pagehide",
            () => {
                if (
                    QRTalk.typing &&
                    canSendTypingPacket()
                ) {
                    try {
                        QRTalk.conn.send({
                            type:
                                TYPING_PACKET_TYPE,

                            typing:
                                false,

                            createdAt:
                                Date.now()
                        });
                    } catch (_) {
                        /*
                        O navegador pode bloquear envios
                        durante o fechamento da página.
                        */
                    }
                }

                stopLocalTyping(false);
            }
        );

        typingLog(
            "Indicador de digitação iniciado."
        );
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initTyping =
        initTyping;

    window.startLocalTyping =
        startLocalTyping;

    window.stopLocalTyping =
        stopLocalTyping;

    window.showRemoteTyping =
        showRemoteTyping;

    window.hideRemoteTyping =
        hideRemoteTyping;

    /*
    O app.js não chama initTyping diretamente,
    então este arquivo se inicializa sozinho.
    */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initTyping
        );
    } else {
        initTyping();
    }
})();