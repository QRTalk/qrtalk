/*
==================================================
QRTalk 3.0
Arquivos, imagens, vídeos e transferência P2P em blocos
==================================================
*/

"use strict";

(() => {
    const TYPES = Object.freeze({
        OFFER: "transfer:offer",
        ACCEPT: "transfer:accept",
        REJECT: "transfer:reject",
        CHUNK: "transfer:chunk",
        ACK: "transfer:ack",
        COMPLETE: "transfer:complete",
        STORED: "transfer:stored",
        MISSING: "transfer:missing",
        CANCEL: "transfer:cancel",
        ERROR: "transfer:error"
    });

    const LIMITS = Object.freeze({
        image: 20 * 1024 * 1024,
        audio: 25 * 1024 * 1024,
        video: 50 * 1024 * 1024,
        file: 50 * 1024 * 1024
    });

    const CHUNK_SIZE = 64 * 1024;
    const WINDOW_SIZE = 6;
    const ACK_TIMEOUT = 6000;
    const MAX_RETRIES = 4;
    const RETRY_CHECK_INTERVAL = 1000;

    const outgoingTransfers = new Map();
    const incomingTransfers = new Map();
    let initialized = false;
    let previewObjectUrl = null;

    function log(...args) {
        console.log("[QRTalk/Files]", ...args);
    }

    function warn(...args) {
        console.warn("[QRTalk/Files]", ...args);
    }

    function createId(prefix = "transfer") {
        if (window.crypto?.randomUUID) {
            return `${prefix}-${window.crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }

    function formatBytes(bytes) {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value <= 0) return "0 B";

        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(
            Math.floor(Math.log(value) / Math.log(1024)),
            units.length - 1
        );
        const result = value / Math.pow(1024, index);
        return `${result.toFixed(result >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
    }

    function deriveMessageType(file, forcedType = null) {
        if (forcedType && LIMITS[forcedType]) return forcedType;

        const mime = String(file?.type || "").toLowerCase();
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("audio/")) return "audio";
        if (mime.startsWith("video/")) return "video";
        return "file";
    }

    function normalizeDescriptor(fileOrBlob, options = {}) {
        if (!(fileOrBlob instanceof Blob)) {
            throw new TypeError("O conteúdo selecionado não é um arquivo válido.");
        }

        const messageType = deriveMessageType(fileOrBlob, options.messageType);
        const extension = messageType === "image"
            ? ".jpg"
            : messageType === "audio"
                ? ".webm"
                : messageType === "video"
                    ? ".webm"
                    : "";

        return {
            blob: fileOrBlob,
            name: String(
                options.name ||
                fileOrBlob.name ||
                `qrtalk-${Date.now()}${extension}`
            ),
            mime: String(options.mime || fileOrBlob.type || "application/octet-stream"),
            size: Number(fileOrBlob.size || 0),
            messageType,
            source: options.source || "file",
            autoSend: options.autoSend === true
        };
    }

    function validateDescriptor(descriptor) {
        const maximum = LIMITS[descriptor.messageType] || LIMITS.file;

        if (!descriptor.size) {
            return "O arquivo está vazio.";
        }

        if (descriptor.size > maximum) {
            return `O limite para este tipo de arquivo é ${formatBytes(maximum)}.`;
        }

        return null;
    }

    function isConnected() {
        return Boolean(
            typeof window.isPeerConnected === "function" &&
            window.isPeerConnected() &&
            typeof window.sendPeerPacket === "function"
        );
    }

    function getPreviewArea() {
        return document.getElementById("preview-area");
    }

    function clearPreview() {
        const area = getPreviewArea();
        if (area) {
            area.innerHTML = "";
            area.classList.add("hidden");
        }

        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
    }

    function ensurePreviewStyles() {
        if (document.getElementById("qrtalk-file-styles")) return;

        const style = document.createElement("style");
        style.id = "qrtalk-file-styles";
        style.textContent = `
            .file-preview-card,
            .transfer-progress-card {
                margin: 8px 12px;
                padding: 12px;
                border-radius: 16px;
                background: #1e293b;
                border: 1px solid rgba(255,255,255,.08);
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .file-preview-media {
                width: 72px;
                height: 72px;
                flex: 0 0 72px;
                border-radius: 12px;
                object-fit: cover;
                background: #0f172a;
            }

            .file-preview-icon {
                width: 56px;
                height: 56px;
                flex: 0 0 56px;
                display: grid;
                place-items: center;
                border-radius: 14px;
                background: rgba(255,255,255,.08);
                font-size: 27px;
            }

            .file-preview-info,
            .transfer-progress-info {
                min-width: 0;
                flex: 1;
            }

            .file-preview-name,
            .transfer-progress-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 600;
            }

            .file-preview-meta,
            .transfer-progress-label {
                margin-top: 4px;
                color: #94a3b8;
                font-size: 12px;
            }

            .file-preview-actions {
                display: flex;
                gap: 8px;
                margin-left: auto;
            }

            .file-preview-actions button {
                min-height: 38px;
                padding: 0 14px;
                border: 0;
                border-radius: 999px;
                color: #fff;
                cursor: pointer;
            }

            .file-preview-cancel { background: #475569; }
            .file-preview-send { background: #2563eb; }

            .transfer-progress-track {
                height: 8px;
                margin-top: 9px;
                overflow: hidden;
                border-radius: 999px;
                background: #0f172a;
            }

            .transfer-progress-fill {
                width: 0;
                height: 100%;
                background: linear-gradient(90deg,#2563eb,#60a5fa);
                transition: width .15s linear;
            }

            .transfer-cancel-btn {
                width: 40px;
                height: 40px;
                flex: 0 0 40px;
                border: 0;
                border-radius: 50%;
                background: #475569;
                color: #fff;
                cursor: pointer;
            }

            .chat-drop-active {
                outline: 2px dashed #60a5fa;
                outline-offset: -8px;
            }

            @media (max-width: 480px) {
                .file-preview-card,
                .transfer-progress-card {
                    margin: 7px 8px;
                }

                .file-preview-actions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function createMediaPreview(descriptor) {
        if (!["image", "video", "audio"].includes(descriptor.messageType)) {
            const icon = document.createElement("div");
            icon.className = "file-preview-icon";
            icon.textContent = "📄";
            return icon;
        }

        previewObjectUrl = URL.createObjectURL(descriptor.blob);

        if (descriptor.messageType === "image") {
            const image = document.createElement("img");
            image.className = "file-preview-media";
            image.src = previewObjectUrl;
            image.alt = descriptor.name;
            return image;
        }

        if (descriptor.messageType === "video") {
            const video = document.createElement("video");
            video.className = "file-preview-media";
            video.src = previewObjectUrl;
            video.muted = true;
            video.playsInline = true;
            return video;
        }

        const icon = document.createElement("div");
        icon.className = "file-preview-icon";
        icon.textContent = "🎤";
        return icon;
    }

    function showFilePreview(descriptor) {
        const area = getPreviewArea();
        if (!area) return;

        clearPreview();

        const card = document.createElement("div");
        card.className = "file-preview-card";

        const media = createMediaPreview(descriptor);
        const info = document.createElement("div");
        info.className = "file-preview-info";

        const name = document.createElement("div");
        name.className = "file-preview-name";
        name.textContent = descriptor.name;

        const meta = document.createElement("div");
        meta.className = "file-preview-meta";
        meta.textContent = `${formatBytes(descriptor.size)} • ${descriptor.messageType}`;

        const actions = document.createElement("div");
        actions.className = "file-preview-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "file-preview-cancel";
        cancel.textContent = "Cancelar";
        cancel.addEventListener("click", clearPreview);

        const send = document.createElement("button");
        send.type = "button";
        send.className = "file-preview-send";
        send.textContent = "Enviar";
        send.addEventListener("click", async () => {
            send.disabled = true;
            cancel.disabled = true;
            await startTransfer(descriptor);
        });

        info.append(name, meta);
        actions.append(cancel, send);
        card.append(media, info, actions);
        area.appendChild(card);
        area.classList.remove("hidden");
    }

    function createProgressCard(transfer, direction) {
        const area = getPreviewArea();
        if (!area) return null;

        clearPreview();

        const card = document.createElement("div");
        card.className = "transfer-progress-card";
        card.dataset.transferId = transfer.transferId;

        const icon = document.createElement("div");
        icon.className = "file-preview-icon";
        icon.textContent = direction === "outgoing" ? "⬆️" : "⬇️";

        const info = document.createElement("div");
        info.className = "transfer-progress-info";

        const name = document.createElement("div");
        name.className = "transfer-progress-name";
        name.textContent = transfer.name;

        const label = document.createElement("div");
        label.className = "transfer-progress-label";
        label.textContent = direction === "outgoing" ? "Preparando envio..." : "Recebendo...";

        const track = document.createElement("div");
        track.className = "transfer-progress-track";

        const fill = document.createElement("div");
        fill.className = "transfer-progress-fill";
        track.appendChild(fill);

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "transfer-cancel-btn";
        cancel.title = "Cancelar transferência";
        cancel.textContent = "✕";
        cancel.addEventListener("click", () => cancelTransfer(transfer.transferId, true));

        info.append(name, label, track);
        card.append(icon, info, cancel);
        area.appendChild(card);
        area.classList.remove("hidden");

        return { card, label, fill };
    }

    function updateProgress(record, percent, labelText = null) {
        const value = Math.max(0, Math.min(100, Number(percent) || 0));
        if (record.ui?.fill) record.ui.fill.style.width = `${value}%`;
        if (record.ui?.label) {
            record.ui.label.textContent = labelText || `${Math.round(value)}%`;
        }
    }

    async function prepareQRTalkFile(fileOrBlob, options = {}) {
        try {
            const descriptor = normalizeDescriptor(fileOrBlob, options);
            const error = validateDescriptor(descriptor);

            if (error) {
                window.toast?.(error, "error");
                window.addSystemMessage?.(error);
                return null;
            }

            if (descriptor.autoSend) {
                await startTransfer(descriptor);
            } else {
                showFilePreview(descriptor);
            }

            return descriptor;
        } catch (error) {
            warn(error);
            window.toast?.("Não foi possível preparar o arquivo.", "error");
            return null;
        }
    }

    async function startTransfer(descriptor) {
        if (!isConnected()) {
            window.toast?.("A outra pessoa está offline.", "error");
            window.addSystemMessage?.("Não foi possível enviar o arquivo: a outra pessoa está offline.");
            return null;
        }

        const transferId = createId("tx");
        const messageId = createId("msg");
        const buffer = await descriptor.blob.arrayBuffer();
        const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

        const transfer = {
            transferId,
            messageId,
            name: descriptor.name,
            mime: descriptor.mime,
            size: descriptor.size,
            messageType: descriptor.messageType,
            blob: descriptor.blob,
            buffer,
            totalChunks,
            nextIndex: 0,
            acked: new Set(),
            inFlight: new Map(),
            createdAt: Date.now(),
            replyTo: QRTalk.replyingTo || null,
            retryTimer: null,
            canceled: false,
            ui: null
        };

        outgoingTransfers.set(transferId, transfer);
        transfer.ui = createProgressCard(transfer, "outgoing");
        updateProgress(transfer, 0, "Aguardando o outro aparelho...");

        const sent = window.sendPeerPacket({
            type: TYPES.OFFER,
            transferId,
            messageId,
            name: transfer.name,
            mime: transfer.mime,
            size: transfer.size,
            messageType: transfer.messageType,
            totalChunks,
            chunkSize: CHUNK_SIZE,
            createdAt: transfer.createdAt,
            replyTo: transfer.replyTo
        });

        if (!sent) {
            failOutgoingTransfer(transfer, "Não foi possível iniciar a transferência.");
            return null;
        }

        transfer.retryTimer = window.setInterval(
            () => checkOutgoingTimeouts(transfer),
            RETRY_CHECK_INTERVAL
        );

        return transferId;
    }

    function sendChunk(transfer, index, retry = false) {
        if (transfer.canceled || !isConnected()) return false;

        const start = index * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, transfer.buffer.byteLength);
        const data = transfer.buffer.slice(start, end);
        const previous = transfer.inFlight.get(index);
        const retries = retry ? (previous?.retries || 0) + 1 : (previous?.retries || 0);

        const sent = window.sendPeerPacket({
            type: TYPES.CHUNK,
            transferId: transfer.transferId,
            index,
            data,
            byteLength: data.byteLength
        });

        if (!sent) return false;

        transfer.inFlight.set(index, {
            sentAt: Date.now(),
            retries
        });

        return true;
    }

    function pumpOutgoing(transfer) {
        while (
            !transfer.canceled &&
            transfer.inFlight.size < WINDOW_SIZE &&
            transfer.nextIndex < transfer.totalChunks
        ) {
            const index = transfer.nextIndex++;
            if (!transfer.acked.has(index)) sendChunk(transfer, index);
        }

        if (
            !transfer.canceled &&
            transfer.acked.size === transfer.totalChunks &&
            transfer.inFlight.size === 0
        ) {
            updateProgress(transfer, 100, "Finalizando...");
            window.sendPeerPacket({
                type: TYPES.COMPLETE,
                transferId: transfer.transferId
            });
        }
    }

    function checkOutgoingTimeouts(transfer) {
        if (transfer.canceled) return;

        const now = Date.now();
        for (const [index, state] of transfer.inFlight.entries()) {
            if (now - state.sentAt < ACK_TIMEOUT) continue;

            if (state.retries >= MAX_RETRIES) {
                failOutgoingTransfer(transfer, "A transferência expirou.");
                return;
            }

            sendChunk(transfer, index, true);
        }
    }

    function handleOffer(packet) {
        const size = Number(packet.size || 0);
        const messageType = LIMITS[packet.messageType] ? packet.messageType : "file";
        const maximum = LIMITS[messageType] || LIMITS.file;

        if (!packet.transferId || !packet.messageId || !size || size > maximum) {
            window.sendPeerPacket({
                type: TYPES.REJECT,
                transferId: packet.transferId,
                reason: size > maximum
                    ? `Arquivo maior que ${formatBytes(maximum)}.`
                    : "Oferta de arquivo inválida."
            });
            return;
        }

        if (incomingTransfers.has(packet.transferId)) {
            window.sendPeerPacket({ type: TYPES.ACCEPT, transferId: packet.transferId });
            return;
        }

        const transfer = {
            transferId: packet.transferId,
            messageId: packet.messageId,
            name: String(packet.name || "arquivo"),
            mime: String(packet.mime || "application/octet-stream"),
            size,
            messageType,
            totalChunks: Number(packet.totalChunks || 0),
            chunks: new Array(Number(packet.totalChunks || 0)),
            received: new Set(),
            receivedBytes: 0,
            createdAt: Number(packet.createdAt || Date.now()),
            replyTo: packet.replyTo || null,
            canceled: false,
            ui: null
        };

        incomingTransfers.set(transfer.transferId, transfer);
        transfer.ui = createProgressCard(transfer, "incoming");
        updateProgress(transfer, 0, `Recebendo ${formatBytes(size)}...`);

        window.sendPeerPacket({
            type: TYPES.ACCEPT,
            transferId: transfer.transferId
        });
    }

    function handleAccept(packet) {
        const transfer = outgoingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        updateProgress(transfer, 0, "Enviando...");
        pumpOutgoing(transfer);
    }

    function handleChunk(packet) {
        const transfer = incomingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        const index = Number(packet.index);
        if (!Number.isInteger(index) || index < 0 || index >= transfer.totalChunks) return;

        if (!transfer.received.has(index)) {
            let data = packet.data;
            if (ArrayBuffer.isView(data)) {
                data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            }

            if (!(data instanceof ArrayBuffer)) return;

            transfer.chunks[index] = data;
            transfer.received.add(index);
            transfer.receivedBytes += data.byteLength;

            const percent = (transfer.receivedBytes / transfer.size) * 100;
            updateProgress(
                transfer,
                percent,
                `Recebendo... ${Math.round(percent)}%`
            );
        }

        window.sendPeerPacket({
            type: TYPES.ACK,
            transferId: transfer.transferId,
            index
        });
    }

    function handleAck(packet) {
        const transfer = outgoingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        const index = Number(packet.index);
        if (!Number.isInteger(index)) return;

        transfer.inFlight.delete(index);
        transfer.acked.add(index);

        const percent = (transfer.acked.size / transfer.totalChunks) * 100;
        updateProgress(
            transfer,
            percent,
            `Enviando... ${Math.round(percent)}%`
        );

        pumpOutgoing(transfer);
    }

    function handleComplete(packet) {
        const transfer = incomingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        const missing = [];
        for (let index = 0; index < transfer.totalChunks; index += 1) {
            if (!transfer.received.has(index)) missing.push(index);
        }

        if (missing.length) {
            window.sendPeerPacket({
                type: TYPES.MISSING,
                transferId: transfer.transferId,
                indexes: missing.slice(0, 256)
            });
            return;
        }

        const blob = new Blob(transfer.chunks, { type: transfer.mime });
        const chatPacket = {
            type: "chat:message",
            id: transfer.messageId,
            messageType: transfer.messageType,
            content: blob,
            fileName: transfer.name,
            fileSize: transfer.size,
            mime: transfer.mime,
            createdAt: transfer.createdAt,
            replyTo: transfer.replyTo
        };

        window.dispatchEvent(new CustomEvent("qrtalk:packet", {
            detail: chatPacket,
            cancelable: true
        }));

        updateProgress(transfer, 100, "Recebido.");
        window.sendPeerPacket({
            type: TYPES.STORED,
            transferId: transfer.transferId
        });

        window.setTimeout(() => cleanupIncomingTransfer(transfer.transferId), 900);
    }

    function handleMissing(packet) {
        const transfer = outgoingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        const indexes = Array.isArray(packet.indexes) ? packet.indexes : [];
        indexes.forEach((index) => {
            const value = Number(index);
            if (!Number.isInteger(value) || value < 0 || value >= transfer.totalChunks) return;
            transfer.acked.delete(value);
            transfer.inFlight.delete(value);
            sendChunk(transfer, value, true);
        });
    }

    function handleStored(packet) {
        const transfer = outgoingTransfers.get(packet.transferId);
        if (!transfer || transfer.canceled) return;

        const chatPacket = {
            type: "chat:message",
            id: transfer.messageId,
            messageType: transfer.messageType,
            content: transfer.blob,
            fileName: transfer.name,
            fileSize: transfer.size,
            mime: transfer.mime,
            createdAt: transfer.createdAt,
            replyTo: transfer.replyTo
        };

        window.renderChatMessage?.(chatPacket, "sent", "sent");
        window.dispatchEvent(new CustomEvent("qrtalk:message-sent", {
            detail: { packet: chatPacket }
        }));

        window.clearReplyTarget?.();
        updateProgress(transfer, 100, "Enviado.");
        window.setTimeout(() => cleanupOutgoingTransfer(transfer.transferId), 900);
    }

    function handleReject(packet) {
        const transfer = outgoingTransfers.get(packet.transferId);
        if (!transfer) return;
        failOutgoingTransfer(transfer, packet.reason || "O outro aparelho recusou o arquivo.");
    }

    function failOutgoingTransfer(transfer, reason) {
        if (!transfer) return;
        transfer.canceled = true;
        if (transfer.retryTimer) window.clearInterval(transfer.retryTimer);
        updateProgress(transfer, 0, reason);
        window.toast?.(reason, "error");
        window.setTimeout(() => cleanupOutgoingTransfer(transfer.transferId), 1800);
    }

    function cancelTransfer(transferId, notifyRemote = false) {
        const outgoing = outgoingTransfers.get(transferId);
        const incoming = incomingTransfers.get(transferId);
        const transfer = outgoing || incoming;
        if (!transfer) return false;

        transfer.canceled = true;

        if (notifyRemote && isConnected()) {
            window.sendPeerPacket({
                type: TYPES.CANCEL,
                transferId,
                reason: "Transferência cancelada."
            });
        }

        if (outgoing) cleanupOutgoingTransfer(transferId);
        if (incoming) cleanupIncomingTransfer(transferId);
        window.toast?.("Transferência cancelada.", "warning");
        return true;
    }

    function cleanupOutgoingTransfer(transferId) {
        const transfer = outgoingTransfers.get(transferId);
        if (transfer?.retryTimer) window.clearInterval(transfer.retryTimer);
        outgoingTransfers.delete(transferId);
        const card = document.querySelector(`[data-transfer-id="${CSS.escape(transferId)}"]`);
        card?.remove();
        const area = getPreviewArea();
        if (area && !area.children.length) area.classList.add("hidden");
    }

    function cleanupIncomingTransfer(transferId) {
        incomingTransfers.delete(transferId);
        const card = document.querySelector(`[data-transfer-id="${CSS.escape(transferId)}"]`);
        card?.remove();
        const area = getPreviewArea();
        if (area && !area.children.length) area.classList.add("hidden");
    }

    function handleTransferPacket(event) {
        const packet = event.detail;
        if (!packet || typeof packet.type !== "string") return;

        const handlers = {
            [TYPES.OFFER]: handleOffer,
            [TYPES.ACCEPT]: handleAccept,
            [TYPES.REJECT]: handleReject,
            [TYPES.CHUNK]: handleChunk,
            [TYPES.ACK]: handleAck,
            [TYPES.COMPLETE]: handleComplete,
            [TYPES.STORED]: handleStored,
            [TYPES.MISSING]: handleMissing,
            [TYPES.CANCEL]: (value) => cancelTransfer(value.transferId, false),
            [TYPES.ERROR]: (value) => {
                const transfer = outgoingTransfers.get(value.transferId);
                if (transfer) failOutgoingTransfer(transfer, value.reason || "Erro na transferência.");
            }
        };

        const handler = handlers[packet.type];
        if (!handler) return;

        event.preventDefault();
        handler(packet);
    }

    function handleInputSelection(input, options = {}) {
        const file = input.files?.[0];
        input.value = "";
        if (file) prepareQRTalkFile(file, options);
    }

    function bindInputs() {
        const galleryButton = document.getElementById("gallery-btn");
        const attachButton = document.getElementById("attach-btn");
        const imageInput = document.getElementById("image-input");
        const fileInput = document.getElementById("file-input");
        const videoInput = document.getElementById("video-input");

        galleryButton?.addEventListener("click", () => imageInput?.click());
        attachButton?.addEventListener("click", () => fileInput?.click());

        imageInput?.addEventListener("change", () => {
            handleInputSelection(imageInput, { messageType: "image", source: "gallery" });
        });

        fileInput?.addEventListener("change", () => {
            handleInputSelection(fileInput, { source: "attachment" });
        });

        videoInput?.addEventListener("change", () => {
            handleInputSelection(videoInput, { messageType: "video", source: "video" });
        });
    }

    function bindDropAndPaste() {
        const chatScreen = document.getElementById("chat-screen");
        if (!chatScreen) return;

        ["dragenter", "dragover"].forEach((name) => {
            chatScreen.addEventListener(name, (event) => {
                event.preventDefault();
                chatScreen.classList.add("chat-drop-active");
            });
        });

        ["dragleave", "drop"].forEach((name) => {
            chatScreen.addEventListener(name, (event) => {
                event.preventDefault();
                chatScreen.classList.remove("chat-drop-active");
            });
        });

        chatScreen.addEventListener("drop", (event) => {
            const file = event.dataTransfer?.files?.[0];
            if (file) prepareQRTalkFile(file, { source: "drop" });
        });

        document.addEventListener("paste", (event) => {
            const item = Array.from(event.clipboardData?.items || [])
                .find((candidate) => candidate.kind === "file");
            const file = item?.getAsFile();
            if (file) prepareQRTalkFile(file, { source: "clipboard" });
        });
    }

    function handleDisconnected() {
        [...outgoingTransfers.keys()].forEach((id) => cancelTransfer(id, false));
        [...incomingTransfers.keys()].forEach((id) => cancelTransfer(id, false));
        clearPreview();
    }

    function initFiles() {
        if (initialized) return;
        initialized = true;

        ensurePreviewStyles();
        bindInputs();
        bindDropAndPaste();

        window.addEventListener("qrtalk:packet", handleTransferPacket);
        window.addEventListener("qrtalk:disconnected", handleDisconnected);
        window.addEventListener("qrtalk:session-ended", handleDisconnected);
        window.addEventListener("pagehide", handleDisconnected);

        QRTalk.transfers = {
            outgoing: outgoingTransfers,
            incoming: incomingTransfers
        };

        log("Transferência de arquivos iniciada.");
    }

    window.initFiles = initFiles;
    window.prepareQRTalkFile = prepareQRTalkFile;
    window.sendQRTalkFile = (file, options = {}) => prepareQRTalkFile(file, {
        ...options,
        autoSend: true
    });
    window.cancelFileTransfer = cancelTransfer;
    window.clearFilePreview = clearPreview;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initFiles);
    } else {
        initFiles();
    }
})();
