import { useEffect, useRef } from 'react';
import { useLocalStorage } from './use-local-storage';
import { toast } from '@/hooks/use-toast';

export function useVisionEngine() {
  const lastTitleRef = useRef('');

  useEffect(() => {
    const handleWindowChanged = (e: any) => {
      const { winInfo } = e.detail;
      if (!winInfo || !winInfo.title) return;

      const title = winInfo.title.toLowerCase();
      const owner = winInfo.owner ? winInfo.owner.name.toLowerCase() : '';

      let reactionText = '';
      let reactionAnim = '';

      if (title.includes('youtube') || title.includes('netflix') || title.includes('hulu')) {
        reactionText = "Ooh, what are we watching?";
        reactionAnim = "happy";
      } else if (title.includes('visual studio code') || title.includes('cursor') || owner.includes('code') || title.includes('intellij')) {
        reactionText = "Time to write some code! Let's crush some bugs.";
        reactionAnim = "thinking";
      } else if (title.includes('discord') || title.includes('slack') || title.includes('teams') || title.includes('telegram')) {
        reactionText = "Who are we talking to?";
        reactionAnim = "cool";
      } else if (title.includes('settings') || title.includes('control panel')) {
        reactionText = "Ah, looking under the hood?";
        reactionAnim = "sneak";
      } else if (title.includes('github') || title.includes('gitlab')) {
        reactionText = "Time to push some commits!";
        reactionAnim = "excited";
      } else if (title.includes('spotify') || title.includes('music') || title.includes('apple music')) {
        reactionText = "Ooh, put on some good tunes!";
        reactionAnim = "dance";
      } else if (title.includes('reddit') || title.includes('twitter') || title.includes('x.com')) {
        reactionText = "Scrolling the timeline, huh?";
        reactionAnim = "bored";
      } else if (title.includes('gmail') || title.includes('outlook') || title.includes('mail')) {
        reactionText = "Checking emails? Sounds like work.";
        reactionAnim = "idle";
      } else if (owner.includes('chrome') || owner.includes('edge') || owner.includes('firefox') || owner.includes('brave') || owner.includes('arc')) {
        reactionText = "Browsing the web, I see.";
        reactionAnim = "idle";
      } else {
        // Generic fallback for any other app
        const appName = winInfo.owner?.name || "this app";
        reactionText = `What are we doing in ${appName}?`;
        reactionAnim = "thinking";
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
  }, []);
}
