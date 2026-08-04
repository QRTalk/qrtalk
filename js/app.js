/*
==================================================
QRTalk 3.0
Arquivo principal e controle da viewport móvel
==================================================
*/

"use strict";

/*
==================================================
OBJETO GLOBAL
==================================================
*/

window.QRTalk = {

    version: "3.0.0",

    peer: null,

    conn: null,

    roomId: null,

    connected: false,

    leaving: false,

    typing: false,

    unread: 0,

    lastTyping: 0,

    heartbeat: null,

    elements: {},

    viewport: {

        height: 0,

        maximumHeight: 0,

        keyboardOpen: false,

        animationFrame: null

    }

};

/*
==================================================
ATALHO PARA ELEMENTOS
==================================================
*/

function $(id) {

    return document.getElementById(id);

}

/*
==================================================
CARREGAR ELEMENTOS
==================================================
*/

function loadElements() {

    QRTalk.elements = {

        setupScreen:
            $("setup-screen"),

        chatScreen:
            $("chat-screen"),

        qrcode:
            $("qrcode-container"),

        statusLabel:
            $("status-label"),

        copyBtn:
            $("copy-btn"),

        messages:
            $("chat-messages"),

        input:
            $("message-input"),

        sendBtn:
            $("send-btn"),

        emojiBtn:
            $("emoji-btn"),

        emojiPanel:
            $("emoji-panel"),

        typing:
            $("typing-indicator"),

        restartBtn:
            $("restart-btn"),

        nudgeBtn:
            $("nudge-btn"),

        imageInput:
            $("image-input"),

        fileInput:
            $("file-input"),

        cameraInput:
            $("camera-input"),

        videoInput:
            $("video-input"),

        audioBtn:
            $("audio-btn"),

        previewArea:
            $("preview-area")

    };

}

/*
==================================================
ROLAR PARA A ÚLTIMA MENSAGEM
==================================================
*/

function scrollChatAfterResize() {

    const messages =
        QRTalk.elements.messages;

    if (!messages) {
        return;
    }

    window.requestAnimationFrame(() => {

        messages.scrollTop =
            messages.scrollHeight;

    });

}

/*
==================================================
CALCULAR ALTURA VISÍVEL
==================================================
*/

function getVisibleViewportHeight() {

    if (
        window.visualViewport &&
        Number.isFinite(
            window.visualViewport.height
        )
    ) {

        return Math.round(
            window.visualViewport.height
        );

    }

    return Math.round(
        window.innerHeight
    );

}

/*
==================================================
ATUALIZAR VIEWPORT
==================================================
*/

function updateAppViewport() {

    if (
        QRTalk.viewport.animationFrame
    ) {

        window.cancelAnimationFrame(
            QRTalk.viewport.animationFrame
        );

    }

    QRTalk.viewport.animationFrame =
        window.requestAnimationFrame(() => {

            const height =
                getVisibleViewportHeight();

            if (!height) {
                return;
            }

            QRTalk.viewport.height =
                height;

            const inputFocused =
                document.activeElement ===
                QRTalk.elements.input;

            /*
            Só atualiza a altura máxima quando o
            teclado provavelmente não está aberto.
            */

            if (
                !inputFocused ||
                height >
                QRTalk.viewport.maximumHeight
            ) {

                QRTalk.viewport.maximumHeight =
                    Math.max(
                        QRTalk.viewport
                            .maximumHeight,
                        height
                    );

            }

            const heightDifference =
                QRTalk.viewport.maximumHeight -
                height;

            const keyboardOpen =
                inputFocused &&
                heightDifference > 100;

            QRTalk.viewport.keyboardOpen =
                keyboardOpen;

            document.documentElement
                .style
                .setProperty(
                    "--app-height",
                    `${height}px`
                );

            document.documentElement
                .classList
                .toggle(
                    "keyboard-open",
                    keyboardOpen
                );

            /*
            Como a página exterior está travada,
            garantimos que ela permaneça no topo.
            */

            window.scrollTo(0, 0);

            if (inputFocused) {

                scrollChatAfterResize();

            }

            QRTalk.viewport.animationFrame =
                null;

        });

}

/*
==================================================
PROGRAMAR ATUALIZAÇÃO
==================================================
*/

function scheduleViewportUpdate() {

    updateAppViewport();

    /*
    Alguns celulares terminam a animação do
    teclado alguns milissegundos depois.
    */

    window.setTimeout(
        updateAppViewport,
        60
    );

    window.setTimeout(
        updateAppViewport,
        250
    );

}

/*
==================================================
CAMPO RECEBEU FOCO
==================================================
*/

function handleInputFocus() {

    scheduleViewportUpdate();

    window.setTimeout(() => {

        scrollChatAfterResize();

    }, 300);

}

/*
==================================================
CAMPO PERDEU FOCO
==================================================
*/

function handleInputBlur() {

    document.documentElement
        .classList
        .remove(
            "keyboard-open"
        );

    QRTalk.viewport.keyboardOpen =
        false;

    scheduleViewportUpdate();

}

/*
==================================================
MUDANÇA DE ORIENTAÇÃO
==================================================
*/

function handleOrientationChange() {

    QRTalk.viewport.maximumHeight = 0;

    window.setTimeout(
        scheduleViewportUpdate,
        100
    );

    window.setTimeout(
        scheduleViewportUpdate,
        500
    );

}

/*
==================================================
INICIALIZAR CONTROLE DA VIEWPORT
==================================================
*/

function initViewport() {

    updateAppViewport();

    window.addEventListener(
        "resize",
        scheduleViewportUpdate,
        {
            passive: true
        }
    );

    window.addEventListener(
        "orientationchange",
        handleOrientationChange,
        {
            passive: true
        }
    );

    if (window.visualViewport) {

        window.visualViewport
            .addEventListener(
                "resize",
                scheduleViewportUpdate,
                {
                    passive: true
                }
            );

        window.visualViewport
            .addEventListener(
                "scroll",
                scheduleViewportUpdate,
                {
                    passive: true
                }
            );

    }

    QRTalk.elements.input
        ?.addEventListener(
            "focus",
            handleInputFocus
        );

    QRTalk.elements.input
        ?.addEventListener(
            "blur",
            handleInputBlur
        );

}

/*
==================================================
INICIALIZAÇÃO
==================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadElements();

        initViewport();

        initNotifications();

        initPeer();

        initUI();

        console.log(
            "QRTalk",
            QRTalk.version,
            "iniciado."
        );

    }
);
