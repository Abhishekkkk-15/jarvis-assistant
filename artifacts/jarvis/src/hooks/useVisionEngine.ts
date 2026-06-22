import { useEffect, useRef } from 'react';
import { useLocalStorage } from './use-local-storage';
import { toast } from '@/hooks/use-toast';

export function useVisionEngine() {
  const [autonomousMode] = useLocalStorage('jarvisAutonomousMode', false);
  const [persona] = useLocalStorage('jarvisPersona', 'Friendly');
  const lastTitleRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autonomousMode) return;

    const handleWindowChanged = (e: any) => {
      const { winInfo } = e.detail;
      if (!winInfo || !winInfo.title) return;

      // Store globally for Option A
      (window as any).lastActiveWindow = winInfo;

      // Option B: Debounced Proactive LLM Comments
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if ((window as any).lastActiveWindow !== winInfo) return;
        try {
          const response = await fetch('http://localhost:4444/api/autonomous', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: `The user has been working in the application "${winInfo.owner?.name || 'Unknown'}" with window title "${winInfo.title || ''}" for over 30 seconds. Make a brief, highly contextual comment, tip, or witty remark in character. Do not repeat generic greetings.`,
              persona: persona
            })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.message) {
              window.dispatchEvent(new CustomEvent('jarvis-autonomous-speech', {
                detail: { text: data.message }
              }));
            }
          }
        } catch (err) {
          console.error("Failed to generate proactive comment:", err);
        }
      }, 30000); // 30 seconds focused activity
    };

    window.addEventListener('active-window-changed', handleWindowChanged);

    return () => {
      window.removeEventListener('active-window-changed', handleWindowChanged);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [autonomousMode, persona]);
}
