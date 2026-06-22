import React, { useState, useEffect } from 'react';
import { JarvisBot } from './characters/CharacterRenderer';

export function BootSequence() {
  const [slow, setSlow] = useState(false);
  const [statusText, setStatusText] = useState('Connecting to system core…');

  useEffect(() => {
    const t1 = setTimeout(() => setStatusText('Synchronizing components…'), 2500);
    const t2 = setTimeout(() => setStatusText('Initializing agent matrix…'), 5500);
    const tSlow = setTimeout(() => setSlow(true), 12000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tSlow);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground select-none">
      {/* Background glow behind character */}
      <div className="absolute w-72 h-72 rounded-full bg-primary/5 blur-[80px] pointer-events-none" />

      {/* Main Character with loading animation */}
      <div className="relative mb-6 animate-bounce" style={{ animationDuration: '2.5s' }}>
        <JarvisBot animation="excited" size={120} />
      </div>

      {/* Modern minimal loading status */}
      <div className="flex flex-col items-center gap-2 max-w-xs text-center">
        <p className="text-sm font-medium tracking-wide text-primary animate-pulse">
          {statusText}
        </p>

        {slow && (
          <p className="text-xs text-amber-500/80 animate-fade-in px-4">
            Connection is taking longer than usual. Hang tight.
          </p>
        )}
      </div>
    </div>
  );
}
