import { useEffect, useRef } from 'react';
import { useLocalStorage } from './use-local-storage';

export function useAutonomousAgent() {
  const [autonomousMode] = useLocalStorage('jarvisAutonomousMode', false);
  const [persona] = useLocalStorage('jarvisPersona', 'Friendly');
  const [isProcessing] = useLocalStorage('jarvisIsProcessing', false);
  const [isListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  
  const lastInteractionRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update last interaction time when user does things
  useEffect(() => {
    if (isListening || isProcessing || isSpeaking) {
      lastInteractionRef.current = Date.now();
    }
  }, [isListening, isProcessing, isSpeaking]);

  useEffect(() => {
    const handleUserActivity = () => {
      lastInteractionRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, []);

  useEffect(() => {
    if (!autonomousMode) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Every 30 seconds, consider making an autonomous decision
    timerRef.current = setInterval(async () => {
      // Don't interrupt if Jarvis is busy
      if (isProcessing || isListening || isSpeaking) return;

      const idleTimeSeconds = (Date.now() - lastInteractionRef.current) / 1000;
      
      // We only poll the AI if we've been idle for at least 15 seconds, to prevent spam
      if (idleTimeSeconds < 15) return;

      // Add a bit of randomness so it doesn't always trigger exactly on the dot
      if (Math.random() > 0.4) return; // 40% chance to act on each 30s tick

      const hour = new Date().getHours();
      let timeOfDay = 'daytime';
      if (hour < 6 || hour >= 22) timeOfDay = 'late night';
      else if (hour < 12) timeOfDay = 'morning';
      else if (hour > 18) timeOfDay = 'evening';

      const context = `
      User Idle Time: ${Math.floor(idleTimeSeconds)} seconds.
      Time of Day: ${timeOfDay}
      `;

      try {
        const response = await fetch('/api/autonomous', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context, persona })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.message) {
            window.dispatchEvent(new CustomEvent('jarvis-autonomous-speech', { 
              detail: { text: data.message } 
            }));
          } else if (data.action && data.action !== 'idle') {
            window.dispatchEvent(new CustomEvent('jarvis-action', { 
              detail: { action: data.action } 
            }));
          }
        }
      } catch (err) {
        console.error("Autonomous AI tick failed", err);
      }
    }, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autonomousMode, isProcessing, isListening, isSpeaking]);
}
