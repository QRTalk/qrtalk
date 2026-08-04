/*
==================================================
QRTalk 3.0
UI
==================================================
*/

"use strict";

/*
==================================================
ABRIR CHAT
==================================================
*/

function showChat(){

    QRTalk.elements.setupScreen.classList.add("hidden");

    QRTalk.elements.chatScreen.classList.remove("hidden");

}

/*
==================================================
VOLTAR PARA O INÍCIO
==================================================
*/

function showSetup(){

    QRTalk.elements.chatScreen.classList.add("hidden");

    QRTalk.elements.setupScreen.classList.remove("hidden");

}

/*
==================================================
STATUS
==================================================
*/

function setStatus(text){

    const el = document.getElementById("chat-status");

    if(el){

        el.innerText = text;

    }

}

/*
==================================================
STATUS DA TELA INICIAL
==================================================
*/

function setSetupStatus(text){

    QRTalk.elements.statusLabel.innerText = text;

}

/*
==================================================
SCROLL
==================================================
*/

function scrollBottom(){

    const area = QRTalk.elements.messages;

    area.scrollTop = area.scrollHeight;

}

/*
==================================================
HORA
==================================================
*/

function currentTime(){

    return new Date().toLocaleTimeString("pt-BR",{

        hour:"2-digit",

        minute:"2-digit"

    });

}

/*
==================================================
CRIAR BALÃO
==================================================
*/

function createBubble(content,side){

    const msg=document.createElement("div");

    msg.className="message "+side;

    const bubble=document.createElement("div");

    bubble.className="bubble";

    const text=document.createElement("div");

    text.className="message-text";

    text.innerText=content;

    bubble.appendChild(text);

    const footer=document.createElement("div");

    footer.className="message-footer";

    const hour=document.createElement("span");

    hour.className="message-time";

    hour.innerText=currentTime();

    footer.appendChild(hour);

    if(side==="sent"){

        const status=document.createElement("span");

        status.className="message-status status-sent";

        status.innerHTML="✓";

        footer.appendChild(status);

    }

    bubble.appendChild(footer);

    msg.appendChild(bubble);

    return msg;

}

/*
==================================================
ADICIONAR TEXTO
==================================================
*/

function addTextMessage(text,side){

    const bubble=createBubble(text,side);

    QRTalk.elements.messages.appendChild(bubble);

    scrollBottom();

}

/*
==================================================
MENSAGEM DO SISTEMA
==================================================
*/

function addSystemMessage(text){

    const div=document.createElement("div");

    div.className="system-message";

    div.innerText=text;

    QRTalk.elements.messages.appendChild(div);

    scrollBottom();

}

/*
==================================================
ONLINE
==================================================
*/

function setOnline(){

    document
        .getElementById("status-dot")
        .className="status-dot online";

    setStatus("Online");

}

/*
==================================================
OFFLINE
==================================================
*/

function setOffline(){

    document
        .getElementById("status-dot")
        .className="status-dot offline";

    setStatus("Offline");

}

/*
==================================================
DIGITANDO
==================================================
*/

function showTyping(){

    QRTalk.elements.typing.classList.remove("hidden");

}

function hideTyping(){

    QRTalk.elements.typing.classList.add("hidden");

}

/*
==================================================
NOTIFICAÇÃO
==================================================
*/

function toast(text){

    console.log(text);

}

/*
==================================================
BOTÃO ENVIAR
==================================================
*/

QRTalk.elementsReady=function(){

    const e=QRTalk.elements;

    e.sendBtn.addEventListener("click",()=>{

        sendCurrentMessage();

    });

    e.input.addEventListener("keydown",(ev)=>{

        if(ev.key==="Enter"){

            sendCurrentMessage();

        }

    });

}

/*
==================================================
INICIALIZA UI
==================================================
*/

function initUI(){

    QRTalk.elementsReady();

}