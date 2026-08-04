/*
==================================================
QRTalk 3.0
Arquivo principal
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

    elements: {}

};

/*
==================================================
ATALHOS DOM
==================================================
*/

function $(id){

    return document.getElementById(id);

}

/*
==================================================
CARREGA ELEMENTOS
==================================================
*/

function loadElements(){

    QRTalk.elements = {

        setupScreen: $("setup-screen"),

        chatScreen: $("chat-screen"),

        qrcode: $("qrcode-container"),

        statusLabel: $("status-label"),

        copyBtn: $("copy-btn"),

        messages: $("chat-messages"),

        input: $("message-input"),

        sendBtn: $("send-btn"),

        emojiBtn: $("emoji-btn"),

        emojiPanel: $("emoji-panel"),

        typing: $("typing-indicator"),

        restartBtn: $("restart-btn"),

        nudgeBtn: $("nudge-btn"),

        imageInput: $("image-input"),

        fileInput: $("file-input"),

        cameraInput: $("camera-input"),

        audioBtn: $("audio-btn")

    };

}

/*
==================================================
INICIALIZAÇÃO
==================================================
*/

document.addEventListener("DOMContentLoaded", ()=>{

    loadElements();

    initNotifications();

    initPeer();

    initUI();

    console.log(

        "QRTalk",

        QRTalk.version,

        "iniciado."

    );

});