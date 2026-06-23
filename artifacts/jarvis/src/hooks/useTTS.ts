import { useState, useEffect, useRef, useCallback } from "react";
import { useSynthesizeSpeech } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TTSEngine = "browser" | "orpheus" | "custom";

// Correct voices for playai-tts / canopylabs orpheus-v1-english via Groq
export const ORPHEUS_VOICES = [
  { id: "autumn", label: "Autumn (female)", gender: "Female" },
  { id: "diana", label: "Diana (female)", gender: "Female" },
  { id: "hannah", label: "Hannah (female)", gender: "Female" },
  { id: "austin", label: "Austin (male)", gender: "Male" },
  { id: "daniel", label: "Daniel (male)", gender: "Male" },
  { id: "troy", label: "Troy (male)", gender: "Male" },
] as const;

export type OrpheusVoiceId = typeof ORPHEUS_VOICES[number]["id"];

// Direction tags that can be injected before the text to steer tone/style.
// The model recognises natural descriptors in square brackets.
export const ORPHEUS_DIRECTIONS = {
  none: "",
  // Conversational
  cheerful: "[cheerful]",
  friendly: "[friendly]",
  casual: "[casual]",
  warm: "[warm]",
  // Professional
  professionally: "[professionally]",
  authoritatively: "[authoritatively]",
  formally: "[formally]",
  confidently: "[confidently]",
  // Expressive
  whisper: "[whisper]",
  excited: "[excited]",
  dramatic: "[dramatic]",
  deadpan: "[deadpan]",
  sarcastic: "[sarcastic]",
  // Vocal qualities
  "gravelly whisper": "[gravelly whisper]",
  "rapid babbling": "[rapid babbling]",
  singsong: "[singsong]",
  breathy: "[breathy]",
} as const;

export type OrpheusDirection = keyof typeof ORPHEUS_DIRECTIONS;

/** Hard limit from Groq TTS API — split above this many words */
const ORPHEUS_WORD_LIMIT = 175; // keep below 200 for safety margin

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripAnimTags(text: string): string {
  return text
    .replace(/\[\s*\w+\s*:\s*[^\]]+\]\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .trim();
}

function ls(key: string, def: string) {
  return localStorage.getItem(key) ?? def;
}

/**
 * Split text into chunks of at most `maxWords` words, breaking on sentence
 * boundaries where possible so speech sounds natural.
 */
