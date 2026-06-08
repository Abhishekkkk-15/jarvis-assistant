import { useEffect, useState, useRef } from 'react';
import { useLocalStorage } from './use-local-storage';

export type TimePhase = 'Night' | 'Morning' | 'Lunch' | 'Afternoon' | 'Evening';

export function useRoutineEngine() {
  const [phase, setPhase] = useState<TimePhase>('Afternoon');
  const [testHour, setTestHour] = useState<number | null>(null);
  
  // Track the last day we dispatched a specific routine message to avoid spamming
  const [lastRoutineSpokenDate, setLastRoutineSpokenDate] = useLocalStorage<Record<string, string>>('jarvisRoutineHistory', {});
  const dispatchHistoryRef = useRef<Record<string, string>>(lastRoutineSpokenDate);

  useEffect(() => {
    dispatchHistoryRef.current = lastRoutineSpokenDate;
  }, [lastRoutineSpokenDate]);

  useEffect(() => {
    const checkRoutine = () => {
      const now = new Date();
      const hour = testHour !== null ? testHour : now.getHours();
      const dateString = now.toDateString();

      let currentPhase: TimePhase = 'Afternoon';
      let routineMessage = '';
      let routineKey = '';

      if (hour >= 1 && hour < 6) {
        currentPhase = 'Night'; // 1 AM to 5:59 AM
        routineKey = 'night';
      } else if (hour >= 6 && hour < 12) {
        currentPhase = 'Morning'; // 6 AM to 11:59 AM
        routineKey = 'morning';
        routineMessage = "Good morning! Let's get to work.";
      } else if (hour >= 12 && hour < 13) {
        currentPhase = 'Lunch'; // 12 PM to 12:59 PM
        routineKey = 'lunch';
        routineMessage = "It's lunch time! Make sure you take a break and eat something.";
      } else if (hour >= 13 && hour < 18) {
        currentPhase = 'Afternoon'; // 1 PM to 5:59 PM
        routineKey = 'afternoon';
      } else {
        currentPhase = 'Evening'; // 6 PM to 12:59 AM
        routineKey = 'evening';
        if (hour === 23) {
          routineMessage = "It's getting pretty late. We should wrap up soon!";
        }
      }

      setPhase(currentPhase);

      // Trigger autonomous speech if we have a message and haven't said it today
      if (routineMessage && dispatchHistoryRef.current[routineKey] !== dateString) {
        // Dispatch the speech event
        window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: routineMessage } }));
        
        // Save to history
        const newHistory = { ...dispatchHistoryRef.current, [routineKey]: dateString };
        setLastRoutineSpokenDate(newHistory);
      }
    };

    // Check immediately and then every minute
    checkRoutine();
    const interval = setInterval(checkRoutine, 60000);

    // Expose a test function to force a specific hour
    (window as any).testTime = (hour: number) => {
      console.log(`Setting Jarvis clock to ${hour}:00`);
      setTestHour(hour);
    };

    (window as any).clearRoutineHistory = () => {
      console.log('Cleared routine history');
      setLastRoutineSpokenDate({});
    };

    return () => clearInterval(interval);
  }, [testHour, setLastRoutineSpokenDate]);

  return {
    phase,
    testHour
  };
}
