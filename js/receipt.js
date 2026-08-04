/*
==================================================
QRTalk 3.0
Confirmações de envio, entrega e leitura
==================================================
*/

"use strict";

(() => {
    /*
    ==================================================
    TIPOS DE PACOTE
    ==================================================
    */

    const PACKET_TYPES = Object.freeze({
        CHAT_RECEIPT: "chat:receipt",
        SYNC_REQUEST: "receipt:sync-request",
        SYNC_RESPONSE: "receipt:sync-response"
    });

    /*
    ==================================================
    STATUS
    ==================================================
    */

    const RECEIPT_STATUS = Object.freeze({
        SENT: "sent",
        DELIVERED: "delivered",
        READ: "read",
        FAILED: "failed"
    });

    const STATUS_PRIORITY = Object.freeze({
        failed: 0,
        sent: 1,
        delivered: 2,
        read: 3
    });

    /*
    ==================================================
    CONFIGURAÇÕES
    ==================================================
    */

    /*
    Pequeno atraso para juntar várias confirmações
    em um único pacote.
    */

    const RECEIPT_FLUSH_DELAY = 250;

    /*
    Intervalo para verificar confirmações pendentes.
    */

    const RECEIPT_RETRY_INTERVAL = 7000;

    /*
    Tempo até solicitar uma sincronização depois
    que a conexão for aberta.
    */

    const CONNECTION_SYNC_DELAY = 600;

    /*
    Os registros ficam apenas na memória.

    Não são usados localStorage, banco de dados
    ou qualquer armazenamento permanente.
    */

    const RECORD_MAX_AGE = 2 * 60 * 60 * 1000;

    const CLEANUP_INTERVAL = 60000;

    const MAX_RECORDS = 1000;

    let initialized = false;

    let flushTimer = null;
    let retryTimer = null;
    let cleanupTimer = null;
    let connectionSyncTimer = null;

    /*
    Mensagens enviadas por este aparelho.
    */

    const outgoingReceipts = new Map();

    /*
    Mensagens recebidas neste aparelho.
    */

    const incomingReceipts = new Map();

    /*
    Confirmações que ainda precisam ser enviadas.
    */

    const pendingReceipts = new Map();

    /*
    ==================================================
    LOGS
    ==================================================
    */

    function receiptLog(...args) {
        console.log(
            "[QRTalk/Receipt]",
            ...args
        );
    }

    function receiptWarn(...args) {
        console.warn(
            "[QRTalk/Receipt]",
            ...args
        );
    }

    /*
    ==================================================
    ESTRUTURA GLOBAL
    ==================================================
    */

    function exposeReceiptState() {
        QRTalk.receipts = {
            outgoing: outgoingReceipts,
            incoming: incomingReceipts,
            pending: pendingReceipts
        };
    }

    /*
    ==================================================
    CONEXÃO
    ==================================================
    */

    function isConnected() {
        return Boolean(
            typeof window.isPeerConnected === "function" &&
            window.isPeerConnected() &&
            typeof window.sendPeerPacket === "function"
        );
    }

    /*
    ==================================================
    VALIDAÇÕES
    ==================================================
    */

    function normalizeMessageIds(value) {
        const values = Array.isArray(value)
            ? value
            : [value];

        return Array.from(
            new Set(
                values
                    .map((item) => String(item || "").trim())
                    .filter(Boolean)
            )
        );
    }

    function isValidStatus(status) {
        return Object.values(
            RECEIPT_STATUS
        ).includes(status);
    }

    function getStatusPriority(status) {
        return STATUS_PRIORITY[status] ?? 0;
    }

    function shouldReplaceStatus(
        currentStatus,
        newStatus
    ) {
        if (!currentStatus) {
            return true;
        }

        /*
        "failed" representa uma falha temporária.

        Uma confirmação real de entrega ou leitura
        sempre pode substituir esse estado.
        */

        if (
            currentStatus === RECEIPT_STATUS.FAILED &&
            newStatus !== RECEIPT_STATUS.FAILED
        ) {
            return true;
        }

        if (newStatus === RECEIPT_STATUS.FAILED) {
            return (
                currentStatus !== RECEIPT_STATUS.DELIVERED &&
                currentStatus !== RECEIPT_STATUS.READ
            );
        }

        return (
            getStatusPriority(newStatus) >=
            getStatusPriority(currentStatus)
        );
    }

    /*
    ==================================================
    INTERFACE
    ==================================================
    */

    function updateMessageInterface(
        messageId,
        status
    ) {
        if (
            typeof window.updateMessageStatus ===
            "function"
        ) {
            window.updateMessageStatus(
                messageId,
                status
            );
        }
    }

    /*
    ==================================================
    REGISTRAR MENSAGEM ENVIADA
    ==================================================
    */

    function registerOutgoingMessage(packet) {
        if (!packet?.id) {
            return;
        }

        const messageId =
            String(packet.id);

        const existing =
            outgoingReceipts.get(messageId);

        const now = Date.now();

        outgoingReceipts.set(
            messageId,
            {
                messageId,
                status:
                    existing?.status ||
                    RECEIPT_STATUS.SENT,

                createdAt:
                    Number(packet.createdAt) ||
                    existing?.createdAt ||
                    now,

                updatedAt: now,

                lastSyncRequestedAt:
                    existing?.lastSyncRequestedAt ||
                    0
            }
        );

        updateMessageInterface(
            messageId,
            existing?.status ||
            RECEIPT_STATUS.SENT
        );

        enforceRecordLimit(
            outgoingReceipts
        );
    }

    /*
    ==================================================
    REGISTRAR MENSAGEM RECEBIDA
    ==================================================
    */

    function registerIncomingMessage(packet) {
        if (!packet?.id) {
            return;
        }

        const messageId =
            String(packet.id);

        const now = Date.now();

        const existing =
            incomingReceipts.get(messageId);

        const currentStatus =
            existing?.status ||
            RECEIPT_STATUS.DELIVERED;

        incomingReceipts.set(
            messageId,
            {
                messageId,
                status: currentStatus,
                receivedAt:
                    existing?.receivedAt ||
                    now,

                updatedAt: now
            }
        );

        /*
        Reenvia a confirmação de entrega.

        Ela é idempotente: recebê-la mais de uma vez
        não duplica a mensagem nem causa problemas.
        */

        queueReceipt(
            RECEIPT_STATUS.DELIVERED,
            messageId
        );

        if (isConversationVisible()) {
            markIncomingAsRead(
                messageId
            );
        }

        enforceRecordLimit(
            incomingReceipts
        );
    }

    /*
    ==================================================
    APLICAR STATUS À MENSAGEM ENVIADA
    ==================================================
    */

    function applyOutgoingStatus(
        messageId,
        newStatus
    ) {
        if (
            !messageId ||
            !isValidStatus(newStatus)
        ) {
            return false;
        }

        const id =
            String(messageId);

        const now = Date.now();

        const record =
            outgoingReceipts.get(id);

        if (
            record &&
            !shouldReplaceStatus(
                record.status,
                newStatus
            )
        ) {
            return false;
        }

        outgoingReceipts.set(
            id,
            {
                messageId: id,

                status: newStatus,

                createdAt:
                    record?.createdAt ||
                    now,

                updatedAt: now,

                lastSyncRequestedAt:
                    record?.lastSyncRequestedAt ||
                    0
            }
        );

        updateMessageInterface(
            id,
            newStatus
        );

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:receipt-updated",
                {
                    detail: {
                        messageId: id,
                        status: newStatus
                    }
                }
            )
        );

        return true;
    }

    /*
    ==================================================
    REGISTRAR STATUS DA MENSAGEM RECEBIDA
    ==================================================
    */

    function applyIncomingStatus(
        messageId,
        newStatus
    ) {
        if (
            !messageId ||
            !isValidStatus(newStatus)
        ) {
            return false;
        }

        const id =
            String(messageId);

        const now = Date.now();

        const record =
            incomingReceipts.get(id);

        if (
            record &&
            !shouldReplaceStatus(
                record.status,
                newStatus
            )
        ) {
            return false;
        }

        incomingReceipts.set(
            id,
            {
                messageId: id,

                status: newStatus,

                receivedAt:
                    record?.receivedAt ||
                    now,

                updatedAt: now
            }
        );

        return true;
    }

    /*
    ==================================================
    FILA DE CONFIRMAÇÕES
    ==================================================
    */

    function createPendingKey(
        messageId,
        status
    ) {
        return `${messageId}:${status}`;
    }

    function removeInferiorPendingReceipts(
        messageId,
        status
    ) {
        if (status === RECEIPT_STATUS.READ) {
            pendingReceipts.delete(
                createPendingKey(
                    messageId,
                    RECEIPT_STATUS.DELIVERED
                )
            );
        }
    }

    function queueReceipt(
        status,
        messageIds
    ) {
        if (!isValidStatus(status)) {
            return false;
        }

        const ids =
            normalizeMessageIds(
                messageIds
            );

        if (!ids.length) {
            return false;
        }

        const now = Date.now();

        ids.forEach((messageId) => {
            removeInferiorPendingReceipts(
                messageId,
                status
            );

            const key =
                createPendingKey(
                    messageId,
                    status
                );

            pendingReceipts.set(
                key,
                {
                    messageId,
                    status,
                    queuedAt:
                        pendingReceipts.get(key)
                            ?.queuedAt ||
                        now,

                    updatedAt: now,

                    attempts:
                        pendingReceipts.get(key)
                            ?.attempts ||
                        0
                }
            );
        });

        scheduleReceiptFlush();

        return true;
    }

    /*
    ==================================================
    PROGRAMAR ENVIO DA FILA
    ==================================================
    */

    function scheduleReceiptFlush() {
        if (flushTimer) {
            return;
        }

        flushTimer =
            window.setTimeout(() => {
                flushTimer = null;

                flushPendingReceipts();
            }, RECEIPT_FLUSH_DELAY);
    }

    /*
    ==================================================
    ENVIAR CONFIRMAÇÕES PENDENTES
    ==================================================
    */

    function flushPendingReceipts() {
        if (
            !pendingReceipts.size ||
            !isConnected()
        ) {
            return false;
        }

        const grouped = {
            delivered: [],
            read: [],
            sent: [],
            failed: []
        };

        pendingReceipts.forEach(
            (record) => {
                if (
                    grouped[record.status]
                ) {
                    grouped[
                        record.status
                    ].push(
                        record.messageId
                    );
                }
            }
        );

        let sentSomething = false;

        Object.entries(grouped).forEach(
            ([status, messageIds]) => {
                if (!messageIds.length) {
                    return;
                }

                const uniqueIds =
                    normalizeMessageIds(
                        messageIds
                    );

                const sent =
                    window.sendPeerPacket({
                        type:
                            PACKET_TYPES.CHAT_RECEIPT,

                        receipt: status,

                        messageIds:
                            uniqueIds,

                        createdAt:
                            Date.now(),

                        reliable:
                            true
                    });

                if (!sent) {
                    uniqueIds.forEach(
                        (messageId) => {
                            const key =
                                createPendingKey(
                                    messageId,
                                    status
                                );

                            const record =
                                pendingReceipts.get(
                                    key
                                );

                            if (record) {
                                record.attempts += 1;
                                record.updatedAt =
                                    Date.now();
                            }
                        }
                    );

                    return;
                }

                sentSomething = true;

                uniqueIds.forEach(
                    (messageId) => {
                        pendingReceipts.delete(
                            createPendingKey(
                                messageId,
                                status
                            )
                        );
                    }
                );
            }
        );

        return sentSomething;
    }

    /*
    ==================================================
    MARCAR MENSAGEM COMO LIDA
    ==================================================
    */

    function markIncomingAsRead(
        messageIds
    ) {
        const ids =
            normalizeMessageIds(
                messageIds
            );

        if (!ids.length) {
            return false;
        }

        ids.forEach((messageId) => {
            applyIncomingStatus(
                messageId,
                RECEIPT_STATUS.READ
            );
        });

        queueReceipt(
            RECEIPT_STATUS.READ,
            ids
        );

        return true;
    }

    function markVisibleMessagesAsRead() {
        if (!isConversationVisible()) {
            return;
        }

        const unreadIds = [];

        incomingReceipts.forEach(
            (record) => {
                if (
                    record.status !==
                    RECEIPT_STATUS.READ
                ) {
                    unreadIds.push(
                        record.messageId
                    );
                }
            }
        );

        if (unreadIds.length) {
            markIncomingAsRead(
                unreadIds
            );
        }
    }

    /*
    ==================================================
    CONVERSA VISÍVEL
    ==================================================
    */

    function isConversationVisible() {
        if (document.hidden) {
            return false;
        }

        const chatScreen =
            QRTalk?.elements
                ?.chatScreen ||
            document.getElementById(
                "chat-screen"
            );

        if (!chatScreen) {
            return false;
        }

        return !chatScreen.classList.contains(
            "hidden"
        );
    }

    /*
    ==================================================
    RECEBER CONFIRMAÇÕES
    ==================================================
    */

    function handleReceiptData(packet) {
        if (
            !packet ||
            !isValidStatus(
                packet.receipt
            )
        ) {
            return;
        }

        const ids =
            normalizeMessageIds(
                packet.messageIds ||
                packet.messageId
            );

        ids.forEach((messageId) => {
            applyOutgoingStatus(
                messageId,
                packet.receipt
            );
        });
    }

    /*
    ==================================================
    SINCRONIZAÇÃO APÓS RECONEXÃO
    ==================================================
    */

    function requestReceiptSync() {
        if (!isConnected()) {
            return false;
        }

        const messageIds = [];

        const now = Date.now();

        outgoingReceipts.forEach(
            (record) => {
                /*
                Mensagens já lidas não precisam ser
                consultadas novamente.
                */

                if (
                    record.status ===
                    RECEIPT_STATUS.READ
                ) {
                    return;
                }

                messageIds.push(
                    record.messageId
                );

                record.lastSyncRequestedAt =
                    now;
            }
        );

        if (!messageIds.length) {
            return false;
        }

        /*
        Evita criar pacotes exageradamente grandes.
        */

        const limitedIds =
            messageIds.slice(0, 250);

        return window.sendPeerPacket({
            type:
                PACKET_TYPES.SYNC_REQUEST,

            messageIds:
                limitedIds,

            requestedAt:
                now
        });
    }

    function respondToSyncRequest(
        packet
    ) {
        if (!isConnected()) {
            return false;
        }

        const requestedIds =
            normalizeMessageIds(
                packet.messageIds
            );

        if (!requestedIds.length) {
            return false;
        }

        const receipts = [];

        requestedIds.forEach(
            (messageId) => {
                const record =
                    incomingReceipts.get(
                        messageId
                    );

                if (!record) {
                    return;
                }

                receipts.push({
                    messageId,
                    status:
                        record.status
                });
            }
        );

        if (!receipts.length) {
            return false;
        }

        return window.sendPeerPacket({
            type:
                PACKET_TYPES.SYNC_RESPONSE,

            receipts,

            createdAt:
                Date.now()
        });
    }

    function applySyncResponse(packet) {
        const receipts =
            Array.isArray(
                packet.receipts
            )
                ? packet.receipts
                : [];

        receipts.forEach(
            (receipt) => {
                if (
                    !receipt ||
                    !receipt.messageId ||
                    !isValidStatus(
                        receipt.status
                    )
                ) {
                    return;
                }

                applyOutgoingStatus(
                    receipt.messageId,
                    receipt.status
                );
            }
        );
    }

    /*
    ==================================================
    PACOTES RECEBIDOS PELO PEER.JS
    ==================================================
    */

    function handlePeerPacket(event) {
        const packet =
            event.detail;

        if (
            !packet ||
            typeof packet.type !==
            "string"
        ) {
            return;
        }

        switch (packet.type) {
            case PACKET_TYPES.CHAT_RECEIPT:
                /*
                O chat.js também processa esse pacote.

                Não usamos preventDefault aqui para
                permitir que os dois módulos atualizem
                seus próprios controles.
                */

                handleReceiptData(
                    packet
                );

                break;

            case PACKET_TYPES.SYNC_REQUEST:
                event.preventDefault();

                respondToSyncRequest(
                    packet
                );

                break;

            case PACKET_TYPES.SYNC_RESPONSE:
                event.preventDefault();

                applySyncResponse(
                    packet
                );

                break;

            default:
                break;
        }
    }

    /*
    ==================================================
    EVENTOS DO CHAT
    ==================================================
    */

    function handleMessageSent(event) {
        const packet =
            event.detail?.packet;

        registerOutgoingMessage(
            packet
        );
    }

    function handleMessageReceived(event) {
        const packet =
            event.detail?.packet;

        registerIncomingMessage(
            packet
        );
    }

    function handleChatReceipt(event) {
        handleReceiptData(
            event.detail
        );
    }

    /*
    ==================================================
    CONEXÃO ABERTA
    ==================================================
    */

    function handleConnected() {
        startRetryTimer();

        scheduleReceiptFlush();

        if (connectionSyncTimer) {
            window.clearTimeout(
                connectionSyncTimer
            );
        }

        connectionSyncTimer =
            window.setTimeout(() => {
                connectionSyncTimer = null;

                flushPendingReceipts();

                requestReceiptSync();

                markVisibleMessagesAsRead();
            }, CONNECTION_SYNC_DELAY);
    }

    /*
    ==================================================
    CONEXÃO FECHADA
    ==================================================
    */

    function handleDisconnected() {
        stopRetryTimer();

        if (connectionSyncTimer) {
            window.clearTimeout(
                connectionSyncTimer
            );

            connectionSyncTimer = null;
        }
    }

    /*
    ==================================================
    TIMER DE RETENTATIVA
    ==================================================
    */

    function startRetryTimer() {
        stopRetryTimer();

        retryTimer =
            window.setInterval(() => {
                if (!isConnected()) {
                    return;
                }

                flushPendingReceipts();

                requestReceiptSync();
            }, RECEIPT_RETRY_INTERVAL);
    }

    function stopRetryTimer() {
        if (!retryTimer) {
            return;
        }

        window.clearInterval(
            retryTimer
        );

        retryTimer = null;
    }

    /*
    ==================================================
    LIMPEZA DE MEMÓRIA
    ==================================================
    */

    function cleanupOldRecords() {
        const cutoff =
            Date.now() -
            RECORD_MAX_AGE;

        cleanupMap(
            outgoingReceipts,
            cutoff
        );

        cleanupMap(
            incomingReceipts,
            cutoff
        );

        cleanupMap(
            pendingReceipts,
            cutoff
        );
    }

    function cleanupMap(
        map,
        cutoff
    ) {
        map.forEach(
            (record, key) => {
                const timestamp =
                    Number(
                        record.updatedAt ||
                        record.createdAt ||
                        record.receivedAt ||
                        record.queuedAt
                    );

                if (
                    Number.isFinite(
                        timestamp
                    ) &&
                    timestamp < cutoff
                ) {
                    map.delete(key);
                }
            }
        );
    }

    function enforceRecordLimit(map) {
        if (map.size <= MAX_RECORDS) {
            return;
        }

        const records =
            Array.from(
                map.entries()
            ).sort(
                (
                    [, first],
                    [, second]
                ) => {
                    const firstTime =
                        Number(
                            first.updatedAt ||
                            first.createdAt ||
                            0
                        );

                    const secondTime =
                        Number(
                            second.updatedAt ||
                            second.createdAt ||
                            0
                        );

                    return (
                        firstTime -
                        secondTime
                    );
                }
            );

        const amountToRemove =
            map.size -
            MAX_RECORDS;

        records
            .slice(
                0,
                amountToRemove
            )
            .forEach(
                ([key]) => {
                    map.delete(key);
                }
            );
    }

    function startCleanupTimer() {
        stopCleanupTimer();

        cleanupTimer =
            window.setInterval(
                cleanupOldRecords,
                CLEANUP_INTERVAL
            );
    }

    function stopCleanupTimer() {
        if (!cleanupTimer) {
            return;
        }

        window.clearInterval(
            cleanupTimer
        );

        cleanupTimer = null;
    }

    /*
    ==================================================
    VISIBILIDADE
    ==================================================
    */

    function handleVisibilityChange() {
        if (isConversationVisible()) {
            markVisibleMessagesAsRead();

            flushPendingReceipts();
        }
    }

    /*
    ==================================================
    ENCERRAMENTO DA PÁGINA
    ==================================================
    */

    function handlePageHide() {
        if (flushTimer) {
            window.clearTimeout(
                flushTimer
            );

            flushTimer = null;
        }

        stopRetryTimer();
        stopCleanupTimer();

        /*
        Tenta enviar as confirmações restantes.

        O navegador ainda pode cancelar esse envio
        durante o fechamento da página.
        */

        if (isConnected()) {
            try {
                flushPendingReceipts();
            } catch (_) {
                // O fechamento da página pode interromper o envio.
            }
        }
    }

    /*
    ==================================================
    CONSULTAR ESTADO
    ==================================================
    */

    function getMessageReceiptState(
        messageId
    ) {
        const id =
            String(messageId || "");

        return {
            outgoing:
                outgoingReceipts.get(id)
                    ? {
                        ...outgoingReceipts.get(
                            id
                        )
                    }
                    : null,

            incoming:
                incomingReceipts.get(id)
                    ? {
                        ...incomingReceipts.get(
                            id
                        )
                    }
                    : null
        };
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initReceipt() {
        if (initialized) {
            return;
        }

        initialized = true;

        exposeReceiptState();

        window.addEventListener(
            "qrtalk:packet",
            handlePeerPacket
        );

        window.addEventListener(
            "qrtalk:message-sent",
            handleMessageSent
        );

        window.addEventListener(
            "qrtalk:message-received",
            handleMessageReceived
        );

        window.addEventListener(
            "qrtalk:receipt",
            handleChatReceipt
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

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener(
            "focus",
            handleVisibilityChange
        );

        window.addEventListener(
            "pagehide",
            handlePageHide
        );

        startCleanupTimer();

        receiptLog(
            "Confirmações de entrega e leitura iniciadas."
        );
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initReceipt =
        initReceipt;

    window.initReceipts =
        initReceipt;

    window.queueReliableReceipt =
        queueReceipt;

    window.flushReliableReceipts =
        flushPendingReceipts;

    window.markIncomingMessageAsRead =
        markIncomingAsRead;

    window.markVisibleMessagesAsRead =
        markVisibleMessagesAsRead;

    window.requestReceiptSync =
        requestReceiptSync;

    window.getMessageReceiptState =
        getMessageReceiptState;

    /*
    Inicialização automática.
    */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initReceipt
        );
    } else {
        initReceipt();
    }
})();