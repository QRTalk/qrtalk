/*
==================================================
QRTalk 3.1
Política local de conteúdo e alerta de dados sensíveis
==================================================
*/

"use strict";

(() => {
    const TYPES = Object.freeze({
        WARNING: "policy:warning",
        CLOSED: "policy:session-closed"
    });

    const state = {
        initialized: false,
        localViolations: 0,
        remoteViolations: 0,
        bypassOnce: false,
        originalSendCurrentMessage: null,
        closeScheduled: false
    };

    let ui = null;

    const LEET_MAP = Object.freeze({
        "@": "a",
        "4": "a",
        "3": "e",
        "1": "i",
        "!": "i",
        "0": "o",
        "5": "s",
        "$": "s",
        "7": "t"
    });

    function policyConfig() {
        return window.QRTalkSafetyConfig?.policy || {
            maxViolations: 2,
            romanticPhrases: [],
            affectionTerms: [],
            directAddressTerms: [],
            intimatePhrases: [],
            intimateTerms: [],
            highRiskPhrases: []
        };
    }

    function stripAccents(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function normalizeText(value) {
        let text = stripAccents(value).toLowerCase();

        text = text.replace(/[@431!05$7]/g, (character) => {
            return LEET_MAP[character] || character;
        });

        text = text.replace(/([a-z])\1{2,}/g, "$1$1");
        text = text.replace(/[^a-z0-9]+/g, " ");
        text = text.trim().replace(/\s+/g, " ");

        return {
            spaced: text,
            padded: ` ${text} `,
            compact: text.replace(/\s+/g, ""),
            tokens: text ? text.split(" ") : []
        };
    }

    function normalizeDictionary(values) {
        return (values || []).map((value) => normalizeText(value).spaced).filter(Boolean);
    }

    function containsNormalizedPhrase(normalized, phrase) {
        if (!phrase) return false;

        if (normalized.padded.includes(` ${phrase} `)) return true;

        /*
        Detecta tentativas simples de separar uma expressão com pontos,
        espaços ou símbolos. Para reduzir falsos positivos, essa forma
        compacta só é usada em expressões com pelo menos seis letras.
        */
        const compactPhrase = phrase.replace(/\s+/g, "");
        return compactPhrase.length >= 6 && normalized.compact.includes(compactPhrase);
    }

    function findPhraseMatches(normalized, phrases) {
        return phrases.filter((phrase) => containsNormalizedPhrase(normalized, phrase));
    }

    function hasToken(normalized, term) {
        const normalizedTerm = normalizeText(term).spaced;
        if (!normalizedTerm || normalizedTerm.includes(" ")) {
            return containsNormalizedPhrase(normalized, normalizedTerm);
        }

        if (normalized.tokens.includes(normalizedTerm)) return true;

        /* Detecta formas como l.i.n.d.a ou n u d e sem procurar
        o termo dentro de palavras maiores. */
        if (normalizedTerm.length >= 4) {
            const spacedLetters = normalizedTerm
                .split("")
                .map((letter) => letter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join("\\s*");

            return new RegExp(`(?:^|\\s)${spacedLetters}(?:\\s|$)`).test(normalized.spaced);
        }

        return false;
    }

    function isAdministrativeSexContext(normalized) {
        return /\bsexo\s*(masculino|feminino|m|f|outro|nao informado)\b/.test(normalized.spaced) ||
            /\b(campo|informar|selecione|preencha)\s+(o\s+)?sexo\b/.test(normalized.spaced) ||
            /\bsexo\s+do\s+(requerente|titular|cliente|paciente|aluno)\b/.test(normalized.spaced);
    }

    function analyzeProhibitedContent(text) {
        const cfg = policyConfig();
        const normalized = normalizeText(text);

        if (!normalized.spaced) {
            return {
                blocked: false,
                category: null,
                score: 0,
                matches: []
            };
        }

        const highRisk = findPhraseMatches(
            normalized,
            normalizeDictionary(cfg.highRiskPhrases)
        );

        if (highRisk.length) {
            return {
                blocked: true,
                category: "conteúdo de alto risco",
                score: 100,
                matches: highRisk
            };
        }

        const intimatePhrases = findPhraseMatches(
            normalized,
            normalizeDictionary(cfg.intimatePhrases)
        );

        if (intimatePhrases.length) {
            return {
                blocked: true,
                category: "conteúdo íntimo ou sexualizado",
                score: 90,
                matches: intimatePhrases
            };
        }

        const romanticPhrases = findPhraseMatches(
            normalized,
            normalizeDictionary(cfg.romanticPhrases)
        );

        if (romanticPhrases.length) {
            return {
                blocked: true,
                category: "conversa afetiva ou de relacionamento",
                score: 80,
                matches: romanticPhrases
            };
        }

        const intimateTerms = (cfg.intimateTerms || []).filter((term) => {
            if (normalizeText(term).spaced === "sexo" && isAdministrativeSexContext(normalized)) {
                return false;
            }
            return hasToken(normalized, term);
        });

        if (intimateTerms.length) {
            return {
                blocked: true,
                category: "termo íntimo ou sexualizado",
                score: 70,
                matches: intimateTerms
            };
        }

        const affectionHits = (cfg.affectionTerms || []).filter((term) => {
            return hasToken(normalized, term);
        });

        const directAddressHits = (cfg.directAddressTerms || []).filter((term) => {
            return containsNormalizedPhrase(normalized, normalizeText(term).spaced);
        });

        const strongerAffectionTerms = new Set([
            "amorzinho",
            "amorzao",
            "mozao",
            "mozinho",
            "mozinha",
            "benzinho",
            "gatinha",
            "gatinho",
            "gostosa",
            "gostoso",
            "delicia",
            "namoradinha",
            "namoradinho",
            "crush",
            "apaixonado",
            "apaixonada"
        ]);

        const hasStrongAffection = affectionHits.some((term) => {
            return strongerAffectionTerms.has(normalizeText(term).spaced);
        });

        const directRomanticStructure = /\b(voce|vc|tu)\s+(e|eh|esta|ta)\s+(linda|lindo|gostosa|gostoso|gata|gato|fofinha|fofinho)\b/.test(normalized.spaced) ||
            /\b(meu|minha)\s+(amor|vida|lindo|linda|princesa|principe|bebe|nenem)\b/.test(normalized.spaced) ||
            /\b(oi|ola|bom dia|boa tarde|boa noite)\s+(amor|linda|lindo|gata|gato|princesa|principe)\b/.test(normalized.spaced);

        if (
            directRomanticStructure ||
            (hasStrongAffection && directAddressHits.length > 0) ||
            affectionHits.length >= 2
        ) {
            return {
                blocked: true,
                category: "linguagem de carinho ou paquera",
                score: 60,
                matches: affectionHits
            };
        }

        return {
            blocked: false,
            category: null,
            score: 0,
            matches: []
        };
    }

    function validateCpf(value) {
        const digits = String(value).replace(/\D/g, "");
        if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

        const calculateDigit = (length) => {
            let sum = 0;
            for (let index = 0; index < length; index += 1) {
                sum += Number(digits[index]) * (length + 1 - index);
            }
            const remainder = (sum * 10) % 11;
            return remainder === 10 ? 0 : remainder;
        };

        return calculateDigit(9) === Number(digits[9]) &&
            calculateDigit(10) === Number(digits[10]);
    }

    function passesLuhn(value) {
        const digits = String(value).replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;

        let sum = 0;
        let doubleDigit = false;

        for (let index = digits.length - 1; index >= 0; index -= 1) {
            let digit = Number(digits[index]);
            if (doubleDigit) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            doubleDigit = !doubleDigit;
        }

        return sum % 10 === 0;
    }

    function analyzeSensitiveData(text) {
        const raw = String(text || "");
        const normalized = stripAccents(raw).toLowerCase();
        const categories = new Set();

        if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw)) {
            categories.add("e-mail");
        }

        const cpfMatches = raw.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || [];
        if (cpfMatches.some(validateCpf)) {
            categories.add("CPF");
        }

        const phoneMatches = raw.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-.\s]?\d{4}/g) || [];
        if (phoneMatches.some((value) => {
            const digits = value.replace(/\D/g, "");
            return digits.length >= 10 && digits.length <= 13 && !validateCpf(digits.slice(-11));
        })) {
            categories.add("telefone");
        }

        const numericCandidates = raw.match(/(?:\d[ -]?){13,19}/g) || [];
        if (numericCandidates.some(passesLuhn)) {
            categories.add("cartão bancário");
        }

        if (/\b(?:https?:\/\/|www\.)\S+/i.test(raw)) {
            categories.add("link");
        }

        if (/\b(?:instagram|facebook|telegram|tiktok|snapchat|linkedin)\b|@[a-z0-9._]{3,}/i.test(normalized)) {
            categories.add("rede social ou usuário");
        }

        if (/\b(?:rua|avenida|av\.?|travessa|alameda|rodovia|estrada|praca|praça)\b.{0,55}\b\d{1,6}\b/i.test(raw)) {
            categories.add("endereço");
        }

        if (/\b(?:senha|password|token|pin|codigo de acesso|codigo de verificacao|código de acesso|código de verificação)\b\s*[:=\-]?\s*[a-z0-9@#$%!*._-]{4,}/i.test(raw)) {
            categories.add("senha ou código de acesso");
        }

        if (/\b(?:agencia|agência)\b\s*[:=\-]?\s*\d{3,6}|\bconta\b\s*[:=\-]?\s*\d{3,15}/i.test(raw)) {
            categories.add("dados bancários");
        }

        return {
            sensitive: categories.size > 0,
            categories: Array.from(categories)
        };
    }

    function ensureUi() {
        if (ui) return ui;

        const overlay = document.createElement("div");
        overlay.id = "qrtalk-policy-overlay";
        overlay.className = "qrtalk-safety-overlay hidden";
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "qrtalk-policy-title");

        overlay.innerHTML = `
            <div class="qrtalk-safety-card qrtalk-safety-card--warning">
                <div class="qrtalk-safety-icon" id="qrtalk-policy-icon">⚠️</div>
                <h2 id="qrtalk-policy-title"></h2>
                <p id="qrtalk-policy-message"></p>
                <p id="qrtalk-policy-detail" class="qrtalk-safety-detail"></p>
                <div id="qrtalk-policy-actions" class="qrtalk-safety-actions"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        ui = {
            overlay,
            card: overlay.querySelector(".qrtalk-safety-card"),
            icon: overlay.querySelector("#qrtalk-policy-icon"),
            title: overlay.querySelector("#qrtalk-policy-title"),
            message: overlay.querySelector("#qrtalk-policy-message"),
            detail: overlay.querySelector("#qrtalk-policy-detail"),
            actions: overlay.querySelector("#qrtalk-policy-actions")
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
        elements.card.className = `qrtalk-safety-card qrtalk-safety-card--${options.kind || "warning"}`;
        elements.icon.textContent = options.icon || "⚠️";
        elements.title.textContent = options.title || "Aviso do QRTalk";
        elements.message.textContent = options.message || "";
        elements.detail.textContent = options.detail || "";
        elements.detail.classList.toggle("hidden", !options.detail);
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

    function getInput() {
        return document.getElementById("message-input");
    }

    function isAdmitted() {
        if (window.QRTalkAdmission?.isAdmitted) {
            return window.QRTalkAdmission.isAdmitted();
        }
        return true;
    }

    function disableComposer() {
        [
            "message-input",
            "send-btn",
            "emoji-btn",
            "camera-btn",
            "gallery-btn",
            "attach-btn",
            "audio-btn"
        ].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.disabled = true;
        });
    }

    function safeSend(packet) {
        if (typeof window.sendPeerPacket !== "function") return false;
        return window.sendPeerPacket(packet);
    }

    function closeConnectionSoon(delay = 650) {
        if (state.closeScheduled) return;
        state.closeScheduled = true;

        window.setTimeout(() => {
            try {
                if (typeof window.disconnectPeer === "function") {
                    window.disconnectPeer();
                    return;
                }
                window.QRTalk?.conn?.close?.();
            } catch (error) {
                console.warn("[QRTalk/Policy] Falha ao encerrar conexão:", error);
            }
        }, delay);
    }

    function showSessionClosed(message) {
        disableComposer();

        showDialog({
            kind: "danger",
            icon: "⛔",
            title: "Sessão encerrada",
            message: message || "A conversa foi encerrada por violação das regras de uso seguro do QRTalk.",
            detail: "O conteúdo bloqueado não foi enviado nem armazenado pelo QRTalk.",
            actions: []
        });
    }

    function closeSessionForPolicy(source) {
        if (state.closeScheduled) return;

        safeSend({
            type: TYPES.CLOSED,
            reason: "repeated-prohibited-content",
            source,
            createdAt: Date.now()
        });

        window.dispatchEvent(new CustomEvent("qrtalk:policy-closed", {
            detail: {
                source,
                createdAt: Date.now()
            }
        }));

        showSessionClosed();
        closeConnectionSoon();
    }

    function handleLocalViolation(analysis) {
        state.localViolations += 1;
        const cfg = policyConfig();

        if (state.localViolations >= cfg.maxViolations) {
            getInput().value = "";
            closeSessionForPolicy("local");
            return;
        }

        showDialog({
            kind: "warning",
            icon: "⚠️",
            title: "Mensagem não enviada",
            message: "O texto parece incompatível com a finalidade profissional e temporária do QRTalk.",
            detail: `Categoria identificada: ${analysis.category}. Revise a mensagem. Uma nova tentativa encerrará a sessão.`,
            actions: [
                {
                    label: "Entendi e vou revisar",
                    variant: "primary",
                    handler: () => {
                        hideDialog();
                        getInput()?.focus();
                    }
                }
            ]
        });
    }

    function callOriginalSend() {
        const original = state.originalSendCurrentMessage;
        if (typeof original !== "function") {
            window.toast?.("O envio de mensagens ainda não está disponível.", "warning");
            return false;
        }

        state.bypassOnce = true;
        try {
            return original();
        } finally {
            window.setTimeout(() => {
                state.bypassOnce = false;
            }, 0);
        }
    }

    function confirmSensitiveSend(sensitiveAnalysis) {
        const list = sensitiveAnalysis.categories.join(", ");

        showDialog({
            kind: "warning",
            icon: "🔎",
            title: "Possíveis dados sensíveis",
            message: "Esta mensagem parece conter informação pessoal ou confidencial.",
            detail: `Possíveis categorias: ${list}. Compartilhe somente se isso for necessário para o atendimento.`,
            actions: [
                {
                    label: "Revisar mensagem",
                    variant: "secondary",
                    handler: () => {
                        hideDialog();
                        getInput()?.focus();
                    }
                },
                {
                    label: "Enviar mesmo assim",
                    variant: "primary",
                    handler: () => {
                        hideDialog();
                        callOriginalSend();
                    }
                }
            ]
        });
    }

    function guardedSendCurrentMessage() {
        if (state.bypassOnce) return callOriginalSend();

        const input = getInput();
        const text = input?.value?.trim() || "";
        if (!text) return false;

        if (!isAdmitted()) {
            window.toast?.("Confirme a entrada na sala antes de enviar mensagens.", "warning");
            return false;
        }

        const prohibited = analyzeProhibitedContent(text);
        if (prohibited.blocked) {
            handleLocalViolation(prohibited);
            return false;
        }

        const sensitive = analyzeSensitiveData(text);
        if (sensitive.sensitive) {
            confirmSensitiveSend(sensitive);
            return false;
        }

        return callOriginalSend();
    }

    function installSendWrapper() {
        const current = window.sendCurrentMessage;
        if (
            typeof current === "function" &&
            current !== guardedSendCurrentMessage &&
            current !== state.originalSendCurrentMessage
        ) {
            state.originalSendCurrentMessage = current;
            window.sendCurrentMessage = guardedSendCurrentMessage;
        }
    }

    function handleSendClickCapture(event) {
        const button = event.target?.closest?.("#send-btn");
        if (!button) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        guardedSendCurrentMessage();
    }

    function handleEnterCapture(event) {
        if (event.target?.id !== "message-input") return;
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        guardedSendCurrentMessage();
    }

    function extractTextPacket(packet) {
        if (!packet || typeof packet !== "object") return null;

        if (packet.type === "text" && typeof packet.content === "string") {
            return packet.content;
        }

        if (packet.type !== "chat:message") return null;

        const messageType =
            packet.messageType ||
            packet.contentType ||
            packet.kind ||
            packet.payload?.type ||
            packet.message?.type ||
            "text";

        if (messageType !== "text") return null;

        const content =
            packet.content ??
            packet.text ??
            packet.payload?.content ??
            packet.payload?.text ??
            packet.message?.content ??
            packet.message?.text;

        return typeof content === "string" ? content : null;
    }

    function preventPacket(event) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
    }

    function handleRemoteProhibitedMessage(event, analysis) {
        preventPacket(event);
        state.remoteViolations += 1;

        const cfg = policyConfig();

        if (state.remoteViolations >= cfg.maxViolations) {
            closeSessionForPolicy("remote");
            return;
        }

        safeSend({
            type: TYPES.WARNING,
            reason: "prohibited-content",
            createdAt: Date.now()
        });

        window.toast?.("Uma mensagem incompatível com as regras foi bloqueada.", "warning");
        window.addSystemMessage?.("⚠️ Uma mensagem recebida foi bloqueada pelas regras de segurança.");
    }

    function handlePacket(event) {
        const packet = event.detail;
        if (!packet || typeof packet !== "object") return;

        if (packet.type === TYPES.WARNING) {
            preventPacket(event);
            state.localViolations = Math.max(state.localViolations, 1);

            showDialog({
                kind: "warning",
                icon: "⚠️",
                title: "Mensagem bloqueada pelo destinatário",
                message: "O outro aparelho identificou conteúdo incompatível com as regras do QRTalk.",
                detail: "Uma nova tentativa poderá encerrar a sessão.",
                actions: [
                    {
                        label: "Entendi",
                        variant: "primary",
                        handler: hideDialog
                    }
                ]
            });
            return;
        }

        if (packet.type === TYPES.CLOSED) {
            preventPacket(event);
            showSessionClosed("A sessão foi encerrada porque o limite de tentativas com conteúdo proibido foi atingido.");
            closeConnectionSoon();
            return;
        }

        const text = extractTextPacket(packet);
        if (!text) return;

        const analysis = analyzeProhibitedContent(text);
        if (analysis.blocked) {
            handleRemoteProhibitedMessage(event, analysis);
        }
    }

    function resetSession() {
        if (state.closeScheduled) return;

        state.localViolations = 0;
        state.remoteViolations = 0;
        hideDialog();
    }

    function initPolicy() {
        if (state.initialized) return;
        state.initialized = true;

        ensureUi();
        installSendWrapper();

        window.setTimeout(installSendWrapper, 0);
        window.setTimeout(installSendWrapper, 100);
        window.setTimeout(installSendWrapper, 500);

        window.addEventListener("qrtalk:connected", resetSession);
        window.addEventListener("qrtalk:session-ended", resetSession);
        window.addEventListener("qrtalk:disconnected", () => {
            state.originalSendCurrentMessage = state.originalSendCurrentMessage || window.sendCurrentMessage;
        });
    }

    /*
    Captura os gestos de envio antes dos listeners antigos. Isso mantém
    a proteção mesmo se ui.js tiver guardado uma referência direta para
    a função original de envio.
    */
    document.addEventListener("click", handleSendClickCapture, true);
    document.addEventListener("keydown", handleEnterCapture, true);
    document.addEventListener("keypress", handleEnterCapture, true);

    /*
    Este listener precisa ser registrado antes de chat.js. Assim uma
    mensagem recebida pode ser barrada antes de ser exibida na tela.
    */
    window.addEventListener("qrtalk:packet", handlePacket);

    window.QRTalkPolicy = {
        init: initPolicy,
        analyzeText: analyzeProhibitedContent,
        analyzeSensitiveData,
        getState: () => ({
            localViolations: state.localViolations,
            remoteViolations: state.remoteViolations,
            closed: state.closeScheduled
        })
    };

    window.initPolicy = initPolicy;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPolicy);
    } else {
        initPolicy();
    }
})();
