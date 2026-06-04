import { useState, useEffect, useRef, useCallback } from 'react';
import type { CharacterAnimation } from '../components/characters/CharacterRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// Sentiment → Animation mapper
// Analyzes JARVIS reply text and returns the best emotion animation
// ─────────────────────────────────────────────────────────────────────────────

const EMOTION_PATTERNS: Array<{ keywords: string[]; animation: CharacterAnimation }> = [
  // Positive / celebrations
  { keywords: ['done', 'complete', 'finished', 'success', 'accomplished', 'achieved', 'great', '✅', '🎉'], animation: 'excited' },
  { keywords: ['hello', 'hi there', 'hey', 'greetings', 'good morning', 'good evening', 'welcome'], animation: 'wave' },
  { keywords: ['haha', 'lol', 'funny', 'hilarious', '😄', '😂', 'joke', 'humor'], animation: 'laughing' },
  { keywords: ['love', 'care', 'here for you', 'always got you', '❤️', '💕', 'adore'], animation: 'love' },
  { keywords: ['happy', 'wonderful', 'amazing', 'fantastic', 'awesome', 'excellent', '😊', 'glad', 'pleasure'], animation: 'happy' },
  { keywords: ['cool', 'stylish', 'sleek', 'smooth', 'on it', 'got it', 'roger'], animation: 'cool' },

  // Thinking / Processing
  { keywords: ['let me think', 'hmm', 'analyzing', 'processing', 'calculating', 'figuring', 'working on', 'looking into', 'searching'], animation: 'thinking' },
  { keywords: ['not sure', "don't know", 'unclear', 'ambiguous', 'confused', 'uncertain', '?', 'which one', 'what do you mean'], animation: 'confused' },

  // Negative / Errors
  { keywords: ['sorry', 'apologize', 'my bad', 'error', 'failed', 'unfortunately', 'issue', 'problem', "can't"], animation: 'sad' },
  { keywords: ['warning', 'danger', 'careful', 'caution', 'alert', '⚠️', 'important', 'critical'], animation: 'scared' },
  { keywords: ['stop', 'no!', 'denied', 'blocked', 'refused', 'rejected'], animation: 'angry' },

  // Surprise / Discovery
  { keywords: ['found it', 'discovered', 'wow', 'whoa', 'oh!', '!', 'incredible', 'unbelievable'], animation: 'surprised' },

  // Actions
  { keywords: ['running', 'executing', 'launching', 'starting', 'opening', 'let me do that'], animation: 'dash' },
  { keywords: ['dancing', 'music', 'party', '🎵', '🎶', 'beats'], animation: 'dance' },
];

