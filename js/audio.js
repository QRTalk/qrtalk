/*
==================================================
QRTalk 3.0
Gravação de mensagens de áudio
==================================================
*/

"use strict";

(() => {
    const MAX_RECORDING_MS = 5 * 60 * 1000;
    const TIMER_INTERVAL = 250;

    let initialized = false;
    let mediaRecorder = null;
    let mediaStream = null;
    let chunks = [];
    let startedAt = 0;
    let timer = null;
    let autoStopTimer = null;
    let recordingPanel = null;
    let timeLabel = null;
    let levelBars = [];
    let audioContext = null;
    let analyser = null;
    let sourceNode = null;
    let animationFrame = null;
    let canceled = false;

    function log(...args) {
        console.log("[QRTalk/Audio]", ...args);
    }

    function warn(...args) {
        console.warn("[QRTalk/Audio]", ...args);
    }

    function ensureStyles() {
        if (document.getElementById("qrtalk-audio-styles")) return;

        const style = document.createElement("style");
        style.id = "qrtalk-audio-styles";
        style.textContent = `
            .audio-recording-panel {
                margin: 8px 12px;
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-radius: 16px;
                background: #1e293b;
                border: 1px solid rgba(255,255,255,.08);
            }

            .audio-recording-dot {
                width: 12px;
                height: 12px;
                flex: 0 0 12px;
                border-radius: 50%;
                background: #ef4444;
                animation: recordPulse 1s infinite;
            }

            .audio-recording-time {
                min-width: 48px;
                font-variant-numeric: tabular-nums;
                font-weight: 700;
            }

            .audio-levels {
                min-width: 0;
                height: 28px;
                flex: 1;
                display: flex;
                align-items: center;
                gap: 3px;
            }

            .audio-level-bar {
                width: 4px;
                height: 5px;
                border-radius: 999px;
                background: #60a5fa;
                transition: height .08s linear;
            }

            .audio-recording-action {
                width: 40px;
                height: 40px;
                flex: 0 0 40px;
                border: 0;
                border-radius: 50%;
                color: #fff;
                cursor: pointer;
            }

            .audio-recording-cancel { background: #475569; }
            .audio-recording-stop { background: #2563eb; }

            #audio-btn.recording {
                color: #fff;
                background: #ef4444;
            }
        `;
        document.head.appendChild(style);
    }

    function chooseMimeType() {
        const candidates = [
            "audio/webm;codecs=opus",
            "audio/ogg;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        return candidates.find((type) => {
            return typeof MediaRecorder !== "undefined" &&
                MediaRecorder.isTypeSupported?.(type);
        }) || "";
    }

    function formatDuration(milliseconds) {
        const seconds = Math.max(0, Math.floor(milliseconds / 1000));
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }

    function getPreviewArea() {
        return document.getElementById("preview-area");
    }

    function buildRecordingPanel() {
        const area = getPreviewArea();
        if (!area) return;

        area.innerHTML = "";
        area.classList.remove("hidden");

        recordingPanel = document.createElement("div");
        recordingPanel.className = "audio-recording-panel";

        const dot = document.createElement("div");
        dot.className = "audio-recording-dot";

        timeLabel = document.createElement("div");
        timeLabel.className = "audio-recording-time";
        timeLabel.textContent = "00:00";

        const levels = document.createElement("div");
        levels.className = "audio-levels";
        levelBars = [];

        for (let index = 0; index < 18; index += 1) {
            const bar = document.createElement("div");
            bar.className = "audio-level-bar";
            levels.appendChild(bar);
            levelBars.push(bar);
        }

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "audio-recording-action audio-recording-cancel";
        cancelButton.title = "Cancelar gravação";
        cancelButton.textContent = "✕";
        cancelButton.addEventListener("click", cancelRecording);

        const stopButton = document.createElement("button");
        stopButton.type = "button";
        stopButton.className = "audio-recording-action audio-recording-stop";
        stopButton.title = "Parar gravação";
        stopButton.textContent = "■";
        stopButton.addEventListener("click", stopRecording);

        recordingPanel.append(dot, timeLabel, levels, cancelButton, stopButton);
        area.appendChild(recordingPanel);
    }

    function clearRecordingPanel() {
        recordingPanel?.remove();
        recordingPanel = null;
        timeLabel = null;
        levelBars = [];

        const area = getPreviewArea();
        if (area && !area.children.length) area.classList.add("hidden");
    }

    function setAudioButtonState(recording) {
        const button = document.getElementById("audio-btn");
        if (!button) return;

        button.classList.toggle("recording", recording);
        button.textContent = recording ? "■" : "🎤";
        button.title = recording ? "Parar gravação" : "Gravar áudio";
    }

    function stopTracks() {
        mediaStream?.getTracks().forEach((track) => track.stop());
        mediaStream = null;
    }

    function stopTimers() {
        if (timer) window.clearInterval(timer);
        if (autoStopTimer) window.clearTimeout(autoStopTimer);
        timer = null;
        autoStopTimer = null;
    }

    function stopAudioVisualization() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = null;

        try {
            sourceNode?.disconnect();
            analyser?.disconnect();
        } catch (_) {
            // O nó já pode estar desconectado.
        }

        sourceNode = null;
        analyser = null;

        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
    }

    function updateTimer() {
        const elapsed = Date.now() - startedAt;
        if (timeLabel) timeLabel.textContent = formatDuration(elapsed);
    }

    function startAudioVisualization(stream) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        try {
            audioContext = new AudioContextClass();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.7;
            sourceNode = audioContext.createMediaStreamSource(stream);
            sourceNode.connect(analyser);

            const values = new Uint8Array(analyser.frequencyBinCount);

            const draw = () => {
                if (!analyser || !mediaRecorder || mediaRecorder.state !== "recording") return;

                analyser.getByteFrequencyData(values);
                levelBars.forEach((bar, index) => {
                    const value = values[index % values.length] || 0;
                    const height = 5 + Math.round((value / 255) * 23);
                    bar.style.height = `${height}px`;
                });

                animationFrame = requestAnimationFrame(draw);
            };

            draw();
        } catch (error) {
            warn("Não foi possível exibir o nível de áudio:", error);
        }
    }

    async function startRecording() {
        if (mediaRecorder?.state === "recording") return;

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            window.toast?.("Este navegador não oferece gravação de áudio.", "error");
            return;
        }

        try {
            canceled = false;
            chunks = [];
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                },
                video: false
            });

            const mimeType = chooseMimeType();
            mediaRecorder = mimeType
                ? new MediaRecorder(mediaStream, { mimeType, audioBitsPerSecond: 96000 })
                : new MediaRecorder(mediaStream);

            mediaRecorder.addEventListener("dataavailable", (event) => {
                if (event.data?.size) chunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", handleRecorderStopped, { once: true });
            mediaRecorder.addEventListener("error", (event) => {
                warn("Erro na gravação:", event.error || event);
                window.toast?.("A gravação de áudio falhou.", "error");
                cleanupRecording();
            });

            buildRecordingPanel();
            setAudioButtonState(true);
            startedAt = Date.now();
            updateTimer();
            timer = window.setInterval(updateTimer, TIMER_INTERVAL);
            autoStopTimer = window.setTimeout(stopRecording, MAX_RECORDING_MS);
            startAudioVisualization(mediaStream);

            mediaRecorder.start(250);
            window.dispatchEvent(new CustomEvent("qrtalk:audio-recording-start"));
        } catch (error) {
            warn("Microfone indisponível:", error);
            window.toast?.("Permita o acesso ao microfone para gravar áudio.", "error");
            cleanupRecording();
        }
    }

    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state !== "recording") return;
        mediaRecorder.stop();
    }

    function cancelRecording() {
        canceled = true;

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        } else {
            cleanupRecording();
        }
    }

    async function handleRecorderStopped() {
        const duration = Date.now() - startedAt;
        const recorderMime = mediaRecorder?.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type: recorderMime });

        stopTimers();
        stopAudioVisualization();
        stopTracks();
        setAudioButtonState(false);
        clearRecordingPanel();

        mediaRecorder = null;
        chunks = [];

        if (canceled) {
            canceled = false;
            window.toast?.("Gravação cancelada.", "warning");
            window.dispatchEvent(new CustomEvent("qrtalk:audio-recording-cancel"));
            return;
        }

        if (duration < 500 || blob.size < 500) {
            window.toast?.("O áudio ficou curto demais.", "warning");
            return;
        }

        const extension = recorderMime.includes("ogg")
            ? "ogg"
            : recorderMime.includes("mp4")
                ? "m4a"
                : "webm";

        const name = `qrtalk-audio-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.${extension}`;

        let file = blob;
        try {
            file = new File([blob], name, {
                type: recorderMime,
                lastModified: Date.now()
            });
        } catch (_) {
            file.name = name;
        }

        await window.prepareQRTalkFile?.(file, {
            name,
            mime: recorderMime,
            messageType: "audio",
            source: "microphone"
        });

        window.dispatchEvent(new CustomEvent("qrtalk:audio-recording-ready", {
            detail: { duration, size: blob.size }
        }));
    }

    function cleanupRecording() {
        stopTimers();
        stopAudioVisualization();
        stopTracks();
        setAudioButtonState(false);
        clearRecordingPanel();
        mediaRecorder = null;
        chunks = [];
        startedAt = 0;
    }

    function toggleRecording() {
        if (mediaRecorder?.state === "recording") {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function handleDisconnected() {
        if (mediaRecorder?.state === "recording") {
            canceled = true;
            mediaRecorder.stop();
        } else {
            cleanupRecording();
        }
    }

    function initAudio() {
        if (initialized) return;
        initialized = true;

        ensureStyles();
        document.getElementById("audio-btn")?.addEventListener("click", toggleRecording);
        window.addEventListener("qrtalk:disconnected", handleDisconnected);
        window.addEventListener("qrtalk:session-ended", handleDisconnected);
        window.addEventListener("pagehide", handleDisconnected);

        log("Gravador de áudio iniciado.");
    }

    window.initAudio = initAudio;
    window.startQRTalkRecording = startRecording;
    window.stopQRTalkRecording = stopRecording;
    window.cancelQRTalkRecording = cancelRecording;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAudio);
    } else {
        initAudio();
    }
})();
