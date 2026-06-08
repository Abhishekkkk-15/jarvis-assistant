import { useEffect, useRef } from 'react';
import { useLocalStorage } from './use-local-storage';

export function useVisionEngine() {
  const [autonomousMode] = useLocalStorage('jarvisAutonomousMode', false);
  const lastTitleRef = useRef('');

  useEffect(() => {
    if (!autonomousMode) return;

    const handleWindowChanged = (e: any) => {
      const { winInfo } = e.detail;
      if (!winInfo || !winInfo.title) return;

      const title = winInfo.title.toLowerCase();
      const owner = winInfo.owner ? winInfo.owner.name.toLowerCase() : '';

      // Don't react if it's just the same window title again
      if (title === lastTitleRef.current) return;
      lastTitleRef.current = title;

      let reactionText = '';
      let reactionAnim = '';

      if (title.includes('youtube') || owner.includes('chrome') || owner.includes('edge')) {
        if (title.includes('youtube')) {
          reactionText = "Ooh, what are we watching?";
          reactionAnim = "happy";
        }
      } 
      
      if (title.includes('visual studio code') || title.includes('cursor') || owner.includes('code')) {
        reactionText = "Time to write some code! Let's crush some bugs.";
        reactionAnim = "thinking";
      }

      if (title.includes('discord')) {
        reactionText = "Who are we talking to?";
        reactionAnim = "cool";
      }

      if (title.includes('settings')) {
        reactionText = "Ah, looking under the hood?";
        reactionAnim = "sneak";
      }

      if (title.includes('github')) {
        reactionText = "Time to push some commits!";
        reactionAnim = "excited";
      }

      if (reactionText) {
        // Dispatch instant speech!
        window.dispatchEvent(new CustomEvent('jarvis-autonomous-speech', { 
          detail: { text: `${reactionText} [anim: ${reactionAnim}]` } 
        }));
      }
    };

    window.addEventListener('active-window-changed', handleWindowChanged);

    return () => {
      window.removeEventListener('active-window-changed', handleWindowChanged);
    };
  }, [autonomousMode]);
}