export function detectEmotionFromText(text: string): CharacterAnimation | null {
  const lower = text.toLowerCase();
  for (const { keywords, animation } of EMOTION_PATTERNS) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return animation;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-awareness — what JARVIS should be doing at this time of day
// ─────────────────────────────────────────────────────────────────────────────

export function getTimeBasedMood(): CharacterAnimation {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return 'sleep';       // Midnight–6am: sleeping
  if (hour >= 6 && hour < 9) return 'bored';        // Early morning: sluggish
  if (hour >= 9 && hour < 12) return 'happy';       // Morning: energetic
  if (hour >= 12 && hour < 14) return 'idle';       // Noon: chill
  if (hour >= 14 && hour < 18) return 'idle';       // Afternoon: normal
  if (hour >= 18 && hour < 21) return 'happy';      // Evening: relaxed/happy
  if (hour >= 21 && hour < 23) return 'bored';      // Late: tired
  return 'sleep';                                    // Very late: asleep
}

// ─────────────────────────────────────────────────────────────────────────────
// Microexpressions — random idle behaviors that make character feel alive
// ─────────────────────────────────────────────────────────────────────────────

const MICROEXPRESSIONS: CharacterAnimation[] = [
  'thinking', 'thinking',  // Most common — lost in thought
  'bored',                  // A little bored
  'shy',                    // Bashful moment
  'confused',               // Brief confusion
  'happy',                  // Quick smile
  'wave',                   // Spontaneous wave
  'surprised',              // Surprised at nothing
  'cool',                   // Acting cool
];

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterPersonalityState {
  emotionAnimation: CharacterAnimation | null;  // Current emotion override
  isBlinking: boolean;                          // Whether eyes are closed
  moodLabel: string;                            // Human-readable mood for display
  triggerEmotion: (text: string) => void;       // Call with JARVIS reply text
  triggerDirectEmotion: (anim: CharacterAnimation, durationMs?: number) => void;
}

export function useCharacterPersonality(): CharacterPersonalityState {
  const [emotionAnimation, setEmotionAnimation] = useState<CharacterAnimation | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [moodLabel, setMoodLabel] = useState('idle');
  
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const microTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Eye Blinking ──────────────────────────────────────────────────────────
  // Schedules the next blink at a random human-like interval (2-6 seconds)
  const scheduleBlink = useCallback(() => {
    const nextBlink = 2000 + Math.random() * 4000; // 2–6 seconds
    blinkTimerRef.current = setTimeout(() => {
      setIsBlinking(true);
      // Eyes closed for 80-150ms
      setTimeout(() => {
        setIsBlinking(false);
        // Occasionally double-blink
        if (Math.random() < 0.2) {
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => {
              setIsBlinking(false);
              scheduleBlink();
            }, 100);
          }, 200);
        } else {
          scheduleBlink();
        }
      }, 80 + Math.random() * 70);
    }, nextBlink);
  }, []);

  // Start blinking loop
  useEffect(() => {
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [scheduleBlink]);

  // ── Time-Aware Initial Mood ───────────────────────────────────────────────
  useEffect(() => {
    const timeMood = getTimeBasedMood();
    setMoodLabel(timeMood);
    // Only set emotion if it's something interesting (not just idle)
    if (timeMood !== 'idle') {
      setEmotionAnimation(timeMood);
      // Show time-based mood for 5 seconds then return to idle
      const t = setTimeout(() => setEmotionAnimation(null), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  // ── Random Microexpressions ───────────────────────────────────────────────
  // Every 15-45 seconds, briefly show a random microexpression for 2-3 sec
  useEffect(() => {
    const scheduleNextMicro = () => {
      const delay = 15000 + Math.random() * 30000;
      microTimerRef.current = setTimeout(() => {
        // Only trigger if there's no active emotion
        if (!emotionAnimation) {
          const expr = MICROEXPRESSIONS[Math.floor(Math.random() * MICROEXPRESSIONS.length)];
          setEmotionAnimation(expr);
          setMoodLabel(expr);
          setTimeout(() => {
            setEmotionAnimation(null);
            setMoodLabel('idle');
            scheduleNextMicro();
          }, 2000 + Math.random() * 1500);
        } else {
          scheduleNextMicro();
        }
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };
    scheduleNextMicro();
    return () => { if (microTimerRef.current) clearTimeout(microTimerRef.current as unknown as ReturnType<typeof setTimeout>); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Emotion Trigger (from JARVIS reply text) ──────────────────────────────
  const triggerEmotion = useCallback((text: string) => {
    const emotion = detectEmotionFromText(text);
    if (!emotion) return;

    if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    setEmotionAnimation(emotion);
    setMoodLabel(emotion);

    // Hold for 4–6 seconds then return to idle
    emotionTimerRef.current = setTimeout(() => {
      setEmotionAnimation(null);
      setMoodLabel('idle');
    }, 4000 + Math.random() * 2000);
  }, []);

  // ── Direct Emotion Trigger ────────────────────────────────────────────────
  const triggerDirectEmotion = useCallback((anim: CharacterAnimation, durationMs = 4000) => {
    if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    setEmotionAnimation(anim);
    setMoodLabel(anim);
    emotionTimerRef.current = setTimeout(() => {
      setEmotionAnimation(null);
      setMoodLabel('idle');
    }, durationMs);
  }, []);

  return { emotionAnimation, isBlinking, moodLabel, triggerEmotion, triggerDirectEmotion };
}
