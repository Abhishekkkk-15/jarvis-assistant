import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TTSEngine = "browser" | "orpheus" | "custom";

// Voices supported by Orpheus / canopylabs model via Groq
export const ORPHEUS_VOICES = [
  { id: "tara",   label: "Tara (warm, female)"     },
  { id: "leah",   label: "Leah (clear, female)"    },
  { id: "jess",   label: "Jess (upbeat, female)"   },
  { id: "leo",    label: "Leo (smooth, male)"       },
  { id: "dan",    label: "Dan (deep, male)"         },
  { id: "mia",    label: "Mia (soft, female)"       },
  { id: "zac",    label: "Zac (energetic, male)"    },
  { id: "zoe",    label: "Zoe (calm, female)"       },
] as const;

export type OrpheusVoiceId = typeof ORPHEUS_VOICES[number]["id"];

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripAnimTags(text: string): string {
  return text
    .replace(/\[anim:\s*\w+\]\s*/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .trim();
}

function ls(key: string, def: string) {
  return localStorage.getItem(key) ?? def;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/** Pass groqApiKey (from settings) to enable the Orpheus engine. */
export function useTTS(groqApiKey?: string | null) {
  // ── Shared state
  const [isEnabled, setIsEnabled] = useState<boolean>(
    () => ls("jarvis_tts_enabled", "false") === "true"
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── Engine selection
  const [engine, setEngine] = useState<TTSEngine>(
    () => (ls("jarvis_tts_engine", "browser") as TTSEngine)
  );

  // ── Browser TTS state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState<number>(() => parseFloat(ls("jarvis_tts_rate", "1.0")));
  const [pitch, setPitch] = useState<number>(() => parseFloat(ls("jarvis_tts_pitch", "1.0")));
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Orpheus state
  const [orpheusVoice, setOrpheusVoice] = useState<OrpheusVoiceId>(
    () => (ls("jarvis_orpheus_voice", "tara") as OrpheusVoiceId)
  );

  // ── Custom WAV state
  const [customWavPath, setCustomWavPath] = useState<string>(
    () => ls("jarvis_tts_custom_wav", "")
  );

  // ── Abort controller for Orpheus fetch
  const orpheusAbortRef = useRef<AbortController | null>(null);
  const orpheusAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Load browser voices
  useEffect(() => {
    const load = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      const savedName = ls("jarvis_tts_voice", "");
      if (savedName) {
        const saved = available.find(v => v.name === savedName);
        if (saved) { setSelectedVoice(saved); return; }
      }
      const ms = available.find(v => v.name.includes("Microsoft") && v.lang.startsWith("en"));
      const en = available.find(v => v.lang.startsWith("en"));
      setSelectedVoice(ms || en || available[0] || null);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Stop all engines
  const stop = useCallback(() => {
    // Browser
    window.speechSynthesis.cancel();
    // Orpheus
    if (orpheusAbortRef.current) { orpheusAbortRef.current.abort(); orpheusAbortRef.current = null; }
    if (orpheusAudioRef.current) {
      orpheusAudioRef.current.pause();
      orpheusAudioRef.current.src = "";
      orpheusAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── Speak via Orpheus (Groq endpoint)
  const speakOrpheus = useCallback(async (text: string) => {
    if (!groqApiKey) {
      console.warn("[TTS] Orpheus: no Groq API key provided, falling back to browser TTS");
      return false; // caller will fall back
    }

    stop();

    const ctrl = new AbortController();
    orpheusAbortRef.current = ctrl;
    setIsSpeaking(true);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "playai-tts",          // Groq's TTS model (Orpheus-compatible endpoint)
          input: text,
          voice: orpheusVoice,
          response_format: "wav",
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[TTS] Orpheus API error:", res.status, err);
        setIsSpeaking(false);
        return false;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      orpheusAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        orpheusAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        orpheusAudioRef.current = null;
      };

      await audio.play();
      return true;
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("[TTS] Orpheus fetch failed:", e);
      }
      setIsSpeaking(false);
      return false;
    }
  }, [orpheusVoice, stop]);

  // ── Speak via custom WAV (plays the file on loop or once)
  const speakCustomWav = useCallback(async () => {
    if (!customWavPath) return false;

    stop();
    setIsSpeaking(true);

    try {
      // In Electron the file:// protocol works directly
      const url = customWavPath.startsWith("http") ? customWavPath : `file://${customWavPath}`;
      const audio = new Audio(url);
      orpheusAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        orpheusAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        orpheusAudioRef.current = null;
      };
      await audio.play();
      return true;
    } catch (e) {
      console.error("[TTS] Custom WAV playback failed:", e);
      setIsSpeaking(false);
      return false;
    }
  }, [customWavPath, stop]);

  // ── Speak via browser Web Speech API
  const speakBrowser = useCallback((text: string, options?: TTSOptions) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = options?.rate   ?? rate;
    utterance.pitch  = options?.pitch  ?? pitch;
    utterance.volume = options?.volume ?? 1.0;
    utterance.voice  = options?.voice  ?? selectedVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [rate, pitch, selectedVoice]);

  // ── Main speak: dispatches to selected engine
  const speak = useCallback(async (text: string, options?: TTSOptions) => {
    if (!isEnabled || !text.trim()) return;
    const cleanText = stripAnimTags(text);
    if (!cleanText) return;

    if (engine === "orpheus") {
      const ok = await speakOrpheus(cleanText);
      if (!ok) speakBrowser(cleanText, options); // graceful fallback
    } else if (engine === "custom") {
      const ok = await speakCustomWav();
      if (!ok) speakBrowser(cleanText, options); // graceful fallback
    } else {
      speakBrowser(cleanText, options);
    }
  }, [isEnabled, engine, speakOrpheus, speakBrowser, speakCustomWav]);

  // ── Persist settings helpers
  const toggleEnabled = useCallback((val?: boolean) => {
    const next = val !== undefined ? val : !isEnabled;
    if (!next) stop();
    setIsEnabled(next);
    localStorage.setItem("jarvis_tts_enabled", String(next));
  }, [isEnabled, stop]);

  const updateEngine = useCallback((e: TTSEngine) => {
    setEngine(e);
    localStorage.setItem("jarvis_tts_engine", e);
  }, []);

  const updateRate = useCallback((val: number) => {
    setRate(val);
    localStorage.setItem("jarvis_tts_rate", String(val));
  }, []);

  const updatePitch = useCallback((val: number) => {
    setPitch(val);
    localStorage.setItem("jarvis_tts_pitch", String(val));
  }, []);

  const updateVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    localStorage.setItem("jarvis_tts_voice", voice.name);
  }, []);

  const updateOrpheusVoice = useCallback((v: OrpheusVoiceId) => {
    setOrpheusVoice(v);
    localStorage.setItem("jarvis_orpheus_voice", v);
  }, []);

  const updateCustomWavPath = useCallback((path: string) => {
    setCustomWavPath(path);
    localStorage.setItem("jarvis_tts_custom_wav", path);
  }, []);

  return {
    // Core
    speak, stop, isSpeaking, isEnabled, toggleEnabled,
    // Engine
    engine, updateEngine,
    // Browser TTS
    voices, selectedVoice, updateVoice,
    rate, updateRate,
    pitch, updatePitch,
    // Orpheus
    orpheusVoice, updateOrpheusVoice,
    // Custom WAV
    customWavPath, updateCustomWavPath,
  };
}
