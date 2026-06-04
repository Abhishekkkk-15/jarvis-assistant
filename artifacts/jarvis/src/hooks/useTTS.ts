import { useState, useEffect, useRef, useCallback } from "react";

export interface TTSOptions {
  rate?: number;   // 0.1–10, default 1
  pitch?: number;  // 0–2, default 1
  volume?: number; // 0–1, default 1
  voice?: SpeechSynthesisVoice | null;
}

// Strip animation tags like [anim: excited] before speaking
function stripAnimTags(text: string): string {
  return text
    .replace(/\[anim:\s*\w+\]\s*/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")  // strip markdown bold
    .replace(/\*(.*?)\*/g, "$1")      // strip markdown italic
    .replace(/#{1,6}\s/g, "")         // strip headings
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // strip inline code
    .trim();
}

export function useTTS() {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("jarvis_tts_enabled") === "true";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem("jarvis_tts_rate") || "1.0");
  });
  const [pitch, setPitch] = useState<number>(() => {
    return parseFloat(localStorage.getItem("jarvis_tts_pitch") || "1.0");
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Try to pick a good default: prefer en-US Microsoft voices (Windows quality), then any English
      const savedVoiceName = localStorage.getItem("jarvis_tts_voice");
      if (savedVoiceName) {
        const saved = availableVoices.find(v => v.name === savedVoiceName);
        if (saved) { setSelectedVoice(saved); return; }
      }

      const microsoftVoice = availableVoices.find(v =>
        v.name.includes("Microsoft") && v.lang.startsWith("en")
      );
      const englishVoice = availableVoices.find(v => v.lang.startsWith("en"));
      setSelectedVoice(microsoftVoice || englishVoice || availableVoices[0] || null);
    };

    loadVoices();
    // Voices load async in some browsers
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, options?: TTSOptions) => {
    if (!isEnabled || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const cleanText = stripAnimTags(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options?.rate ?? rate;
    utterance.pitch = options?.pitch ?? pitch;
    utterance.volume = options?.volume ?? 1.0;
    utterance.voice = options?.voice ?? selectedVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isEnabled, rate, pitch, selectedVoice]);

  const toggleEnabled = useCallback((val?: boolean) => {
    const next = val !== undefined ? val : !isEnabled;
    if (!next) stop();
    setIsEnabled(next);
    localStorage.setItem("jarvis_tts_enabled", String(next));
  }, [isEnabled, stop]);

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

  return {
    speak,
    stop,
    isSpeaking,
    isEnabled,
    toggleEnabled,
    voices,
    selectedVoice,
    updateVoice,
    rate,
    updateRate,
    pitch,
    updatePitch,
  };
}
