/*
==================================================
QRTalk 3.0
Criptografia de sessão com ECDH P-256 e AES-GCM
==================================================
*/

"use strict";

(() => {
    const TYPES = Object.freeze({
        HELLO: "crypto:hello",
        READY: "crypto:ready",
        DATA: "crypto:data",
        ERROR: "crypto:error"
    });

    const MAX_QUEUE = 300;
    const MAX_PENDING_ENCRYPTED = 200;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let initialized = false;
    let rawSendPeerPacket = null;

    const state = {
        supported: Boolean(window.crypto?.subtle),
        connectionPeer: null,
        keyPair: null,
        publicJwk: null,
        remotePublicJwk: null,
        aesKey: null,
        securityCode: null,
        helloSent: false,
        remoteReady: false,
        ready: false,
        handshakePromise: null,
        outgoingQueue: [],
        pendingEncrypted: [],
        announced: false
    };

    function log(...args) {
        console.log("[QRTalk/Crypto]", ...args);
    }

    function warn(...args) {
        console.warn("[QRTalk/Crypto]", ...args);
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }

    function isConnected() {
        return Boolean(
            typeof window.isPeerConnected === "function" &&
            window.isPeerConnected()
        );
    }

    function isCryptoPacket(packet) {
        return typeof packet?.type === "string" && packet.type.startsWith("crypto:");
    }

    function resetSession(options = {}) {
        const preservedQueue = options.preserveQueue
            ? [...state.outgoingQueue]
            : [];

        state.connectionPeer = options.connectionPeer || null;
        state.keyPair = null;
        state.publicJwk = null;
        state.remotePublicJwk = null;
        state.aesKey = null;
        state.securityCode = null;
        state.helloSent = false;
        state.remoteReady = false;
        state.ready = false;
        state.handshakePromise = null;
        state.outgoingQueue = preservedQueue;
        state.pendingEncrypted = [];
        state.announced = false;

        exposeState();
    }

    function exposeState() {
        QRTalk.crypto = {
            supported: state.supported,
            ready: state.ready,
            securityCode: state.securityCode,
            connectionPeer: state.connectionPeer
        };
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const step = 0x8000;

        for (let offset = 0; offset < bytes.length; offset += step) {
            const part = bytes.subarray(offset, Math.min(offset + step, bytes.length));
            binary += String.fromCharCode(...part);
        }

        return btoa(binary);
    }

    function base64ToArrayBuffer(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes.buffer;
    }

    function packetReplacer(_key, value) {
        if (value instanceof ArrayBuffer) {
            return {
                __qrtalkBinary: true,
                kind: "ArrayBuffer",
                data: arrayBufferToBase64(value)
            };
        }

        if (ArrayBuffer.isView(value)) {
            const buffer = value.buffer.slice(
                value.byteOffset,
                value.byteOffset + value.byteLength
            );
            return {
                __qrtalkBinary: true,
                kind: value.constructor?.name || "TypedArray",
                data: arrayBufferToBase64(buffer)
            };
        }

        if (value instanceof Blob) {
            throw new TypeError(
                "Blobs devem ser enviados pelo módulo files.js, que faz a divisão em blocos."
            );
        }

        return value;
    }

    function packetReviver(_key, value) {
        if (value?.__qrtalkBinary === true && typeof value.data === "string") {
            return base64ToArrayBuffer(value.data);
        }
        return value;
    }

    function serializePacket(packet) {
        return encoder.encode(JSON.stringify(packet, packetReplacer));
    }

    function deserializePacket(buffer) {
        return JSON.parse(decoder.decode(buffer), packetReviver);
    }

    async function ensureLocalKeyPair() {
        if (state.keyPair && state.publicJwk) return state.keyPair;

        state.keyPair = await window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            ["deriveBits"]
        );

        state.publicJwk = await window.crypto.subtle.exportKey(
            "jwk",
            state.keyPair.publicKey
        );

        return state.keyPair;
    }

    async function deriveSessionKey(remoteJwk) {
        await ensureLocalKeyPair();

        const remotePublicKey = await window.crypto.subtle.importKey(
            "jwk",
            remoteJwk,
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            false,
            []
        );

        const secret = await window.crypto.subtle.deriveBits(
            {
                name: "ECDH",
                public: remotePublicKey
            },
            state.keyPair.privateKey,
            256
        );

        state.aesKey = await window.crypto.subtle.importKey(
            "raw",
            secret,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );

        const digest = await window.crypto.subtle.digest("SHA-256", secret);
        const hex = Array.from(new Uint8Array(digest).slice(0, 6))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase();

        state.securityCode = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
        state.ready = true;
        exposeState();

        rawSendPeerPacket({
            type: TYPES.READY,
            securityCode: state.securityCode,
            createdAt: Date.now()
        });

        announceEncryption();
        await flushOutgoingQueue();
        await flushPendingEncrypted();
    }

    async function sendHello() {
        if (!state.supported || state.helloSent || !isConnected()) return false;

        await ensureLocalKeyPair();

        const sent = rawSendPeerPacket({
            type: TYPES.HELLO,
            publicKey: state.publicJwk,
            createdAt: Date.now()
        });

        if (sent) state.helloSent = true;
        return sent;
    }

    function beginHandshake() {
        if (!state.supported || !isConnected()) return Promise.resolve(false);
        if (state.handshakePromise) return state.handshakePromise;

        state.connectionPeer = QRTalk.conn?.peer || state.connectionPeer;
        exposeState();

        state.handshakePromise = (async () => {
            try {
                await sendHello();
                return true;
            } catch (error) {
                warn("Falha ao iniciar a criptografia:", error);
                rawSendPeerPacket?.({
                    type: TYPES.ERROR,
                    reason: "Falha ao iniciar a criptografia.",
                    createdAt: Date.now()
                });
                return false;
            } finally {
                state.handshakePromise = null;
            }
        })();

        return state.handshakePromise;
    }

    async function encryptAndSend(packet) {
        if (!state.aesKey || !state.ready) {
            queueOutgoing(packet);
            await beginHandshake();
            return true;
        }

        try {
            const id = createId();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const additionalData = encoder.encode(id);
            const plaintext = serializePacket(packet);

            const cipher = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData,
                    tagLength: 128
                },
                state.aesKey,
                plaintext
            );

            const sent = rawSendPeerPacket({
                type: TYPES.DATA,
                id,
                iv: iv.buffer,
                cipher,
                createdAt: Date.now()
            });

            if (!sent) {
                throw new Error("A conexão recusou o pacote criptografado.");
            }

            return true;
        } catch (error) {
            warn("Falha ao criptografar pacote:", error);
            window.dispatchEvent(new CustomEvent("qrtalk:crypto-error", {
                detail: { error }
            }));
            return false;
        }
    }

    function queueOutgoing(packet) {
        if (state.outgoingQueue.length >= MAX_QUEUE) {
            state.outgoingQueue.shift();
            window.toast?.("A fila segura ficou cheia; o pacote mais antigo foi descartado.", "warning");
        }
        state.outgoingQueue.push(packet);
    }

    async function flushOutgoingQueue() {
        if (!state.ready || !state.aesKey || !state.outgoingQueue.length) return;

        const queue = state.outgoingQueue.splice(0, state.outgoingQueue.length);
        for (const packet of queue) {
            const sent = await encryptAndSend(packet);
            if (!sent) {
                queueOutgoing(packet);
                break;
            }
        }
    }

    async function decryptEnvelope(packet) {
        if (!state.aesKey || !state.ready) {
            if (state.pendingEncrypted.length >= MAX_PENDING_ENCRYPTED) {
                state.pendingEncrypted.shift();
            }
            state.pendingEncrypted.push(packet);
            await beginHandshake();
            return;
        }

        try {
            const iv = packet.iv instanceof ArrayBuffer
                ? new Uint8Array(packet.iv)
                : new Uint8Array(packet.iv?.buffer || packet.iv);
            const cipher = packet.cipher instanceof ArrayBuffer
                ? packet.cipher
                : packet.cipher?.buffer;

            if (!packet.id || !iv?.byteLength || !cipher) {
                throw new Error("Envelope criptografado inválido.");
            }

            const plaintext = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv,
                    additionalData: encoder.encode(packet.id),
                    tagLength: 128
                },
                state.aesKey,
                cipher
            );

            const decodedPacket = deserializePacket(plaintext);

            window.dispatchEvent(new CustomEvent("qrtalk:packet", {
                detail: decodedPacket,
                cancelable: true
            }));
        } catch (error) {
            warn("Pacote não pôde ser autenticado ou descriptografado:", error);
            window.toast?.("Um pacote seguro inválido foi bloqueado.", "error");
            window.dispatchEvent(new CustomEvent("qrtalk:crypto-error", {
                detail: { error }
            }));
        }
    }

    async function flushPendingEncrypted() {
        if (!state.ready || !state.pendingEncrypted.length) return;
        const queue = state.pendingEncrypted.splice(0, state.pendingEncrypted.length);
        for (const packet of queue) {
            await decryptEnvelope(packet);
        }
    }

    function secureSendPeerPacket(packet) {
        if (!packet || typeof packet !== "object") return false;
        if (!state.supported || isCryptoPacket(packet)) {
            return rawSendPeerPacket(packet);
        }

        if (!isConnected()) return false;

        if (!state.ready || !state.aesKey) {
            queueOutgoing(packet);
            beginHandshake();
            return true;
        }

        encryptAndSend(packet);
        return true;
    }

    function announceEncryption() {
        if (state.announced || !state.securityCode) return;
        state.announced = true;

        window.addSystemMessage?.(
            `🔒 Criptografia ativada. Código de conferência: ${state.securityCode}`
        );

        window.dispatchEvent(new CustomEvent("qrtalk:crypto-ready", {
            detail: {
                securityCode: state.securityCode
            }
        }));
    }

    async function handleHello(packet) {
        if (!packet.publicKey || !state.supported) return;

        state.remotePublicJwk = packet.publicKey;
        await sendHello();

        if (!state.aesKey) {
            await deriveSessionKey(packet.publicKey);
        }
    }

    function handleReady(packet) {
        state.remoteReady = true;

        if (
            state.securityCode &&
            packet.securityCode &&
            state.securityCode !== packet.securityCode
        ) {
            window.toast?.("Os códigos de segurança não coincidem.", "error");
            window.addSystemMessage?.("⚠️ A conferência da chave de segurança falhou.");
            return;
        }

        announceEncryption();
    }

    function handleCryptoPacket(event) {
        const packet = event.detail;
        if (!isCryptoPacket(packet)) return;

        event.preventDefault();

        switch (packet.type) {
            case TYPES.HELLO:
                handleHello(packet).catch((error) => warn("Erro no hello criptográfico:", error));
                break;

            case TYPES.READY:
                handleReady(packet);
                break;

            case TYPES.DATA:
                decryptEnvelope(packet);
                break;

            case TYPES.ERROR:
                window.toast?.(packet.reason || "Erro na negociação criptográfica.", "error");
                break;

            default:
                break;
        }
    }

    function handleConnected() {
        const peerId = QRTalk.conn?.peer || null;

        if (state.connectionPeer !== peerId) {
            resetSession({
                preserveQueue: true,
                connectionPeer: peerId
            });
        }

        if (!state.supported) {
            window.addSystemMessage?.("⚠️ Este navegador não oferece Web Crypto; a camada adicional de criptografia foi desativada.");
            return;
        }

        beginHandshake();
    }

    function handleDisconnected() {
        resetSession();
    }

    function initCrypto() {
        if (initialized) return;
        initialized = true;

        rawSendPeerPacket = window.sendPeerPacket;

        if (typeof rawSendPeerPacket !== "function") {
            warn("sendPeerPacket ainda não está disponível.");
            return;
        }

        exposeState();
        window.sendPeerPacket = secureSendPeerPacket;

        window.addEventListener("qrtalk:packet", handleCryptoPacket);
        window.addEventListener("qrtalk:connected", handleConnected);
        window.addEventListener("qrtalk:disconnected", handleDisconnected);
        window.addEventListener("qrtalk:session-ended", handleDisconnected);

        if (!state.supported) {
            warn("Web Crypto não está disponível; os pacotes seguirão sem a camada adicional.");
        } else {
            log("Camada criptográfica iniciada.");
        }
    }

    window.initCrypto = initCrypto;
    window.getQRTalkSecurityState = () => ({
        supported: state.supported,
        ready: state.ready,
        securityCode: state.securityCode,
        remoteReady: state.remoteReady
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCrypto);
    } else {
        initCrypto();
    }
})();
