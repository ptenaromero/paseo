
(() => {
    function supported() {
        return ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window);
    }

    function normalize(t) {
        return (t || "").replace(/\s+/g, " ").trim();
    }

    // Troceo para evitar textos muy largos (más estable en móvil)
    function splitForTTS(text, maxLen = 180) {
        const t = normalize(text);
        if (!t) return [];
        const sentences = t.split(/(?<=[.!?])\s+/);
        const out = [];
        for (const s of sentences) {
        if (s.length <= maxLen) out.push(s);
        else for (let i = 0; i < s.length; i += maxLen) out.push(s.slice(i, i + maxLen));
        }
        return out.filter(Boolean);
    }

    function stop() {
        if (supported()) window.speechSynthesis.cancel();
    }

    function pickSpanishVoice() {
        const voices = window.speechSynthesis.getVoices?.() || [];
        return voices.find(v => (v.lang || "").toLowerCase().startsWith("es")) || null;
    }

    function extractText(root) {
        const clone = root.cloneNode(true);

        // Quita cosas que ensucian lectura
        clone.querySelectorAll(
        "script,style,noscript,nav,header,figure,footer,button,input,select,textarea,iframe"
        ).forEach(n => n.remove());

        //excluye lo marcado
        clone.querySelectorAll('[data-tts="exclude"]').forEach(n => n.remove());

        return normalize(clone.innerText || clone.textContent || "");
    }

    function setBtn(btn, isSpeaking) {
        btn.textContent = isSpeaking ? "Parar" : "Escuchar";
        btn.setAttribute("aria-pressed", isSpeaking ? "true" : "false");
    }

    window.initParadaTTS = function initParadaTTS({
        buttonSelector = "#btn-tts",
        contentSelector = "#contenido-parada",
        lang = "es-ES",
        rate = 1
    } = {}) {
        const btn = document.querySelector(buttonSelector);
        const root = document.querySelector(contentSelector);
        if (!btn || !root) return;

        if (!supported()) {
        btn.remove();
        return;
        }

        
        window.speechSynthesis.addEventListener?.("voiceschanged", () => { /* no-op */ });

        let speaking = false;

        btn.addEventListener("click", () => {
        // toggle
        if (speaking || window.speechSynthesis.speaking) {
            stop();
            speaking = false;
            setBtn(btn, false);
            return;
        }

        const text = extractText(root);
        if (!text) return;

        stop();
        speaking = true;
        setBtn(btn, true);

        const voice = pickSpanishVoice();
        const parts = splitForTTS(text);

        parts.forEach((part, i) => {
            const u = new SpeechSynthesisUtterance(part);
            u.lang = lang;
            u.rate = rate;
            if (voice) u.voice = voice;

            if (i === parts.length - 1) {
            u.onend = () => { speaking = false; setBtn(btn, false); };
            u.onerror = () => { speaking = false; setBtn(btn, false); };
            }
            window.speechSynthesis.speak(u);
        });
        });

        window.addEventListener("pagehide", stop);
        setBtn(btn, false);
    };
})();