function chunkText(text: string, maxWords: number): string[] {
  // First split on sentence-ending punctuation
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const sentence of sentences) {
    const wordsInSentence = sentence.trim().split(/\s+/).length;

    if (wordCount + wordsInSentence > maxWords && current.trim()) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = wordsInSentence;
    } else {
      current += (current ? " " : "") + sentence.trim();
      wordCount += wordsInSentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTTS() {
  // ── Shared state
  const [isEnabled, setIsEnabled] = useState<boolean>(
    () => ls("jarvis_tts_enabled", "false") === "true"
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Broadcast speaking state via the same key/event useLocalStorage consumers use, so the
  // global wake-word listener (which checks 'jarvisIsSpeaking') knows TTS is playing no matter
  // which page/component instance of useTTS() triggered it (e.g. Settings' "Test Voice").
  useEffect(() => {
    try {
      localStorage.setItem("jarvisIsSpeaking", JSON.stringify(isSpeaking));
      window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: "jarvisIsSpeaking", value: isSpeaking } }));
    } catch { }
  }, [isSpeaking]);

  // ── Engine selection
  const [engine, setEngine] = useState<TTSEngine>(
    () => (ls("jarvis_tts_engine", "browser") as TTSEngine)
  );

  // ── Browser TTS
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState<number>(() => parseFloat(ls("jarvis_tts_rate", "1.0")));
  const [pitch, setPitch] = useState<number>(() => parseFloat(ls("jarvis_tts_pitch", "1.0")));
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Orpheus state
  const [orpheusVoice, setOrpheusVoice] = useState<OrpheusVoiceId>(
    () => (ls("jarvis_orpheus_voice", "autumn") as OrpheusVoiceId)
  );
  const [orpheusDirection, setOrpheusDirection] = useState<OrpheusDirection>(
    () => (ls("jarvis_orpheus_direction", "none") as OrpheusDirection)
  );

  // ── Custom WAV state
  const [customWavPath, setCustomWavPath] = useState<string>(
    () => ls("jarvis_tts_custom_wav", "")
  );

  // ── Backend TTS mutation
  const synthMutation = useSynthesizeSpeech();

  // ── Audio ref for Orpheus / custom WAV playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track whether stop() was called so we don't keep playing chunks
  const stoppedRef = useRef(false);

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
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── Play a single audio blob
  const playBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }, []);

  // ── Speak a single chunk via backend → Groq Orpheus
  const speakChunk = useCallback(async (chunk: string): Promise<boolean> => {
    try {
      const directionTag = ORPHEUS_DIRECTIONS[orpheusDirection];
      // Directions are prepended to each chunk so they stay in effect
      const inputText = directionTag ? `${directionTag} ${chunk}` : chunk;

      const blob = await synthMutation.mutateAsync({
        data: { text: inputText, voice: orpheusVoice, model: "canopylabs/orpheus-v1-english" },
      });

      if (!blob || blob.size === 0) {
        console.warn("[TTS] Orpheus returned empty audio for chunk:", chunk.slice(0, 50));
        return false;
      }

      await playBlob(blob);
      return true;
    } catch (e: any) {
      console.error("[TTS] Orpheus chunk failed:", e);
      return false;
    }
  }, [orpheusVoice, orpheusDirection, synthMutation, playBlob]);

  // ── Speak via Orpheus — handles chunking automatically
  const speakOrpheus = useCallback(async (text: string): Promise<boolean> => {
    stop();
    stoppedRef.current = false;
    setIsSpeaking(true);

    try {
      const chunks = chunkText(text, ORPHEUS_WORD_LIMIT);
      console.log(`[TTS] Orpheus: ${chunks.length} chunk(s) for ${text.split(/\s+/).length} words`);

      for (const chunk of chunks) {
        if (stoppedRef.current) break; // user cancelled mid-playback
        const ok = await speakChunk(chunk);
        if (!ok) {
          setIsSpeaking(false);
          return false;
        }
      }

      setIsSpeaking(false);
      return true;
    } catch (e) {
      console.error("[TTS] Orpheus failed:", e);
      setIsSpeaking(false);
      return false;
    }
  }, [stop, speakChunk]);

  // ── Speak via custom WAV file
  const speakCustomWav = useCallback(async (): Promise<boolean> => {
    if (!customWavPath) return false;
    try {
      stop();
      stoppedRef.current = false;
      setIsSpeaking(true);
      const url = customWavPath.startsWith("http") ? customWavPath : `file://${customWavPath}`;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
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
    utterance.rate = options?.rate ?? rate;
    utterance.pitch = options?.pitch ?? pitch;
    utterance.volume = options?.volume ?? 1.0;
    utterance.voice = options?.voice ?? selectedVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [rate, pitch, selectedVoice]);

  // ── Main speak dispatcher
  const speak = useCallback(async (text: string, options?: TTSOptions) => {
    if (!isEnabled || !text.trim()) return;
    const cleanText = stripAnimTags(text);
    if (!cleanText) return;

    if (engine === "orpheus") {
      const ok = await speakOrpheus(cleanText);
      if (!ok) speakBrowser(cleanText, options); // graceful fallback
    } else if (engine === "custom") {
      const ok = await speakCustomWav();
      if (!ok) speakBrowser(cleanText, options);
    } else {
      speakBrowser(cleanText, options);
    }
  }, [isEnabled, engine, speakOrpheus, speakBrowser, speakCustomWav]);

  // ── Persist helpers
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

  const updateOrpheusDirection = useCallback((d: OrpheusDirection) => {
    setOrpheusDirection(d);
    localStorage.setItem("jarvis_orpheus_direction", d);
  }, []);

  const updateCustomWavPath = useCallback((path: string) => {
    setCustomWavPath(path);
    localStorage.setItem("jarvis_tts_custom_wav", path);
  }, []);

  return {
    speak, stop, isSpeaking, isEnabled, toggleEnabled,
    engine, updateEngine,
    voices, selectedVoice, updateVoice,
    rate, updateRate,
    pitch, updatePitch,
    orpheusVoice, updateOrpheusVoice,
    orpheusDirection, updateOrpheusDirection,
    customWavPath, updateCustomWavPath,
  };
}
