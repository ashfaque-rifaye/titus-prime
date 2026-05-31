import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Loader2, Volume2, AudioLines, MicOff } from "lucide-react";

/**
 * Voice Assistant — a Wispr-Flow-style bottom-right widget.
 *
 * Pipeline (zero backend dependency for I/O):
 *   1. STT  : browser-native SpeechRecognition (Chrome/Edge). No gateway needed.
 *   2. Chat : POST /api/voice/chat → grounded Gemini/Codex answer.
 *   3. TTS  : browser-native speechSynthesis (with optional gateway upgrade).
 *
 * Press-and-hold the orb (or tap to toggle) to talk. Interim transcript shows
 * live; the reply appears as text AND is spoken. Everything is cleaned up on
 * unmount so nothing fires after the widget closes.
 */

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "unsupported";

// Minimal typing for the vendor-prefixed Web Speech API.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SpeechRecognitionLike = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

export function VoiceAssistant() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const finalTextRef = useRef("");

  // Detect support once on mount.
  useEffect(() => {
    mountedRef.current = true;
    if (!getRecognition()) setState("unsupported");
    return () => {
      mountedRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
      abortRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, v: T) => {
    if (mountedRef.current) setter(v);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      safeSet(setState, "speaking");

      // Try the gateway TTS first (only if it actually responds with audio).
      try {
        abortRef.current = new AbortController();
        const ttsRes = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abortRef.current.signal,
        });
        if (ttsRes.ok && ttsRes.headers.get("content-type")?.includes("audio")) {
          const blob = await ttsRes.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => {
            URL.revokeObjectURL(url);
            safeSet(setState, "idle");
          };
          await audio.play();
          return;
        }
        throw new Error("no gateway audio");
      } catch {
        // Native browser TTS — always available, zero config.
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 1.04;
          utter.pitch = 1;
          utter.onend = () => safeSet(setState, "idle");
          utter.onerror = () => safeSet(setState, "idle");
          window.speechSynthesis.speak(utter);
        } else {
          safeSet(setState, "idle");
        }
      }
    },
    [safeSet],
  );

  const ask = useCallback(
    async (text: string) => {
      safeSet(setState, "processing");
      try {
        abortRef.current = new AbortController();
        const res = await fetch("/api/voice/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abortRef.current.signal,
        });
        const data = await res.json().catch(() => ({ text: "" }));
        const reply: string = data.text || "I couldn't reach the financial core just now.";
        safeSet(setResponse, reply);
        await speak(reply);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        safeSet(setResponse, "Something went wrong reaching the core.");
        safeSet(setState, "idle");
      }
    },
    [safeSet, speak],
  );

  const startListening = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      setState("unsupported");
      return;
    }
    recRef.current = rec;
    finalTextRef.current = "";
    setTranscript("");
    setResponse("");

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      if (final) finalTextRef.current += final;
      safeSet(setTranscript, (finalTextRef.current + interim).trim());
    };
    rec.onerror = () => {
      safeSet(setState, "idle");
    };
    rec.onend = () => {
      const text = finalTextRef.current.trim();
      if (text) ask(text);
      else safeSet(setState, "idle");
    };

    try {
      rec.start();
      setState("listening");
    } catch {
      setState("idle");
    }
  }, [ask, safeSet]);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const onOrbClick = useCallback(() => {
    if (state === "idle") startListening();
    else if (state === "listening") stopListening();
    else if (state === "speaking") {
      // Tap again to silence + reset.
      abortRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setState("idle");
    }
  }, [state, startListening, stopListening]);

  if (state === "unsupported") return null; // graceful: no widget on unsupported browsers

  const showBubble = (transcript || response) && state !== "idle";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="max-w-sm rounded-2xl border border-border bg-surface/95 backdrop-blur-xl p-4 shadow-2xl"
          >
            {transcript && (
              <div className="mb-2">
                <div className="text-[10px] mono uppercase tracking-wider text-muted-foreground mb-1">
                  You
                </div>
                <div className="text-sm text-foreground">{transcript}</div>
              </div>
            )}
            {response && (
              <div>
                <div className="text-[10px] mono uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                  <AudioLines className="h-3 w-3" /> Titus-Prime
                </div>
                <div className="text-sm text-foreground/90">{response}</div>
              </div>
            )}
            {state === "processing" && !response && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onOrbClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Voice assistant"
        title={
          state === "listening"
            ? "Listening — tap to stop"
            : state === "idle"
              ? "Tap to talk"
              : state
        }
        className="relative grid h-16 w-16 place-items-center rounded-full shadow-2xl"
        style={{
          background:
            state === "listening"
              ? "radial-gradient(circle, rgba(244,63,94,0.35), rgba(244,63,94,0.1))"
              : state === "processing"
                ? "radial-gradient(circle, rgba(245,158,11,0.35), rgba(245,158,11,0.1))"
                : state === "speaking"
                  ? "radial-gradient(circle, rgba(163,230,53,0.35), rgba(163,230,53,0.1))"
                  : "radial-gradient(circle, rgba(163,230,53,0.22), rgba(20,23,20,0.85))",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {state === "listening" && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(244,63,94,0.5)" }}
            animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Mic className="h-6 w-6 text-primary" />
            </motion.div>
          )}
          {state === "listening" && (
            <motion.div
              key="listening"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AudioLines className="h-6 w-6 text-rose-400" />
            </motion.div>
          )}
          {state === "processing" && (
            <motion.div
              key="proc"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
            </motion.div>
          )}
          {state === "speaking" && (
            <motion.div
              key="speak"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Volume2 className="h-6 w-6 text-primary" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
