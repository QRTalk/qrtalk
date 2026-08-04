/*
==================================================
QRTalk 3.0
Mensagens, confirmações, reações e conteúdo do chat
==================================================
*/

"use strict";

(() => {
    const MESSAGE_TYPES = Object.freeze({
        TEXT: "text",
        IMAGE: "image",
        AUDIO: "audio",
        VIDEO: "video",
        FILE: "file",
        LOCATION: "location"
    });

    const PACKET_TYPES = Object.freeze({
        MESSAGE: "chat:message",
        RECEIPT: "chat:receipt",
        EDIT: "chat:edit",
        DELETE: "chat:delete",
        REACTION: "chat:reaction"
    });

    const RECEIPT_TYPES = Object.freeze({
        SENT: "sent",
        DELIVERED: "delivered",
        READ: "read",
        FAILED: "failed"
    });

    const RECEIPT_PRIORITY = Object.freeze({
        sending: 0,
        sent: 1,
        delivered: 2,
        read: 3,
        failed: 4
    });

    const objectUrls = new Set();
    const pendingReadReceipts = new Set();

    let initialized = false;

    /*
    ==================================================
    UTILITÁRIOS
    ==================================================
    */

    function chatLog(...args) {
        console.log("[QRTalk/Chat]", ...args);
    }

    function chatWarn(...args) {
        console.warn("[QRTalk/Chat]", ...args);
    }

    function createMessageId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }

        const random = Math.random()
            .toString(36)
            .slice(2, 12);

        return [
            "msg",
            Date.now(),
            random
        ].join("-");
    }

    function getCurrentTime(timestamp = Date.now()) {
        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "--:--";
        }

        return date.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatBytes(bytes) {
        const value = Number(bytes);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return "Tamanho desconhecido";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        const unitIndex = Math.min(
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            ),
            units.length - 1
        );

        const formatted = value /
            Math.pow(1024, unitIndex);

        const decimalPlaces =
            formatted >= 10 ||
            unitIndex === 0
                ? 0
                : 1;

        return `${formatted.toFixed(decimalPlaces)} ${units[unitIndex]}`;
    }

    function getMessagesContainer() {
        return (
            QRTalk?.elements?.messages ||
            document.getElementById("chat-messages")
        );
    }

    function ensureMessageStore() {
        if (!(QRTalk.messageStore instanceof Map)) {
            QRTalk.messageStore = new Map();
        }

        return QRTalk.messageStore;
    }

    function scrollMessagesToBottom() {
        const container =
            getMessagesContainer();

        if (!container) {
            return;
        }

        window.requestAnimationFrame(() => {
            container.scrollTop =
                container.scrollHeight;
        });
    }

    function escapeFileName(name) {
        const value = String(
            name || "arquivo"
        ).trim();

        return value || "arquivo";
    }

    /*
    ==================================================
    URLS TEMPORÁRIAS PARA MÍDIA
    ==================================================
    */

    function registerObjectUrl(blob) {
        const url =
            URL.createObjectURL(blob);

        objectUrls.add(url);

        return url;
    }

    function resolveMediaUrl(
        content,
        fallbackMime = "application/octet-stream"
    ) {
        if (!content) {
            return "";
        }

        if (typeof content === "string") {
            return content;
        }

        if (content instanceof Blob) {
            return registerObjectUrl(content);
        }

        if (content instanceof ArrayBuffer) {
            return registerObjectUrl(
                new Blob(
                    [content],
                    {
                        type: fallbackMime
                    }
                )
            );
        }

        if (ArrayBuffer.isView(content)) {
            return registerObjectUrl(
                new Blob(
                    [content.buffer],
                    {
                        type: fallbackMime
                    }
                )
            );
        }

        if (
            typeof content === "object" &&
            content !== null
        ) {
            if (typeof content.url === "string") {
                return content.url;
            }

            if (
                typeof content.dataUrl === "string"
            ) {
                return content.dataUrl;
            }

            if (
                typeof content.data === "string"
            ) {
                return content.data;
            }

            if (content.data instanceof Blob) {
                return registerObjectUrl(
                    content.data
                );
            }

            if (
                content.data instanceof
                ArrayBuffer
            ) {
                return registerObjectUrl(
                    new Blob(
                        [content.data],
                        {
                            type:
                                content.mime ||
                                fallbackMime
                        }
                    )
                );
            }

            if (
                ArrayBuffer.isView(
                    content.data
                )
            ) {
                return registerObjectUrl(
                    new Blob(
                        [content.data.buffer],
                        {
                            type:
                                content.mime ||
                                fallbackMime
                        }
                    )
                );
            }
        }

        return "";
    }

    function revokeObjectUrls() {
        objectUrls.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch (_) {
                // A URL já pode ter sido liberada.
            }
        });

        objectUrls.clear();
    }

    /*
    ==================================================
    STATUS DA MENSAGEM
    ==================================================
    */

    function getStatusSymbol(status) {
        switch (status) {
            case RECEIPT_TYPES.DELIVERED:
            case RECEIPT_TYPES.READ:
                return "✓✓";

            case RECEIPT_TYPES.FAILED:
                return "!";

            case "sending":
                return "○";

            case RECEIPT_TYPES.SENT:
            default:
                return "✓";
        }
    }

    function applyStatusClass(
        element,
        status
    ) {
        if (!element) {
            return;
        }

        element.classList.remove(
            "status-sent",
            "status-delivered",
            "status-read",
            "status-failed"
        );

        switch (status) {
            case RECEIPT_TYPES.READ:
                element.classList.add(
                    "status-read"
                );
                break;

            case RECEIPT_TYPES.DELIVERED:
                element.classList.add(
                    "status-delivered"
                );
                break;

            case RECEIPT_TYPES.FAILED:
                element.classList.add(
                    "status-failed"
                );
                break;

            default:
                element.classList.add(
                    "status-sent"
                );
                break;
        }
    }

    function updateMessageStatus(
        messageId,
        newStatus
    ) {
        const store =
            ensureMessageStore();

        const record =
            store.get(messageId);

        if (!record || record.side !== "sent") {
            return false;
        }

        const currentPriority =
            RECEIPT_PRIORITY[
                record.status
            ] ?? 0;

        const newPriority =
            RECEIPT_PRIORITY[
                newStatus
            ] ?? 0;

        /*
        Evita que uma mensagem lida volte a aparecer
        como apenas entregue.
        */

        if (
            newStatus !==
                RECEIPT_TYPES.FAILED &&
            newPriority < currentPriority
        ) {
            return false;
        }

        record.status = newStatus;

        if (record.statusElement) {
            record.statusElement.textContent =
                getStatusSymbol(
                    newStatus
                );

            applyStatusClass(
                record.statusElement,
                newStatus
            );

            record.statusElement.title =
                getStatusDescription(
                    newStatus
                );
        }

        return true;
    }

    function getStatusDescription(status) {
        switch (status) {
            case RECEIPT_TYPES.READ:
                return "Lida";

            case RECEIPT_TYPES.DELIVERED:
                return "Entregue";

            case RECEIPT_TYPES.FAILED:
                return "Falha no envio";

            case "sending":
                return "Enviando";

            default:
                return "Enviada";
        }
    }

    /*
    ==================================================
    VISUALIZADOR DE IMAGENS
    ==================================================
    */

    function openImageViewer(source) {
        const viewer =
            document.getElementById(
                "image-viewer"
            );

        const viewerImage =
            document.getElementById(
                "viewer-image"
            );

        if (
            !viewer ||
            !viewerImage ||
            !source
        ) {
            return;
        }

        viewerImage.src = source;

        viewer.classList.remove("hidden");
    }

    function closeImageViewer() {
        const viewer =
            document.getElementById(
                "image-viewer"
            );

        const viewerImage =
            document.getElementById(
                "viewer-image"
            );

        if (viewer) {
            viewer.classList.add("hidden");
        }

        if (viewerImage) {
            viewerImage.removeAttribute(
                "src"
            );
        }
    }

    /*
    ==================================================
    CONTEÚDO DA MENSAGEM
    ==================================================
    */

    function createTextContent(packet) {
        const element =
            document.createElement("div");

        element.className =
            "message-text";

        element.textContent =
            String(packet.content ?? "");

        return element;
    }

    function createImageContent(packet) {
        const image =
            document.createElement("img");

        image.className =
            "message-image";

        image.alt =
            packet.fileName ||
            "Imagem enviada";

        image.loading = "lazy";

        const source = resolveMediaUrl(
            packet.content,
            packet.mime || "image/jpeg"
        );

        if (source) {
            image.src = source;
        }

        image.addEventListener(
            "click",
            () => {
                openImageViewer(
                    image.src
                );
            }
        );

        return image;
    }

    function createAudioContent(packet) {
        const audio =
            document.createElement("audio");

        audio.className =
            "message-audio";

        audio.controls = true;
        audio.preload = "metadata";

        const source = resolveMediaUrl(
            packet.content,
            packet.mime || "audio/webm"
        );

        if (source) {
            audio.src = source;
        }

        return audio;
    }

    function createVideoContent(packet) {
        const video =
            document.createElement("video");

        video.className =
            "message-video";

        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;

        video.style.maxWidth = "100%";
        video.style.maxHeight = "360px";
        video.style.borderRadius = "14px";

        const source = resolveMediaUrl(
            packet.content,
            packet.mime || "video/mp4"
        );

        if (source) {
            video.src = source;
        }

        return video;
    }

    function createFileContent(packet) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "message-file";

        const icon =
            document.createElement("div");

        icon.className = "file-icon";
        icon.textContent = "📄";

        const info =
            document.createElement("div");

        info.className = "file-info";

        const name =
            document.createElement("div");

        name.className = "file-name";

        const fileName =
            escapeFileName(
                packet.fileName ||
                packet.content?.name
            );

        name.textContent = fileName;

        const size =
            document.createElement("div");

        size.className = "file-size";

        size.textContent = formatBytes(
            packet.fileSize ||
            packet.content?.size
        );

        info.appendChild(name);
        info.appendChild(size);

        const download =
            document.createElement("a");

        download.textContent = "Baixar";
        download.title =
            `Baixar ${fileName}`;

        download.download = fileName;

        download.style.color = "inherit";
        download.style.fontWeight = "600";
        download.style.textDecoration =
            "none";

        const source = resolveMediaUrl(
            packet.content?.data ??
                packet.content,
            packet.mime ||
                packet.content?.mime ||
                "application/octet-stream"
        );

        if (source) {
            download.href = source;
        } else {
            download.href = "#";

            download.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                }
            );
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(info);
        wrapper.appendChild(download);

        return wrapper;
    }

    function createLocationContent(packet) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "message-location";

        const latitude =
            Number(
                packet.content?.latitude
            );

        const longitude =
            Number(
                packet.content?.longitude
            );

        const label =
            document.createElement("div");

        label.textContent =
            "📍 Localização compartilhada";

        wrapper.appendChild(label);

        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            const link =
                document.createElement("a");

            link.href =
                `https://www.google.com/maps?q=${latitude},${longitude}`;

            link.target = "_blank";

            link.rel =
                "noopener noreferrer";

            link.textContent =
                "Abrir no mapa";

            link.style.display = "block";
            link.style.marginTop = "6px";
            link.style.color = "inherit";

            wrapper.appendChild(link);
        }

        return wrapper;
    }

    function createMessageContent(packet) {
        switch (packet.messageType) {
            case MESSAGE_TYPES.IMAGE:
                return createImageContent(
                    packet
                );

            case MESSAGE_TYPES.AUDIO:
                return createAudioContent(
                    packet
                );

            case MESSAGE_TYPES.VIDEO:
                return createVideoContent(
                    packet
                );

            case MESSAGE_TYPES.FILE:
                return createFileContent(
                    packet
                );

            case MESSAGE_TYPES.LOCATION:
                return createLocationContent(
                    packet
                );

            case MESSAGE_TYPES.TEXT:
            default:
                return createTextContent(
                    packet
                );
        }
    }

    /*
    ==================================================
    RESPOSTA A OUTRA MENSAGEM
    ==================================================
    */

    function createReplyBox(replyTo) {
        if (!replyTo) {
            return null;
        }

        const reply =
            document.createElement("div");

        reply.className = "reply-box";

        const label =
            document.createElement("strong");

        label.textContent =
            replyTo.side === "sent"
                ? "Você"
                : "Anônimo";

        const preview =
            document.createElement("div");

        const previewText =
            String(
                replyTo.preview ||
                replyTo.content ||
                "Mensagem"
            );

        preview.textContent =
            previewText.length > 90
                ? `${previewText.slice(0, 90)}…`
                : previewText;

        reply.appendChild(label);
        reply.appendChild(preview);

        return reply;
    }

    /*
    ==================================================
    REAÇÕES
    ==================================================
    */

    function getReactionsContainer(
        messageElement
    ) {
        let reactions =
            messageElement.querySelector(
                ".reactions"
            );

        if (!reactions) {
            reactions =
                document.createElement("div");

            reactions.className =
                "reactions";

            messageElement.appendChild(
                reactions
            );
        }

        return reactions;
    }

    function renderReaction(
        messageId,
        emoji
    ) {
        const store =
            ensureMessageStore();

        const record =
            store.get(messageId);

        if (!record || !emoji) {
            return false;
        }

        const reactions =
            getReactionsContainer(
                record.element
            );

        let reaction =
            reactions.querySelector(
                `[data-emoji="${CSS.escape(
                    emoji
                )}"]`
            );

        if (!reaction) {
            reaction =
                document.createElement(
                    "span"
                );

            reaction.className =
                "reaction";

            reaction.dataset.emoji =
                emoji;

            reaction.textContent =
                emoji;

            reactions.appendChild(
                reaction
            );
        }

        return true;
    }

    /*
    ==================================================
    RENDERIZAR MENSAGEM
    ==================================================
    */

    function renderChatMessage(
        packet,
        side,
        initialStatus = RECEIPT_TYPES.SENT
    ) {
        const container =
            getMessagesContainer();

        if (!container || !packet) {
            return null;
        }

        const store =
            ensureMessageStore();

        if (store.has(packet.id)) {
            return store.get(
                packet.id
            ).element;
        }

        const message =
            document.createElement("article");

        message.className =
            `message ${side}`;

        message.dataset.messageId =
            packet.id;

        message.dataset.messageType =
            packet.messageType ||
            MESSAGE_TYPES.TEXT;

        const bubble =
            document.createElement("div");

        bubble.className = "bubble";

        const replyBox =
            createReplyBox(
                packet.replyTo
            );

        if (replyBox) {
            bubble.appendChild(replyBox);
        }

        const contentElement =
            createMessageContent(packet);

        bubble.appendChild(
            contentElement
        );

        const footer =
            document.createElement("div");

        footer.className =
            "message-footer";

        if (packet.editedAt) {
            const edited =
                document.createElement(
                    "span"
                );

            edited.className =
                "message-edited";

            edited.textContent =
                "editada";

            footer.appendChild(edited);
        }

        const time =
            document.createElement("span");

        time.className =
            "message-time";

        time.textContent =
            getCurrentTime(
                packet.createdAt
            );

        footer.appendChild(time);

        let statusElement = null;

        if (side === "sent") {
            statusElement =
                document.createElement(
                    "span"
                );

            statusElement.className =
                "message-status";

            statusElement.textContent =
                getStatusSymbol(
                    initialStatus
                );

            statusElement.title =
                getStatusDescription(
                    initialStatus
                );

            applyStatusClass(
                statusElement,
                initialStatus
            );

            footer.appendChild(
                statusElement
            );
        }

        bubble.appendChild(footer);
        message.appendChild(bubble);

        container.appendChild(message);

        const record = {
            packet,
            side,
            status: initialStatus,
            element: message,
            bubble,
            contentElement,
            statusElement
        };

        store.set(
            packet.id,
            record
        );

        if (
            Number(packet.expiresAt) >
            Date.now()
        ) {
            scheduleMessageExpiration(
                packet.id,
                Number(
                    packet.expiresAt
                )
            );
        }

        scrollMessagesToBottom();

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:message-rendered",
                {
                    detail: {
                        packet,
                        side,
                        element: message
                    }
                }
            )
        );

        return message;
    }

    /*
    ==================================================
    MENSAGEM DO SISTEMA
    ==================================================
    */

    function addSystemMessage(text) {
        const container =
            getMessagesContainer();

        if (!container) {
            return null;
        }

        const element =
            document.createElement("div");

        element.className =
            "system-message";

        element.textContent =
            String(text ?? "");

        container.appendChild(
            element
        );

        scrollMessagesToBottom();

        return element;
    }

    /*
    ==================================================
    ADICIONAR TEXTO SEM ENVIAR
    ==================================================
    */

    function addTextMessage(
        text,
        side = "received",
        options = {}
    ) {
        const packet = {
            type:
                PACKET_TYPES.MESSAGE,

            id:
                options.id ||
                createMessageId(),

            messageType:
                MESSAGE_TYPES.TEXT,

            content:
                String(text ?? ""),

            createdAt:
                options.createdAt ||
                Date.now(),

            replyTo:
                options.replyTo ||
                null,

            expiresAt:
                options.expiresAt ||
                null
        };

        return renderChatMessage(
            packet,
            side,
            options.status ||
                RECEIPT_TYPES.SENT
        );
    }

    /*
    ==================================================
    ENVIAR MENSAGEM
    ==================================================
    */

    function sendChatPayload(
        messageType,
        content,
        options = {}
    ) {
        if (
            typeof window.isPeerConnected !==
                "function" ||
            !window.isPeerConnected()
        ) {
            addSystemMessage(
                "Não foi possível enviar: a outra pessoa está offline."
            );

            return null;
        }

        const packet = {
            type:
                PACKET_TYPES.MESSAGE,

            id:
                options.id ||
                createMessageId(),

            messageType:
                messageType ||
                MESSAGE_TYPES.TEXT,

            content,

            createdAt:
                Date.now(),

            replyTo:
                options.replyTo ||
                QRTalk.replyingTo ||
                null,

            expiresAt:
                options.expiresAt ||
                null,

            fileName:
                options.fileName ||
                null,

            fileSize:
                options.fileSize ||
                null,

            mime:
                options.mime ||
                null,

            metadata:
                options.metadata ||
                null
        };

        const sent =
            window.sendPeerPacket(
                packet
            );

        if (!sent) {
            addSystemMessage(
                "A mensagem não pôde ser enviada."
            );

            return null;
        }

        renderChatMessage(
            packet,
            "sent",
            RECEIPT_TYPES.SENT
        );

        clearReplyTarget();

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:message-sent",
                {
                    detail: {
                        packet
                    }
                }
            )
        );

        return packet;
    }

    function sendCurrentMessage() {
        const input =
            QRTalk?.elements?.input ||
            document.getElementById(
                "message-input"
            );

        if (!input) {
            return;
        }

        const text =
            input.value.trim();

        if (!text) {
            return;
        }

        const packet =
            sendChatPayload(
                MESSAGE_TYPES.TEXT,
                text
            );

        if (!packet) {
            input.focus();
            return;
        }

        input.value = "";

        input.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true
                }
            )
        );

        const emojiPanel =
            document.getElementById(
                "emoji-panel"
            );

        emojiPanel?.classList.add(
            "hidden"
        );

        input.focus();
    }

    /*
    ==================================================
    CONFIRMAÇÕES DE ENTREGA E LEITURA
    ==================================================
    */

    function sendReceipt(
        receiptType,
        messageIds
    ) {
        const ids = Array.from(
            new Set(
                (
                    Array.isArray(messageIds)
                        ? messageIds
                        : [messageIds]
                ).filter(Boolean)
            )
        );

        if (!ids.length) {
            return false;
        }

        return window.sendPeerPacket({
            type:
                PACKET_TYPES.RECEIPT,

            receipt:
                receiptType,

            messageIds:
                ids,

            createdAt:
                Date.now()
        });
    }

    function queueReadReceipt(
        messageId
    ) {
        if (!messageId) {
            return;
        }

        pendingReadReceipts.add(
            messageId
        );

        if (!document.hidden) {
            flushPendingReadReceipts();
        }
    }

    function flushPendingReadReceipts() {
        if (
            document.hidden ||
            !pendingReadReceipts.size ||
            typeof window.isPeerConnected !==
                "function" ||
            !window.isPeerConnected()
        ) {
            return;
        }

        const ids = Array.from(
            pendingReadReceipts
        );

        const sent =
            sendReceipt(
                RECEIPT_TYPES.READ,
                ids
            );

        if (sent) {
            pendingReadReceipts.clear();

            QRTalk.unread = 0;

            document.title =
                "QRTalk";
        }
    }

    function handleReceiptPacket(packet) {
        const ids =
            Array.isArray(
                packet.messageIds
            )
                ? packet.messageIds
                : [packet.messageId];

        ids
            .filter(Boolean)
            .forEach((messageId) => {
                updateMessageStatus(
                    messageId,
                    packet.receipt
                );
            });

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:receipt",
                {
                    detail: packet
                }
            )
        );
    }

    /*
    ==================================================
    RECEBER MENSAGEM
    ==================================================
    */

    function registerUnreadMessage(
        packet
    ) {
        if (!document.hidden) {
            return;
        }

        QRTalk.unread =
            Number(QRTalk.unread || 0) + 1;

        document.title =
            `(${QRTalk.unread}) QRTalk`;

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:unread",
                {
                    detail: {
                        count:
                            QRTalk.unread,

                        packet
                    }
                }
            )
        );
    }

    function handleIncomingMessage(
        packet
    ) {
        if (
            !packet.id ||
            !packet.messageType
        ) {
            chatWarn(
                "Mensagem inválida recebida:",
                packet
            );

            return;
        }

        const store =
            ensureMessageStore();

        /*
        Não exibe novamente uma mensagem repetida,
        mas confirma a entrega novamente.
        */

        if (store.has(packet.id)) {
            sendReceipt(
                RECEIPT_TYPES.DELIVERED,
                packet.id
            );

            return;
        }

        renderChatMessage(
            packet,
            "received"
        );

        sendReceipt(
            RECEIPT_TYPES.DELIVERED,
            packet.id
        );

        registerUnreadMessage(
            packet
        );

        queueReadReceipt(
            packet.id
        );

        window.dispatchEvent(
            new CustomEvent(
                "qrtalk:message-received",
                {
                    detail: {
                        packet
                    }
                }
            )
        );
    }

    /*
    ==================================================
    EDITAR MENSAGEM
    ==================================================
    */

    function applyMessageEdit(
        messageId,
        newContent,
        editedAt = Date.now()
    ) {
        const store =
            ensureMessageStore();

        const record =
            store.get(messageId);

        if (
            !record ||
            record.packet.messageType !==
                MESSAGE_TYPES.TEXT
        ) {
            return false;
        }

        const content =
            String(newContent ?? "");

        record.packet.content = content;
        record.packet.editedAt = editedAt;

        if (
            record.contentElement?.classList.contains(
                "message-text"
            )
        ) {
            record.contentElement.textContent =
                content;
        }

        let edited =
            record.bubble.querySelector(
                ".message-edited"
            );

        if (!edited) {
            edited =
                document.createElement(
                    "span"
                );

            edited.className =
                "message-edited";

            edited.textContent =
                "editada";

            const footer =
                record.bubble.querySelector(
                    ".message-footer"
                );

            footer?.prepend(edited);
        }

        return true;
    }

    function editChatMessage(
        messageId,
        newContent
    ) {
        const content =
            String(newContent ?? "").trim();

        const record =
            ensureMessageStore().get(
                messageId
            );

        if (
            !record ||
            record.side !== "sent" ||
            !content ||
            !window.isPeerConnected()
        ) {
            return false;
        }

        const editedAt =
            Date.now();

        const sent =
            window.sendPeerPacket({
                type:
                    PACKET_TYPES.EDIT,

                messageId,
                content,
                editedAt
            });

        if (!sent) {
            return false;
        }

        return applyMessageEdit(
            messageId,
            content,
            editedAt
        );
    }

    /*
    ==================================================
    APAGAR MENSAGEM
    ==================================================
    */

    function applyMessageDeletion(
        messageId
    ) {
        const record =
            ensureMessageStore().get(
                messageId
            );

        if (!record) {
            return false;
        }

        record.packet.deleted = true;

        const reply =
            record.bubble.querySelector(
                ".reply-box"
            );

        reply?.remove();

        record.contentElement.replaceWith(
            createDeletedContent()
        );

        record.contentElement =
            record.bubble.querySelector(
                ".message-deleted"
            );

        const reactions =
            record.element.querySelector(
                ".reactions"
            );

        reactions?.remove();

        return true;
    }

    function createDeletedContent() {
        const element =
            document.createElement("div");

        element.className =
            "message-deleted";

        element.textContent =
            "🚫 Mensagem apagada";

        element.style.fontStyle =
            "italic";

        element.style.opacity = "0.75";

        return element;
    }

    function deleteChatMessageForEveryone(
        messageId
    ) {
        const record =
            ensureMessageStore().get(
                messageId
            );

        if (
            !record ||
            record.side !== "sent" ||
            !window.isPeerConnected()
        ) {
            return false;
        }

        const sent =
            window.sendPeerPacket({
                type:
                    PACKET_TYPES.DELETE,

                messageId,

                deletedAt:
                    Date.now()
            });

        if (!sent) {
            return false;
        }

        return applyMessageDeletion(
            messageId
        );
    }

    /*
    ==================================================
    REAGIR À MENSAGEM
    ==================================================
    */

    function reactToChatMessage(
        messageId,
        emoji
    ) {
        const value =
            String(emoji ?? "").trim();

        if (
            !value ||
            !ensureMessageStore().has(
                messageId
            ) ||
            !window.isPeerConnected()
        ) {
            return false;
        }

        const sent =
            window.sendPeerPacket({
                type:
                    PACKET_TYPES.REACTION,

                messageId,

                emoji: value,

                createdAt:
                    Date.now()
            });

        if (!sent) {
            return false;
        }

        return renderReaction(
            messageId,
            value
        );
    }

    /*
    ==================================================
    RESPONDER MENSAGEM
    ==================================================
    */

    function setReplyTarget(
        messageId
    ) {
        const record =
            ensureMessageStore().get(
                messageId
            );

        if (!record) {
            return false;
        }

        const preview =
            record.packet.messageType ===
                MESSAGE_TYPES.TEXT
                ? String(
                    record.packet.content ||
                    ""
                )
                : getMessageTypeLabel(
                    record.packet.messageType
                );

        QRTalk.replyingTo = {
            id:
                record.packet.id,

            side:
                record.side,

            messageType:
                record.packet.messageType,

            preview
        };

        showReplyPreview(
            QRTalk.replyingTo
        );

        QRTalk.elements.input?.focus();

        return true;
    }

    function getMessageTypeLabel(type) {
        switch (type) {
            case MESSAGE_TYPES.IMAGE:
                return "📷 Imagem";

            case MESSAGE_TYPES.AUDIO:
                return "🎤 Áudio";

            case MESSAGE_TYPES.VIDEO:
                return "🎬 Vídeo";

            case MESSAGE_TYPES.FILE:
                return "📎 Arquivo";

            case MESSAGE_TYPES.LOCATION:
                return "📍 Localização";

            default:
                return "Mensagem";
        }
    }

    function showReplyPreview(reply) {
        const previewArea =
            document.getElementById(
                "preview-area"
            );

        if (!previewArea || !reply) {
            return;
        }

        previewArea.innerHTML = "";

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "preview reply-preview";

        const text =
            document.createElement("div");

        text.style.flex = "1";

        const title =
            document.createElement("strong");

        title.textContent =
            reply.side === "sent"
                ? "Respondendo a você"
                : "Respondendo ao anônimo";

        const content =
            document.createElement("div");

        content.textContent =
            String(
                reply.preview ||
                "Mensagem"
            ).slice(0, 100);

        const close =
            document.createElement("button");

        close.type = "button";
        close.className = "icon-btn";
        close.title =
            "Cancelar resposta";

        close.textContent = "✕";

        close.addEventListener(
            "click",
            clearReplyTarget
        );

        text.appendChild(title);
        text.appendChild(content);

        wrapper.appendChild(text);
        wrapper.appendChild(close);

        previewArea.appendChild(
            wrapper
        );

        previewArea.classList.remove(
            "hidden"
        );
    }

    function clearReplyTarget() {
        QRTalk.replyingTo = null;

        const previewArea =
            document.getElementById(
                "preview-area"
            );

        if (!previewArea) {
            return;
        }

        const replyPreview =
            previewArea.querySelector(
                ".reply-preview"
            );

        replyPreview?.remove();

        if (!previewArea.children.length) {
            previewArea.classList.add(
                "hidden"
            );
        }
    }

    /*
    ==================================================
    MENSAGENS TEMPORÁRIAS
    ==================================================
    */

    function scheduleMessageExpiration(
        messageId,
        expiresAt
    ) {
        const remaining =
            expiresAt - Date.now();

        if (remaining <= 0) {
            expireMessage(
                messageId
            );

            return;
        }

        const maximumTimeout =
            2147483647;

        window.setTimeout(
            () => {
                expireMessage(
                    messageId
                );
            },
            Math.min(
                remaining,
                maximumTimeout
            )
        );
    }

    function expireMessage(
        messageId
    ) {
        const store =
            ensureMessageStore();

        const record =
            store.get(messageId);

        if (!record) {
            return;
        }

        record.element.remove();

        store.delete(messageId);
    }

    /*
    ==================================================
    PACOTES RECEBIDOS DO PEER.JS
    ==================================================
    */

    function convertLegacyPacket(
        packet
    ) {
        return {
            type:
                PACKET_TYPES.MESSAGE,

            id:
                packet.id ||
                createMessageId(),

            messageType:
                packet.type,

            content:
                packet.content,

            createdAt:
                packet.createdAt ||
                Date.now(),

            fileName:
                packet.fileName ||
                packet.name ||
                null,

            fileSize:
                packet.fileSize ||
                packet.size ||
                null,

            mime:
                packet.mime ||
                null
        };
    }

    function handleChatPacket(event) {
        const packet =
            event.detail;

        if (
            !packet ||
            typeof packet.type !== "string"
        ) {
            return;
        }

        switch (packet.type) {
            case PACKET_TYPES.MESSAGE:
                event.preventDefault();

                handleIncomingMessage(
                    packet
                );

                break;

            case PACKET_TYPES.RECEIPT:
                event.preventDefault();

                handleReceiptPacket(
                    packet
                );

                break;

            case PACKET_TYPES.EDIT:
                event.preventDefault();

                applyMessageEdit(
                    packet.messageId,
                    packet.content,
                    packet.editedAt
                );

                break;

            case PACKET_TYPES.DELETE:
                event.preventDefault();

                applyMessageDeletion(
                    packet.messageId
                );

                break;

            case PACKET_TYPES.REACTION:
                event.preventDefault();

                renderReaction(
                    packet.messageId,
                    packet.emoji
                );

                break;

            /*
            Compatibilidade com a primeira versão
            do QRTalk.
            */

            case "text":
            case "image":
            case "audio":
            case "video":
            case "file":
                event.preventDefault();

                handleIncomingMessage(
                    convertLegacyPacket(
                        packet
                    )
                );

                break;

            case "disconnect":
                event.preventDefault();

                window.handleRemoteDisconnect?.(
                    "A outra pessoa encerrou a conversa."
                );

                break;

            default:
                /*
                O pacote pertence a outro módulo.
                */
                break;
        }
    }

    /*
    ==================================================
    EVENTOS DA PÁGINA
    ==================================================
    */

    function handleVisibilityChange() {
        if (!document.hidden) {
            QRTalk.unread = 0;

            document.title =
                "QRTalk";

            flushPendingReadReceipts();
        }
    }

    /*
    ==================================================
    INICIALIZAÇÃO
    ==================================================
    */

    function initChat() {
        if (initialized) {
            return;
        }

        initialized = true;

        ensureMessageStore();

        const container =
            getMessagesContainer();

        /*
        Garante o alinhamento dos balões mesmo antes
        de ajustarmos novamente o CSS.
        */

        if (container) {
            container.style.display =
                "flex";

            container.style.flexDirection =
                "column";

            container.style.gap =
                "2px";
        }

        window.addEventListener(
            "qrtalk:packet",
            handleChatPacket
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener(
            "focus",
            handleVisibilityChange
        );

        document
            .getElementById(
                "image-viewer"
            )
            ?.addEventListener(
                "click",
                closeImageViewer
            );

        window.addEventListener(
            "beforeunload",
            revokeObjectUrls
        );

        chatLog(
            "Módulo de mensagens iniciado."
        );
    }

    /*
    ==================================================
    API PÚBLICA
    ==================================================
    */

    window.initChat =
        initChat;

    window.sendCurrentMessage =
        sendCurrentMessage;

    window.sendChatPayload =
        sendChatPayload;

    window.renderChatMessage =
        renderChatMessage;

    window.addTextMessage =
        addTextMessage;

    window.addSystemMessage =
        addSystemMessage;

    window.updateMessageStatus =
        updateMessageStatus;

    window.sendChatReceipt =
        sendReceipt;

    window.flushPendingReadReceipts =
        flushPendingReadReceipts;

    window.editChatMessage =
        editChatMessage;

    window.deleteChatMessageForEveryone =
        deleteChatMessageForEveryone;

    window.reactToChatMessage =
        reactToChatMessage;

    window.setReplyTarget =
        setReplyTarget;

    window.clearReplyTarget =
        clearReplyTarget;

    window.openImageViewer =
        openImageViewer;

    window.closeImageViewer =
        closeImageViewer;

    /*
    O app.js não chama initChat diretamente, portanto
    este módulo se inicializa quando o HTML termina
    de carregar.
    */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initChat
        );
    } else {
        initChat();
    }
})();