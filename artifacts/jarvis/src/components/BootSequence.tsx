import React, { useState, useEffect, useRef } from 'react';

const BOOT_LINES = [
  { text: '> Initializing core systems…', delay: 300 },
  { text: '> Loading neural network modules…', delay: 800 },
  { text: '> Establishing secure connection…', delay: 1500 },
  { text: '> Calibrating voice synthesis engine…', delay: 2200 },
  { text: '> Mounting agent personality matrix…', delay: 3000 },
  { text: '> Running diagnostics… ████████ OK', delay: 3800 },
  { text: '> All systems nominal.', delay: 5000 },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export function BootSequence() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [slow, setSlow] = useState(false);
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 5,
    }))
  );

  // Progressive boot log lines
  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Progress bar animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 95) return 95; // Hold at 95% until backend actually connects
        return p + Math.random() * 3 + 0.5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Slow connection warning
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="boot-sequence">
      {/* Hex grid background */}
      <div className="boot-grid" />

      {/* Scan line overlay */}
      <div className="boot-scanlines" />

      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="boot-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Central reactor assembly */}
      <div className="boot-reactor-wrapper">
        {/* Outermost ring */}
        <div className="boot-ring boot-ring-3" />
        {/* Middle ring */}
        <div className="boot-ring boot-ring-2" />
        {/* Inner ring */}
        <div className="boot-ring boot-ring-1" />
        {/* Core glow */}
        <div className="boot-core">
          <div className="boot-core-inner" />
        </div>
      </div>

      {/* JARVIS title */}
      <h1 className="boot-title">
        {'JARVIS'.split('').map((char, i) => (
          <span
            key={i}
            className="boot-title-char"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            {char}
          </span>
        ))}
      </h1>

      {/* Subtitle */}
      <p className="boot-subtitle">
        Just A Rather Very Intelligent System
      </p>

      {/* Boot log terminal */}
      <div className="boot-terminal">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`boot-log-line ${i === visibleLines - 1 ? 'boot-log-latest' : ''}`}
          >
            {line.text}
          </div>
        ))}
        {visibleLines < BOOT_LINES.length && (
          <span className="boot-cursor">▌</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="boot-progress-track">
        <div
          className="boot-progress-bar"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <span className="boot-progress-label">
          {Math.round(Math.min(progress, 100))}%
        </span>
      </div>

      {/* Slow warning */}
      {slow && (
        <p className="boot-slow-warning">
          Server is taking longer than usual… hang tight.
        </p>
      )}
    </div>
  );
}
