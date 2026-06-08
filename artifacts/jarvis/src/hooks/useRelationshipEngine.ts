import { useEffect, useState } from 'react';
import { useLocalStorage } from './use-local-storage';

export type Mood = 'Neglected' | 'Neutral' | 'Friendly' | 'Best Friends';

export function useRelationshipEngine() {
  const [affectionScore, setAffectionScore] = useLocalStorage<number>('jarvisAffectionScore', 50);
  const [lastInteractedAt, setLastInteractedAt] = useLocalStorage<number>('jarvisLastInteractedAt', Date.now());
  const [mood, setMood] = useState<Mood>('Neutral');

  useEffect(() => {
    // Calculate mood based on affection score and time elapsed
    const now = Date.now();
    const hoursSinceLastInteraction = (now - lastInteractedAt) / (1000 * 60 * 60);

    let currentMood: Mood = 'Neutral';

    if (hoursSinceLastInteraction > 24) {
      currentMood = 'Neglected';
      // Passively degrade affection if neglected
      if (hoursSinceLastInteraction > 48 && affectionScore > 20) {
        setAffectionScore((prev) => Math.max(20, prev - 5));
        setLastInteractedAt(now); // reset timer so it doesn't drop to 0 instantly
      }
    } else {
      if (affectionScore < 40) currentMood = 'Neutral';
      else if (affectionScore < 75) currentMood = 'Friendly';
      else currentMood = 'Best Friends';
    }

    setMood(currentMood);
  }, [affectionScore, lastInteractedAt]);

  const interact = (boost: number = 1) => {
    setLastInteractedAt(Date.now());
    setAffectionScore((prev) => Math.min(100, prev + boost));
  };

  const setNeglectedForTesting = () => {
    setLastInteractedAt(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
  };

  return {
    affectionScore,
    mood,
    interact,
    setNeglectedForTesting
  };
}
