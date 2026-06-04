import React, { useEffect, useState, useRef } from 'react';
import './animations.css';
export type CharacterAnimation = 'idle' | 'walk' | 'run' | 'wave' | 'dance' | 'sleep' | 'excited' | 'talk' | 'happy' | 'sad' | 'angry' | 'confused' | 'jealous' | 'bored' | 'surprised' | 'laughing' | 'thinking' | 'shy' | 'love' | 'scared' | 'dizzy' | 'cool' | 'dash' | 'jump' | 'teleport' | 'spin' | 'bounce' | 'zigzag' | 'crawl' | 'sneak' | 'cartwheel' | 'hover' | 'pace' | 'hide' | 'hang' | 'draw';
export interface CharacterProps {
  animation: CharacterAnimation;
  size?: number;
  flipped?: boolean;
  isBlinking?: boolean;
  isSpeaking?: boolean;
  moodLabel?: string;
  showEmotionBubble?: string | null;
  showParticleBurst?: boolean;
  mouseX?: number;
  mouseY?: number;
  posX?: number;
  posY?: number;
}

export interface CustomCharacter {
  id: string;
  name: string;
  sprites: Partial<Record<CharacterAnimation, string>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emotion Speech Bubble
// ─────────────────────────────────────────────────────────────────────────────
const EMOTION_BUBBLE_TEXT: Partial<Record<CharacterAnimation, string>> = {
  thinking: '🤔 Hmm...',
  confused: '❓ Huh?',
  happy: '😊 Yay!',
  excited: '⚡ Let\'s go!',
  sad: '😔 Oh no...',
  angry: '😤 Hmph!',
  bored: '😑 Sigh...',
  surprised: '😲 Whoa!',
  laughing: '😄 Haha!',
  love: '❤️ Aww~',
  scared: '😰 Eek!',
  cool: '😎 Smooth.',
  wave: '👋 Hey!',
  dance: '🎵 ~♪~',
  sleep: '💤 Zzz...',
  shy: '🌸 Blush...',
};

const EmotionBubble: React.FC<{ animation: CharacterAnimation }> = ({ animation }) => {
  const text = EMOTION_BUBBLE_TEXT[animation];
  if (!text) return null;
  return <div className="emotion-bubble">{text}</div>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Eye Tracking Helper
// ─────────────────────────────────────────────────────────────────────────────
const computeEyeOffset = (mouseX?: number, mouseY?: number, posX?: number, posY?: number, size = 80, maxOffset = 3) => {
  if (mouseX === undefined || mouseY === undefined || posX === undefined || posY === undefined) return { x: 0, y: 0 };
  const centerX = posX + size / 2;
  const centerY = posY + size / 2;
  const dx = mouseX - centerX;
  const dy = mouseY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return { x: 0, y: 0 };
  
  const factor = Math.min(distance / 150, 1); 
  return {
    x: (dx / distance) * factor * maxOffset,
    y: (dy / distance) * factor * maxOffset
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Particle Burst (celebration on task complete)
// ─────────────────────────────────────────────────────────────────────────────
const BURST_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4ECDC4', '#A855F7', '#F97316', '#EC4899'];

const ParticleBurst: React.FC = () => {
  const angles = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <div className="particle-burst-container">
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const dist = 40 + Math.random() * 30;
        const tx = Math.cos(rad) * dist;
        const ty = Math.sin(rad) * dist;
        const color = BURST_COLORS[i % BURST_COLORS.length];
        const delay = Math.random() * 0.2;
        return (
          <div
            key={i}
            className="particle"
            style={{
              '--burst-to': `translate(${tx}px, ${ty}px)`,
              backgroundColor: color,
              top: '50%',
              left: '50%',
              marginTop: '-4px',
              marginLeft: '-4px',
              animationDelay: `${delay}s`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
};


const BaseCharacter: React.FC<{
  size: number;
  flipped: boolean;
  animation: CharacterAnimation;
  isBlinking?: boolean;
  isSpeaking?: boolean;
  moodLabel?: string;
  showParticleBurst?: boolean;
  children: React.ReactNode;
}> = ({ size, flipped, animation, isBlinking, isSpeaking, moodLabel, showParticleBurst, children }) => {
  const moodClass = moodLabel && ['happy','sad','angry','excited','love','cool','thinking','scared'].includes(moodLabel)
    ? `mood-${moodLabel}` : '';
  return (
    <div
      className={`relative inline-block character-wrapper anim-${animation} ${moodClass}`}
      style={{
        width: size,
        height: size,
        transform: flipped ? 'scaleX(-1)' : 'scaleX(1)',
      }}
    >
      {/* Emotion speech bubble above character */}
      {animation !== 'idle' && animation !== 'talk' && animation !== 'walk' && animation !== 'run' && (
        <EmotionBubble animation={animation} />
      )}
      {/* Particle celebration burst */}
      {showParticleBurst && <ParticleBurst />}
      {animation === 'sleep' && (
        <>
          <div className="zzz-particles">
            <div className="absolute zzz-1">Z</div>
            <div className="absolute zzz-2">z</div>
            <div className="absolute zzz-3">Z</div>
          </div>
          <div className="absolute -bottom-2 -left-4 z-20 pointer-events-none drop-shadow-lg">
            <svg width="140" height="60" viewBox="0 0 140 60" fill="none">
              {/* Cozy sleeping bag tucked over the character */}
              <path d="M 5 50 C 5 20, 135 25, 135 50 C 135 60, 5 60, 5 50 Z" fill="#3b82f6" opacity="0.95" />
              <path d="M 5 50 C 5 40, 135 42, 135 50 C 135 60, 5 60, 5 50 Z" fill="#1d4ed8" />
              <path d="M 20 28 Q 60 45 100 28" stroke="#1e3a8a" strokeWidth="4" strokeLinecap="round" fill="none"/>
              <circle cx="20" cy="50" r="10" fill="#facc15" opacity="0.8"/>
            </svg>
          </div>
        </>
      )}
      {animation === 'draw' && (
        <div className="absolute top-1/2 -right-4 -translate-y-1/2 animate-bounce z-10 origin-bottom-left" style={{ animationDuration: '0.3s' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 drop-shadow-lg">
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" fill="#facc15" stroke="#ca8a04"/>
            <path d="m15 5 4 4" stroke="#ca8a04"/>
          </svg>
        </div>
      )}
      {animation === 'confused' && <div className="q-mark">?</div>}
      {animation === 'surprised' && <div className="exclamation-mark">!</div>}
      {animation === 'thinking' && <div className="thinking-bubble">...</div>}
      {animation === 'love' && (
        <div className="heart-particles">
          <div className="absolute heart-1">❤️</div>
          <div className="absolute heart-2">❤️</div>
        </div>
      )}
      {animation === 'scared' && <div className="sweat-drop">💧</div>}
      {animation === 'dizzy' && (
        <div className="dizzy-stars">
          <div className="absolute star-1">⭐</div>
          <div className="absolute star-2">⭐</div>
          <div className="absolute star-3">⭐</div>
        </div>
      )}
      {animation === 'bored' && <div className="bored-sigh">sigh...</div>}
      {animation === 'jealous' && <div className="jealous-hmph">hmph!</div>}
      {animation === 'laughing' && (
        <div className="laugh-particles">
          <div className="absolute laugh-1">ha</div>
          <div className="absolute laugh-2">ha</div>
        </div>
      )}
      {animation === 'cool' && (
        <div className="cool-glasses absolute top-1/4 left-1/4 w-1/2 h-1/4 z-10 flex items-center justify-center">
          <svg viewBox="0 0 100 40" className="w-full drop-shadow-md">
            <rect x="10" y="10" width="35" height="20" rx="4" fill="#111" />
            <rect x="55" y="10" width="35" height="20" rx="4" fill="#111" />
            <path d="M 45 20 L 55 20" stroke="#111" strokeWidth="4" />
          </svg>
        </div>
      )}
      {animation === 'shy' && (
        <div className="shy-blush absolute top-1/3 left-0 w-full flex justify-between px-[15%] z-10 opacity-70">
          <div className="w-4 h-3 bg-pink-400 rounded-full blur-[2px]" />
          <div className="w-4 h-3 bg-pink-400 rounded-full blur-[2px]" />
        </div>
      )}
      {children}
    </div>
  );
};

export const JarvisBot: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false, isBlinking = false, isSpeaking = false, moodLabel, showParticleBurst, mouseX, mouseY, posX, posY }) => {
  const { x: ex, y: ey } = computeEyeOffset(mouseX, mouseY, posX, posY, size, 2);
  const eyeTransform = `translate(${flipped ? -ex : ex}, ${ey})`;
  
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation} isBlinking={isBlinking} isSpeaking={isSpeaking} moodLabel={moodLabel} showParticleBurst={showParticleBurst}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Antenna */}
        <line x1="50" y1="20" x2="50" y2="5" stroke="#0ff" strokeWidth="2" />
        <circle cx="50" cy="5" r="3" fill="#0ff" className={animation === 'excited' || animation === 'talk' ? 'animate-pulse' : ''} />
        {/* Head */}
        <rect x="35" y="20" width="30" height="25" rx="5" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        {/* Eyes — support blink by collapsing scaleY */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g className={isBlinking ? 'eye-blink' : ''} transform={eyeTransform}>
            <path d="M 38 30 Q 42 26 46 30" fill="none" stroke="#0ff" strokeWidth="3" strokeLinecap="round" />
            <path d="M 50 30 Q 54 26 58 30" fill="none" stroke="#0ff" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g className={isBlinking ? 'eye-blink' : ''} transform={eyeTransform}>
            <path d="M 38 28 Q 42 26 46 30" fill="none" stroke="#0ff" strokeWidth="3" strokeLinecap="round" />
            <path d="M 50 30 Q 54 26 58 28" fill="none" stroke="#0ff" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g className={isBlinking ? 'eye-blink' : ''} transform={eyeTransform}>
            <path d="M 38 28 L 46 32" stroke="#f00" strokeWidth="3" strokeLinecap="round" />
            <path d="M 50 32 L 58 28" stroke="#f00" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : (
          <g className={isBlinking ? 'eye-blink' : ''} transform={eyeTransform}>
            <rect x="40" y="28" width="8" height={isBlinking ? 0.5 : 4} fill="#0ff" className={animation === 'sleep' ? 'opacity-20' : ''} />
            <rect x="52" y="28" width="8" height={isBlinking ? 0.5 : 4} fill="#0ff" className={animation === 'sleep' ? 'opacity-20' : ''} />
          </g>
        )}
        {/* Mouth — lip-sync when speaking */}
        <rect
          x="43" y="38" width="14" height={isSpeaking ? 4 : 2}
          rx="1" fill="#0ff" opacity="0.7"
          className={isSpeaking ? 'lip-syncing' : ''}
        />
        {/* Body */}
        <rect x="30" y="45" width="40" height="35" rx="5" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        {/* Chest Core */}
        <circle cx="50" cy="62" r="8" fill="none" stroke="#0ff" strokeWidth="2" />
        <circle cx="50" cy="62" r="4" fill="#0ff" className={animation === 'talk' || animation === 'excited' || isSpeaking ? 'animate-pulse' : ''} />
        {/* Limbs */}
        <g className="limb-l">
          <rect x="20" y="45" width="8" height="25" rx="4" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        </g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}>
          <rect x="72" y="45" width="8" height="25" rx="4" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        </g>
        <g className="limb-r">
          <rect x="35" y="80" width="8" height="20" rx="4" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        </g>
        <g className="limb-l">
          <rect x="57" y="80" width="8" height="20" rx="4" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const PixelFox: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false, isBlinking = false, isSpeaking = false, moodLabel, showParticleBurst, mouseX, mouseY, posX, posY }) => {
  const { x: ex, y: ey } = computeEyeOffset(mouseX, mouseY, posX, posY, size, 2);
  const eyeTransform = `translate(${flipped ? -ex : ex}, ${ey})`;

  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation} isBlinking={isBlinking} isSpeaking={isSpeaking} moodLabel={moodLabel} showParticleBurst={showParticleBurst}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible" shapeRendering="crispEdges">
        {/* Tail */}
        <path d="M 20 60 L 10 50 L 10 70 L 25 80 Z" fill="#ff7e00" className="limb-l" />
        <path d="M 10 70 L 5 85 L 20 85 Z" fill="#fff" className="limb-l" />
        {/* Body */}
        <rect x="25" y="55" width="40" height="25" fill="#ff7e00" />
        <rect x="35" y="70" width="20" height="10" fill="#fff" />
        {/* Legs */}
        <rect x="30" y="80" width="8" height="15" fill="#333" className="limb-l" />
        <rect x="52" y="80" width="8" height="15" fill="#333" className="limb-r" />
        {/* Head */}
        <rect x="45" y="25" width="35" height="35" fill="#ff7e00" />
        <rect x="45" y="40" width="35" height="20" fill="#fff" />
        {/* Ears */}
        <rect x="45" y="10" width="10" height="15" fill="#333" />
        <rect x="70" y="10" width="10" height="15" fill="#333" />
        {/* Eyes & Nose */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g transform={eyeTransform}>
            <rect x="48" y="43" width="9" height="3" fill="#000" />
            <rect x="68" y="43" width="9" height="3" fill="#000" />
          </g>
        ) : animation === 'sad' ? (
          <g transform={eyeTransform}>
            <rect x="50" y="47" width="5" height="5" fill="#000" />
            <rect x="70" y="47" width="5" height="5" fill="#000" />
            <rect x="48" y="45" width="5" height="2" fill="#000" />
            <rect x="72" y="45" width="5" height="2" fill="#000" />
          </g>
        ) : animation === 'angry' ? (
          <g transform={eyeTransform}>
            <rect x="50" y="45" width="5" height="5" fill="#000" />
            <rect x="70" y="45" width="5" height="5" fill="#000" />
            <rect x="50" y="43" width="7" height="2" fill="#000" transform="rotate(20 50 43)" />
            <rect x="68" y="43" width="7" height="2" fill="#000" transform="rotate(-20 68 43)" />
          </g>
        ) : (
          <g transform={eyeTransform}>
            <rect x="50" y="45" width="5" height="5" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <rect x="70" y="45" width="5" height="5" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <rect x="48" y="47" width="9" height="2" fill="#000" />
                <rect x="68" y="47" width="9" height="2" fill="#000" />
              </g>
            )}
          </g>
        )}
        <rect x="60" y="55" width="5" height="5" fill="#000" />
      </svg>
    </BaseCharacter>
  );
};

export const SpaceCat: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false, mouseX, mouseY, posX, posY }) => {
  const { x: ex, y: ey } = computeEyeOffset(mouseX, mouseY, posX, posY, size, 2);
  const eyeTransform = `translate(${flipped ? -ex : ex}, ${ey})`;

  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Backpack/Jetpack */}
        <rect x="20" y="40" width="20" height="40" rx="5" fill="#ccc" />
        {/* Tail */}
        <path d="M 25 75 Q 10 90 20 100" fill="none" stroke="#ffb347" strokeWidth="6" strokeLinecap="round" className="limb-l" />
        {/* Body (Space Suit) */}
        <rect x="30" y="45" width="40" height="40" rx="15" fill="#fff" stroke="#ddd" strokeWidth="2" />
        {/* Emblem */}
        <circle cx="50" cy="65" r="6" fill="#3498db" />
        {/* Limbs */}
        <rect x="35" y="80" width="10" height="15" rx="5" fill="#fff" stroke="#ddd" strokeWidth="2" className="limb-l" />
        <rect x="55" y="80" width="10" height="15" rx="5" fill="#fff" stroke="#ddd" strokeWidth="2" className="limb-r" />
        <rect x="20" y="55" width="15" height="10" rx="5" fill="#fff" stroke="#ddd" strokeWidth="2" className="limb-l" />
        <rect x="65" y="55" width="15" height="10" rx="5" fill="#fff" stroke="#ddd" strokeWidth="2" className={animation === 'wave' ? 'arm-wave' : 'limb-r'} />
        {/* Helmet */}
        <circle cx="50" cy="30" r="22" fill="rgba(255,255,255,0.4)" stroke="#fff" strokeWidth="3" />
        {/* Cat Head */}
        <circle cx="50" cy="32" r="16" fill="#ffb347" />
        <polygon points="38,22 45,18 42,28" fill="#ffb347" />
        <polygon points="62,22 55,18 58,28" fill="#ffb347" />
        {/* Face */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g transform={eyeTransform}>
            <path d="M 42 30 Q 44 27 46 30" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 30 Q 56 27 58 30" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g transform={eyeTransform}>
            <path d="M 42 29 Q 44 27 46 31" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 31 Q 56 27 58 29" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g transform={eyeTransform}>
            <path d="M 42 29 L 46 31" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="44" cy="30" r="2" fill="#000" />
            <path d="M 54 31 L 58 29" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="56" cy="30" r="2" fill="#000" />
          </g>
        ) : (
          <g transform={eyeTransform}>
            <circle cx="44" cy="30" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="56" cy="30" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="42" y1="31" x2="46" y2="31" stroke="#000" strokeWidth="2" />
                <line x1="54" y1="31" x2="58" y2="31" stroke="#000" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        <path d="M 48 35 Q 50 37 52 35" fill="none" stroke="#000" strokeWidth="1.5" />
      </svg>
    </BaseCharacter>
  );
};

export const FireDrake: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Wings */}
        <path d="M 35 45 Q 10 30 15 15 Q 25 25 35 35 Z" fill="#2ecc71" className="limb-l" />
        <path d="M 65 45 Q 90 30 85 15 Q 75 25 65 35 Z" fill="#2ecc71" className="limb-r" />
        {/* Tail */}
        <path d="M 50 80 Q 50 110 20 100" fill="none" stroke="#27ae60" strokeWidth="12" strokeLinecap="round" className="limb-l" />
        <polygon points="15,105 25,95 10,95" fill="#e74c3c" className="limb-l" />
        {/* Body */}
        <ellipse cx="50" cy="65" rx="20" ry="25" fill="#27ae60" />
        <ellipse cx="50" cy="68" rx="12" ry="18" fill="#f1c40f" />
        {/* Limbs */}
        <ellipse cx="35" cy="85" rx="8" ry="10" fill="#27ae60" className="limb-l" />
        <ellipse cx="65" cy="85" rx="8" ry="10" fill="#27ae60" className="limb-r" />
        <ellipse cx="32" cy="65" rx="6" ry="12" fill="#27ae60" className="limb-l" />
        <ellipse cx="68" cy="65" rx="6" ry="12" fill="#27ae60" className={animation === 'wave' ? 'arm-wave' : 'limb-r'} />
        {/* Head */}
        <circle cx="50" cy="30" r="18" fill="#27ae60" />
        <polygon points="40,15 45,25 35,25" fill="#e74c3c" />
        <polygon points="60,15 65,25 55,25" fill="#e74c3c" />
        <polygon points="50,12 54,20 46,20" fill="#e74c3c" />
        {/* Face */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 27 Q 42 24 44 27" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 56 27 Q 58 24 60 27" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 40 26 Q 42 24 44 28" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 56 28 Q 58 24 60 26" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 40 26 L 44 28" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="42" cy="27" r="2" fill="#000" />
            <path d="M 56 28 L 60 26" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="58" cy="27" r="2" fill="#000" />
          </g>
        ) : (
          <g>
            <circle cx="42" cy="28" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="58" cy="28" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="40" y1="29" x2="45" y2="29" stroke="#000" strokeWidth="2" />
                <line x1="55" y1="29" x2="60" y2="29" stroke="#000" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        <ellipse cx="50" cy="38" rx="10" ry="6" fill="#2ecc71" />
        <circle cx="46" cy="37" r="1" fill="#000" />
        <circle cx="54" cy="37" r="1" fill="#000" />
        {/* Fire breath when excited/talk */}
        {(animation === 'excited' || animation === 'talk') && (
          <path d="M 45 45 Q 50 65 55 45 Q 60 70 50 80 Q 40 70 45 45 Z" fill="#e74c3c" className="animate-pulse" />
        )}
      </svg>
    </BaseCharacter>
  );
};

export const Ninja: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Body */}
        <rect x="30" y="45" width="40" height="35" rx="5" fill="#2c3e50" />
        <rect x="40" y="45" width="20" height="35" fill="#34495e" /> {/* tunic detail */}
        <rect x="30" y="60" width="40" height="5" fill="#c0392b" /> {/* belt */}
        {/* Limbs */}
        <g className="limb-l"><rect x="20" y="45" width="10" height="25" rx="5" fill="#2c3e50" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="70" y="45" width="10" height="25" rx="5" fill="#2c3e50" /></g>
        <g className="limb-l"><rect x="35" y="80" width="10" height="20" rx="5" fill="#2c3e50" /></g>
        <g className="limb-r"><rect x="55" y="80" width="10" height="20" rx="5" fill="#2c3e50" /></g>
        {/* Head */}
        <circle cx="50" cy="30" r="18" fill="#f1c40f" /> {/* skin */}
        <path d="M 32 30 A 18 18 0 0 1 68 30 Z" fill="#2c3e50" /> {/* mask top */}
        <path d="M 32 30 A 18 18 0 0 0 68 30 Z" fill="#2c3e50" transform="translate(0, 10)" /> {/* mask bottom */}
        {/* Headband */}
        <rect x="31" y="18" width="38" height="6" fill="#c0392b" />
        <path d="M 69 21 L 80 15 L 75 25 Z" fill="#c0392b" className="limb-r" />
        {/* Eyes */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 34 Q 43 31 46 34" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 34 Q 57 31 60 34" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 41 33 Q 43 31 45 35" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 55 35 Q 57 31 59 33" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 41 33 L 45 35" stroke="#f00" strokeWidth="2" strokeLinecap="round" />
            <circle cx="43" cy="34" r="2" fill="#f00" />
            <path d="M 55 35 L 59 33" stroke="#f00" strokeWidth="2" strokeLinecap="round" />
            <circle cx="57" cy="34" r="2" fill="#f00" />
          </g>
        ) : (
          <g>
            <circle cx="43" cy="34" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="57" cy="34" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g><line x1="41" y1="35" x2="45" y2="35" stroke="#000" strokeWidth="2" /><line x1="55" y1="35" x2="59" y2="35" stroke="#000" strokeWidth="2" /></g>
            )}
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const Wizard: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Robe/Body */}
        <path d="M 35 40 L 20 95 L 80 95 L 65 40 Z" fill="#8e44ad" />
        <path d="M 45 40 L 40 95 L 60 95 L 55 40 Z" fill="#9b59b6" /> {/* robe trim */}
        {/* Limbs (Arms) */}
        <g className="limb-l"><path d="M 35 45 L 15 70 L 25 75 L 40 50 Z" fill="#8e44ad" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><path d="M 65 45 L 85 70 L 75 75 L 60 50 Z" fill="#8e44ad" /></g>
        {/* Staff */}
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}>
          <rect x="80" y="20" width="4" height="60" fill="#8b4513" />
          <circle cx="82" cy="20" r="6" fill="#f1c40f" className={animation === 'excited' ? 'animate-pulse' : ''} />
        </g>
        {/* Head */}
        <circle cx="50" cy="35" r="15" fill="#f5b041" />
        {/* Beard */}
        <path d="M 35 35 Q 50 70 65 35 Q 50 50 35 35 Z" fill="#ecf0f1" />
        {/* Hat */}
        <path d="M 20 30 L 80 30 L 50 0 Z" fill="#2c3e50" />
        <ellipse cx="50" cy="30" rx="35" ry="5" fill="#34495e" />
        {/* Eyes */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 41 32 Q 44 29 47 32" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 53 32 Q 56 29 59 32" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 42 31 Q 44 29 46 33" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 33 Q 56 29 58 31" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 42 31 L 46 33" stroke="#f00" strokeWidth="2" strokeLinecap="round" />
            <circle cx="44" cy="32" r="2" fill="#f00" />
            <path d="M 54 33 L 58 31" stroke="#f00" strokeWidth="2" strokeLinecap="round" />
            <circle cx="56" cy="32" r="2" fill="#f00" />
          </g>
        ) : (
          <g>
            <circle cx="44" cy="32" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="56" cy="32" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g><line x1="42" y1="33" x2="46" y2="33" stroke="#000" strokeWidth="2" /><line x1="54" y1="33" x2="58" y2="33" stroke="#000" strokeWidth="2" /></g>
            )}
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const CyberPunk: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Legs */}
        <g className="limb-l"><rect x="35" y="80" width="10" height="20" rx="2" fill="#34495e" /></g>
        <g className="limb-r"><rect x="55" y="80" width="10" height="20" rx="2" fill="#34495e" /></g>
        {/* Body (Jacket) */}
        <rect x="30" y="40" width="40" height="40" rx="5" fill="#1abc9c" />
        <rect x="45" y="40" width="10" height="40" fill="#16a085" />
        {/* Limbs (Arms) */}
        <g className="limb-l"><rect x="20" y="40" width="10" height="30" rx="5" fill="#1abc9c" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="70" y="40" width="10" height="30" rx="5" fill="#1abc9c" /></g>
        {/* Head */}
        <rect x="35" y="15" width="30" height="25" rx="8" fill="#f39c12" />
        {/* Hair */}
        <path d="M 30 20 Q 50 0 70 20 L 70 15 Q 50 -5 30 15 Z" fill="#9b59b6" />
        <path d="M 35 15 L 45 5 L 55 15 Z" fill="#9b59b6" />
        {/* Cyber Glasses */}
        <rect x="32" y="22" width="36" height="8" rx="2" fill="#000" />
        <rect x="34" y="24" width="32" height="4" fill={
          animation === 'angry' ? '#f00' :
          animation === 'sad' ? '#3498db' :
          animation === 'happy' ? '#f1c40f' :
          '#0ff'
        } className={(animation === 'excited' || animation === 'happy') ? 'animate-pulse' : ''} />
        {/* Mouth */}
        {animation === 'happy' || animation === 'excited' ? (
          <path d="M 45 35 Q 50 40 55 35" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'sad' ? (
          <path d="M 45 38 Q 50 33 55 38" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'angry' ? (
          <path d="M 45 37 L 55 37" stroke="#000" strokeWidth="2" />
        ) : (
          <path d="M 45 35 Q 50 38 55 35" fill="none" stroke="#000" strokeWidth="2" />
        )}
        {animation === 'sleep' && (
          <rect x="34" y="24" width="32" height="4" fill="#333" /> // dim glasses
        )}
      </svg>
    </BaseCharacter>
  );
};

export const MinionBob: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false, mouseX, mouseY, posX, posY }) => {
  const { x: ex, y: ey } = computeEyeOffset(mouseX, mouseY, posX, posY, size, 2);
  const eyeTransform = `translate(${flipped ? -ex : ex}, ${ey})`;

  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Legs */}
        <g className="limb-l"><rect x="35" y="85" width="8" height="15" rx="3" fill="#34495e" /></g>
        <g className="limb-r"><rect x="57" y="85" width="8" height="15" rx="3" fill="#34495e" /></g>
        {/* Body (Pill) */}
        <rect x="30" y="20" width="40" height="65" rx="20" fill="#f1c40f" />
        {/* Overalls */}
        <path d="M 30 60 L 70 60 L 70 70 A 20 20 0 0 1 30 70 Z" fill="#2980b9" />
        <rect x="35" y="50" width="30" height="15" fill="#2980b9" />
        {/* Straps */}
        <path d="M 25 45 L 35 50" stroke="#2980b9" strokeWidth="4" className="limb-l" />
        <path d="M 75 45 L 65 50" stroke="#2980b9" strokeWidth="4" className="limb-r" />
        {/* Arms */}
        <g className="limb-l"><rect x="20" y="45" width="8" height="25" rx="4" fill="#f1c40f" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="72" y="45" width="8" height="25" rx="4" fill="#f1c40f" /></g>
        {/* Goggles & Strap */}
        <rect x="28" y="32" width="44" height="6" fill="#333" />
        <circle cx="50" cy="35" r="12" fill="#bdc3c7" />
        <circle cx="50" cy="35" r="9" fill="#fff" />
        {/* Eye */}
        {(animation === 'happy' || animation === 'excited') ? (
          <path d="M 46 35 Q 50 32 54 35" fill="none" stroke="#8e44ad" strokeWidth="3" strokeLinecap="round" transform={eyeTransform} />
        ) : animation === 'sad' ? (
          <g transform={eyeTransform}>
            <circle cx="50" cy="36" r="3" fill="#8e44ad" />
            <path d="M 47 32 Q 50 31 53 32" fill="none" stroke="#333" strokeWidth="1.5" />
          </g>
        ) : animation === 'angry' ? (
          <g transform={eyeTransform}>
            <circle cx="50" cy="35" r="3" fill="#8e44ad" />
            <path d="M 46 32 L 54 34" stroke="#333" strokeWidth="1.5" />
          </g>
        ) : (
          <g transform={eyeTransform}>
            <circle cx="50" cy="35" r="3" fill="#8e44ad" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <line x1="45" y1="35" x2="55" y2="35" stroke="#000" strokeWidth="2" />
            )}
          </g>
        )}
        {/* Mouth */}
        {animation === 'happy' || animation === 'excited' ? (
          <path d="M 45 45 Q 50 52 55 45" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'sad' ? (
          <path d="M 45 48 Q 50 44 55 48" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'angry' ? (
          <path d="M 45 47 L 55 47" stroke="#000" strokeWidth="2" />
        ) : (
          <path d="M 45 45 Q 50 50 55 45" fill="none" stroke="#000" strokeWidth="2" />
        )}
      </svg>
    </BaseCharacter>
  );
};

export const SpaceBean: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Backpack */}
        <rect x="15" y="35" width="15" height="35" rx="5" fill="#c0392b" />
        {/* Body */}
        <rect x="30" y="20" width="45" height="65" rx="22" fill="#e74c3c" />
        {/* Legs */}
        <g className="limb-l"><rect x="30" y="70" width="16" height="30" rx="8" fill="#e74c3c" /></g>
        <g className="limb-r"><rect x="59" y="70" width="16" height="30" rx="8" fill="#e74c3c" /></g>
        {/* Visor */}
        <ellipse cx="60" cy="40" rx="15" ry="10" fill="#3498db" />
        <ellipse cx="65" cy="37" rx="5" ry="3" fill="#fff" opacity="0.6" />
        {animation === 'angry' && (
          <path d="M 50 35 L 70 38" stroke="#2c3e50" strokeWidth="2" />
        )}
        {animation === 'sad' && (
          <path d="M 50 38 Q 60 32 70 38" fill="none" stroke="#2c3e50" strokeWidth="2" />
        )}
        {animation === 'sleep' && (
          <line x1="50" y1="40" x2="70" y2="40" stroke="#2c3e50" strokeWidth="3" />
        )}
      </svg>
    </BaseCharacter>
  );
};

export const AlienDude: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Legs */}
        <g className="limb-l"><rect x="38" y="75" width="6" height="25" rx="3" fill="#2ecc71" /></g>
        <g className="limb-r"><rect x="56" y="75" width="6" height="25" rx="3" fill="#2ecc71" /></g>
        {/* Body */}
        <rect x="35" y="45" width="30" height="35" rx="10" fill="#2ecc71" />
        <rect x="40" y="50" width="20" height="25" fill="#27ae60" /> {/* belly */}
        {/* Arms */}
        <g className="limb-l"><rect x="25" y="45" width="6" height="30" rx="3" fill="#2ecc71" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="69" y="45" width="6" height="30" rx="3" fill="#2ecc71" /></g>
        {/* Head */}
        <ellipse cx="50" cy="30" rx="25" ry="20" fill="#2ecc71" />
        {/* Eyes (Huge) */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 30 28 Q 38 20 46 28" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
            <path d="M 54 28 Q 62 20 70 28" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 30 24 Q 38 18 46 32" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
            <path d="M 54 32 Q 62 18 70 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 30 24 L 46 32" stroke="#000" strokeWidth="4" strokeLinecap="round" />
            <circle cx="42" cy="30" r="4" fill="#000" />
            <path d="M 54 32 L 70 24" stroke="#000" strokeWidth="4" strokeLinecap="round" />
            <circle cx="58" cy="30" r="4" fill="#000" />
          </g>
        ) : (
          <g>
            <ellipse cx="38" cy="28" rx="8" ry="12" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <ellipse cx="62" cy="28" rx="8" ry="12" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="30" y1="28" x2="46" y2="28" stroke="#000" strokeWidth="3" />
                <line x1="54" y1="28" x2="70" y2="28" stroke="#000" strokeWidth="3" />
              </g>
            )}
          </g>
        )}
        {/* Small mouth */}
        {animation === 'happy' || animation === 'excited' ? (
          <path d="M 48 42 Q 50 48 52 42" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'sad' ? (
          <path d="M 48 45 Q 50 42 52 45" fill="none" stroke="#000" strokeWidth="2" />
        ) : animation === 'angry' ? (
          <path d="M 48 44 L 52 44" stroke="#000" strokeWidth="2" />
        ) : (
          <path d="M 48 42 Q 50 45 52 42" fill="none" stroke="#000" strokeWidth="2" />
        )}
      </svg>
    </BaseCharacter>
  );
};

export const SpiderMan: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isSwinging = animation === 'walk' || animation === 'run';
  const isCrouching = animation === 'idle' || animation === 'sad';
  const isHanging = animation === 'sleep';

  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {isSwinging && (
          // Web line shooting diagonally up
          <line x1="50" y1="30" x2="80" y2="-20" stroke="#fff" strokeWidth="2" strokeDasharray="4,2" />
        )}
        {isHanging && (
          // Web line straight up
          <line x1="50" y1="80" x2="50" y2="-20" stroke="#fff" strokeWidth="2" />
        )}

        {/* Head */}
        <g transform={isHanging ? "translate(0, 50) rotate(180, 50, 30)" : isCrouching ? "translate(0, 20)" : isSwinging ? "translate(-10, -10) rotate(-15, 50, 30)" : ""}>
          <circle cx="50" cy="30" r="14" fill="#e74c3c" />
          {/* Eyes */}
          {(animation === 'happy' || animation === 'excited') ? (
            <g>
              <path d="M 40 25 Q 48 20 48 30 Z" fill="#fff" stroke="#000" strokeWidth="1" />
              <path d="M 60 25 Q 52 20 52 30 Z" fill="#fff" stroke="#000" strokeWidth="1" />
            </g>
          ) : animation === 'sad' ? (
            <g>
              <path d="M 42 22 Q 48 28 48 32 Q 42 32 40 28" fill="#fff" stroke="#000" strokeWidth="1" />
              <path d="M 58 22 Q 52 28 52 32 Q 58 32 60 28" fill="#fff" stroke="#000" strokeWidth="1" />
            </g>
          ) : animation === 'angry' ? (
            <g>
              <path d="M 38 22 Q 48 28 48 32 L 40 26 Z" fill="#fff" stroke="#000" strokeWidth="1" />
              <path d="M 62 22 Q 52 28 52 32 L 60 26 Z" fill="#fff" stroke="#000" strokeWidth="1" />
            </g>
          ) : (
            <g>
              <path d="M 40 25 Q 48 20 48 32 Q 42 32 40 25" fill="#fff" stroke="#000" strokeWidth="1" className={animation === 'sleep' ? 'opacity-0' : ''} />
              <path d="M 60 25 Q 52 20 52 32 Q 58 32 60 25" fill="#fff" stroke="#000" strokeWidth="1" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && (
                <g>
                  <line x1="40" y1="30" x2="48" y2="25" stroke="#000" strokeWidth="2" />
                  <line x1="60" y1="30" x2="52" y2="25" stroke="#000" strokeWidth="2" />
                </g>
              )}
            </g>
          )}
          
          {/* Web pattern on head */}
          <path d="M 50 16 L 50 44 M 36 30 L 64 30 M 40 20 L 60 40 M 40 40 L 60 20" stroke="#c0392b" strokeWidth="0.5" />
        </g>

        {/* Body */}
        <g transform={isHanging ? "translate(0, 50) rotate(180, 50, 60)" : isCrouching ? "translate(0, 20)" : isSwinging ? "translate(-5, -5) rotate(-15, 50, 60)" : ""}>
          <path d="M 40 40 Q 50 45 60 40 L 55 70 Q 50 75 45 70 Z" fill="#2980b9" />
          <path d="M 42 40 Q 50 45 58 40 L 53 60 L 47 60 Z" fill="#e74c3c" />
          {/* Spider Emblem */}
          <circle cx="50" cy="50" r="2" fill="#000" />
          <path d="M 50 50 L 47 47 M 50 50 L 53 47 M 50 50 L 47 53 M 50 50 L 53 53" stroke="#000" strokeWidth="1" />
        </g>

        {/* Limbs */}
        <g transform={isHanging ? "translate(0, 50) rotate(180, 50, 50)" : isCrouching ? "translate(0, 20)" : isSwinging ? "translate(-5, -5) rotate(-15, 50, 50)" : ""}>
          {isSwinging ? (
            <>
              {/* Swinging Right Arm (holding web) */}
              <path d="M 58 45 L 75 35 L 70 20" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Swinging Left Arm */}
              <path d="M 42 45 L 25 55 L 20 40" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Swinging Legs */}
              <path d="M 45 68 L 30 75 L 20 85" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 55 68 L 70 80 L 80 75" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              {/* Boots */}
              <circle cx="20" cy="85" r="4" fill="#e74c3c" />
              <circle cx="80" cy="75" r="4" fill="#e74c3c" />
            </>
          ) : isCrouching ? (
            <>
              {/* Crouched Arms */}
              <path d="M 42 45 L 35 60 L 45 80" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 58 45 L 65 60 L 55 80" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Crouched Legs */}
              <path d="M 45 68 L 30 65 L 35 80" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 55 68 L 70 65 L 65 80" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              {/* Boots */}
              <circle cx="35" cy="80" r="4" fill="#e74c3c" />
              <circle cx="65" cy="80" r="4" fill="#e74c3c" />
            </>
          ) : isHanging ? (
            <>
              {/* Hanging Arms */}
              <path d="M 42 45 L 35 30 L 40 20" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 58 45 L 65 30 L 60 20" fill="none" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Hanging Legs */}
              <path d="M 45 68 L 45 80 L 50 85" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 55 68 L 55 80 L 50 85" fill="none" stroke="#2980b9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              {/* Boots */}
              <circle cx="50" cy="85" r="4" fill="#e74c3c" />
            </>
          ) : (
            <>
              {/* Standing Arms */}
              <g className="limb-l"><rect x="35" y="45" width="6" height="25" rx="3" fill="#e74c3c" /></g>
              <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="59" y="45" width="6" height="25" rx="3" fill="#e74c3c" /></g>
              {/* Standing Legs */}
              <g className="limb-l"><rect x="40" y="65" width="8" height="25" rx="4" fill="#2980b9" /><rect x="40" y="80" width="8" height="10" rx="2" fill="#e74c3c" /></g>
              <g className="limb-r"><rect x="52" y="65" width="8" height="25" rx="4" fill="#2980b9" /><rect x="52" y="80" width="8" height="10" rx="2" fill="#e74c3c" /></g>
            </>
          )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const IronHero: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isFlying = animation === 'walk' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={isFlying ? "arm-wave overflow-visible" : "body overflow-visible"}>
        <g transform={isFlying ? "translate(0, -10)" : ""}>
          {/* Body */}
          <rect x="30" y="45" width="40" height="35" rx="5" fill="#c0392b" />
          {/* Arc Reactor */}
          <circle cx="50" cy="55" r="8" fill="#fff" stroke="#3498db" strokeWidth="2" className={animation === 'excited' ? 'animate-pulse' : ''} />
          <circle cx="50" cy="55" r="4" fill="#3498db" className={animation === 'excited' ? 'animate-pulse' : ''} />
          {/* Limbs */}
          <g className={isFlying ? "" : "limb-l"}>
            <rect x="20" y="45" width="10" height="25" rx="5" fill="#c0392b" />
            {isFlying && <path d="M 22 70 Q 25 90 28 70 Z" fill="#3498db" className="animate-pulse" opacity="0.8" />}
          </g>
          <g className={animation === 'wave' ? 'arm-wave' : isFlying ? "" : "limb-r"}>
            <rect x="70" y="45" width="10" height="25" rx="5" fill="#c0392b" />
            {isFlying && animation !== 'wave' && <path d="M 72 70 Q 75 90 78 70 Z" fill="#3498db" className="animate-pulse" opacity="0.8" />}
          </g>
          <g className={isFlying ? "" : "limb-l"}>
            <rect x="35" y="80" width="10" height="20" rx="5" fill="#c0392b" />
            {isFlying && <path d="M 37 100 Q 40 125 43 100 Z" fill="#e74c3c" className="animate-pulse" />}
            {isFlying && <path d="M 38 100 Q 40 115 42 100 Z" fill="#f1c40f" className="animate-pulse" />}
          </g>
          <g className={isFlying ? "" : "limb-r"}>
            <rect x="55" y="80" width="10" height="20" rx="5" fill="#c0392b" />
            {isFlying && <path d="M 57 100 Q 60 125 63 100 Z" fill="#e74c3c" className="animate-pulse" />}
            {isFlying && <path d="M 58 100 Q 60 115 62 100 Z" fill="#f1c40f" className="animate-pulse" />}
          </g>
          {/* Head */}
          <rect x="35" y="15" width="30" height="30" rx="5" fill="#c0392b" />
        <polygon points="38,20 62,20 58,40 42,40" fill="#f1c40f" />
        {/* Eyes */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 42 27 Q 45 23 48 27" fill="none" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 52 27 Q 55 23 58 27" fill="none" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 42 25 Q 45 23 48 27" fill="none" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 52 27 Q 55 23 58 25" fill="none" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 42 25 L 48 27" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 52 27 L 58 25" stroke="#0ff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <rect x="42" y="25" width="6" height="4" fill="#0ff" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <rect x="52" y="25" width="6" height="4" fill="#0ff" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="42" y1="27" x2="48" y2="27" stroke="#333" strokeWidth="2" />
                <line x1="52" y1="27" x2="58" y2="27" stroke="#333" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const ElectricMouse: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isElectric = animation === 'excited' || animation === 'angry' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Electric Sparks */}
        {isElectric && (
          <g className="animate-pulse" stroke="#0ff" strokeWidth="2" fill="none">
            <path d="M 10 30 L 5 40 L 15 45 L 5 55" />
            <path d="M 90 30 L 95 40 L 85 45 L 95 55" />
            <path d="M 20 10 L 30 5 L 25 15" />
            <path d="M 80 10 L 70 5 L 75 15" />
          </g>
        )}
        {/* Tail */}
        <path d="M 25 75 L 15 65 L 20 55 L 10 45 L 20 35 L 30 50 Z" fill="#f1c40f" stroke="#000" strokeWidth="1" className="limb-l" />
        {/* Body */}
        <ellipse cx="50" cy="65" rx="22" ry="25" fill="#f1c40f" />
        {/* Limbs */}
        <g className="limb-l"><ellipse cx="35" cy="85" rx="5" ry="10" fill="#f1c40f" /></g>
        <g className="limb-r"><ellipse cx="65" cy="85" rx="5" ry="10" fill="#f1c40f" /></g>
        <g className="limb-l"><ellipse cx="32" cy="60" rx="4" ry="12" fill="#f1c40f" transform="rotate(30 32 60)" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><ellipse cx="68" cy="60" rx="4" ry="12" fill="#f1c40f" transform="rotate(-30 68 60)" /></g>
        {/* Head */}
        <circle cx="50" cy="35" r="20" fill="#f1c40f" />
        {/* Ears */}
        <path d="M 35 20 Q 20 5 15 15 Q 25 30 35 25" fill="#f1c40f" />
        <path d="M 15 15 Q 20 5 25 10 Z" fill="#000" />
        <path d="M 65 20 Q 80 5 85 15 Q 75 30 65 25" fill="#f1c40f" />
        <path d="M 85 15 Q 80 5 75 10 Z" fill="#000" />
        {/* Cheeks */}
        <circle cx="35" cy="40" r="4" fill="#e74c3c" className={animation === 'excited' ? 'animate-pulse' : ''} />
        <circle cx="65" cy="40" r="4" fill="#e74c3c" className={animation === 'excited' ? 'animate-pulse' : ''} />
        {/* Eyes */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 33 Q 43 30 46 33" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 33 Q 57 30 60 33" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 40 31 Q 43 30 46 34" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 34 Q 57 30 60 31" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 40 31 L 46 34" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="43" cy="32" r="3" fill="#000" />
            <path d="M 54 34 L 60 31" stroke="#000" strokeWidth="2" strokeLinecap="round" />
            <circle cx="57" cy="32" r="3" fill="#000" />
          </g>
        ) : (
          <g>
            <circle cx="43" cy="32" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="57" cy="32" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="40" y1="33" x2="46" y2="33" stroke="#000" strokeWidth="2" />
                <line x1="54" y1="33" x2="60" y2="33" stroke="#000" strokeWidth="2" />
              </g>
            )}
            <circle cx="44" cy="31" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="58" cy="31" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
          </g>
        )}
        {/* Mouth */}
        <path d="M 47 38 Q 50 42 53 38" fill="none" stroke="#000" strokeWidth="1.5" />
      </svg>
    </BaseCharacter>
  );
};

export const DarkKnight: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Cape */}
        <path d="M 30 40 L 20 95 L 80 95 L 70 40 Z" fill="#2c3e50" />
        {/* Body */}
        <rect x="35" y="45" width="30" height="35" rx="5" fill="#7f8c8d" />
        <rect x="35" y="60" width="30" height="5" fill="#f1c40f" /> {/* Belt */}
        {/* Bat Emblem */}
        <ellipse cx="50" cy="52" rx="8" ry="4" fill="#000" />
        <path d="M 48 48 L 50 50 L 52 48 Z" fill="#000" />
        {/* Limbs */}
        <g className="limb-l"><rect x="25" y="45" width="8" height="25" rx="4" fill="#7f8c8d" /><rect x="25" y="60" width="8" height="10" fill="#2c3e50" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="67" y="45" width="8" height="25" rx="4" fill="#7f8c8d" /><rect x="67" y="60" width="8" height="10" fill="#2c3e50" /></g>
        <g className="limb-l"><rect x="38" y="80" width="8" height="20" rx="4" fill="#2c3e50" /></g>
        <g className="limb-r"><rect x="54" y="80" width="8" height="20" rx="4" fill="#2c3e50" /></g>
        {/* Head */}
        <circle cx="50" cy="30" r="16" fill="#f5b041" /> {/* face */}
        <path d="M 34 30 A 16 16 0 0 1 66 30 L 66 25 L 60 10 L 55 18 L 45 18 L 40 10 L 34 25 Z" fill="#2c3e50" /> {/* Cowl */}
        {/* Eyes */}
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 28 Q 43 25 46 28" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 28 Q 57 25 60 28" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 40 26 Q 43 25 46 29" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 29 Q 57 25 60 26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 40 26 L 46 29" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 29 L 60 26" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <polygon points="40,25 46,28 40,29" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <polygon points="60,25 54,28 60,29" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="40" y1="28" x2="46" y2="28" stroke="#000" strokeWidth="2" />
                <line x1="54" y1="28" x2="60" y2="28" stroke="#000" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        {/* Mouth */}
        <path d="M 45 38 Q 50 36 55 38" fill="none" stroke="#000" strokeWidth="1.5" />
      </svg>
    </BaseCharacter>
  );
};

export const NinjaTurtle: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isSleeping = animation === 'sleep';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={animation === 'run' ? 'animate-spin' : 'body overflow-visible'}>
        {isSleeping ? (
          <g transform="translate(0, 30)">
            <path d="M 20 60 Q 50 10 80 60 Z" fill="#27ae60" stroke="#1e8449" strokeWidth="4" />
            <path d="M 25 60 L 75 60 L 65 70 L 35 70 Z" fill="#f1c40f" />
          </g>
        ) : (
          <g>
            <ellipse cx="40" cy="50" rx="20" ry="25" fill="#27ae60" />
            <rect x="35" y="35" width="30" height="40" rx="10" fill="#f1c40f" />
            <rect x="38" y="40" width="24" height="30" rx="5" fill="#f39c12" />
            <g className="limb-l"><rect x="30" y="40" width="8" height="25" rx="4" fill="#2ecc71" /></g>
            <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="62" y="40" width="8" height="25" rx="4" fill="#2ecc71" /></g>
            <g className="limb-l"><rect x="38" y="70" width="8" height="20" rx="4" fill="#2ecc71" /></g>
            <g className="limb-r"><rect x="54" y="70" width="8" height="20" rx="4" fill="#2ecc71" /></g>
            <circle cx="50" cy="25" r="14" fill="#2ecc71" />
            <rect x="35" y="20" width="30" height="8" rx="2" fill="#e74c3c" />
            <path d="M 65 24 Q 75 20 80 26 Q 72 26 65 28 Z" fill="#e74c3c" />
            {(animation === 'happy' || animation === 'excited') ? (
              <g>
                <path d="M 40 25 Q 43 22 46 25" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 25 Q 57 22 60 25" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'sad' ? (
              <g>
                <path d="M 40 23 Q 43 22 46 26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 26 Q 57 22 60 23" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'angry' ? (
              <g>
                <path d="M 40 23 L 46 26" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 26 L 60 23" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <circle cx="43" cy="24" r="2" fill="#fff" />
                <circle cx="57" cy="24" r="2" fill="#fff" />
              </g>
            )}
            <path d="M 46 32 Q 50 35 54 32" fill="none" stroke="#000" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const PirateCaptain: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isWalking = animation === 'walk' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={isWalking ? "translate(0, -5)" : ""}>
          <path d="M 30 40 L 20 80 L 80 80 L 70 40 Z" fill="#8e44ad" />
          <rect x="40" y="40" width="20" height="25" fill="#fff" />
          <line x1="50" y1="40" x2="50" y2="65" stroke="#333" strokeWidth="1" />
          <g className="limb-l"><rect x="42" y="65" width="4" height="25" fill="#8e44ad" /><rect x="43" y="80" width="2" height="15" fill="#d35400" /></g>
          <g className="limb-r"><rect x="54" y="65" width="6" height="20" fill="#34495e" /><rect x="52" y="80" width="10" height="8" rx="2" fill="#000" /></g>
          <g className={animation === 'wave' ? 'arm-wave' : 'limb-l'}>
            <rect x="25" y="40" width="6" height="20" fill="#8e44ad" />
            <path d="M 28 60 Q 20 65 28 70 Q 30 65 25 65" fill="none" stroke="#bdc3c7" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="limb-r"><rect x="69" y="40" width="6" height="25" rx="3" fill="#8e44ad" /><circle cx="72" cy="65" r="3" fill="#f1c40f" /></g>
          <circle cx="50" cy="28" r="14" fill="#f1c40f" />
          <path d="M 25 15 Q 50 -5 75 15 Q 85 25 50 25 Q 15 25 25 15 Z" fill="#2c3e50" />
          <circle cx="44" cy="26" r="3" fill="#000" />
          <line x1="36" y1="20" x2="50" y2="30" stroke="#000" strokeWidth="1" />
          {(animation === 'happy' || animation === 'excited') ? (
            <path d="M 54 26 Q 57 23 60 26" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'sad' ? (
            <path d="M 54 26 Q 57 23 60 27" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'angry' ? (
            <path d="M 54 27 L 60 24" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <g>
              <circle cx="57" cy="26" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && <line x1="54" y1="27" x2="60" y2="27" stroke="#000" strokeWidth="2" />}
            </g>
          )}
          <path d="M 45 35 L 55 35 L 53 37 Z" fill="#000" />
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const ZombieGuy: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <rect x="35" y="45" width="30" height="35" rx="4" fill="#3498db" />
        <path d="M 35 75 L 40 70 L 45 78 L 50 70 L 60 80 L 65 75" fill="#3498db" />
        <g transform={(animation === 'walk' || animation === 'run') ? "rotate(-45 30 50)" : ""}>
          <rect x="15" y="45" width="25" height="8" rx="4" fill="#1abc9c" />
          <rect x="60" y="45" width="25" height="8" rx="4" fill="#1abc9c" />
        </g>
        <g className={animation === 'walk' || animation === 'run' ? 'limb-r' : 'limb-l'}><rect x="40" y="75" width="6" height="20" fill="#34495e" /></g>
        <g className={animation === 'walk' || animation === 'run' ? '' : 'limb-r'}><rect x="54" y="75" width="6" height="15" fill="#34495e" transform={animation === 'walk' || animation === 'run' ? "rotate(-15 54 75)" : ""} /></g>
        <circle cx="50" cy="30" r="15" fill="#1abc9c" />
        <path d="M 45 15 Q 50 10 55 15 Q 60 20 55 20 Q 50 22 45 20 Z" fill="#e74c3c" />
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 28 Q 43 25 46 28" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 28 Q 57 25 60 28" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 40 26 Q 43 25 46 30" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 30 Q 57 25 60 26" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 40 26 L 46 30" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 30 L 60 26" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="43" cy="28" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="43" cy="28" r="1" fill="#e74c3c" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="57" cy="30" r="2" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="40" y1="30" x2="46" y2="30" stroke="#2c3e50" strokeWidth="2" />
                <line x1="54" y1="30" x2="60" y2="30" stroke="#2c3e50" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        <path d="M 45 38 L 47 40 L 49 38 L 51 40 L 53 38 L 55 40" fill="none" stroke="#2c3e50" strokeWidth="1.5" />
      </svg>
    </BaseCharacter>
  );
};

export const CyberBot: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g className={animation === 'walk' || animation === 'run' ? 'limb-l' : ''}>
          <rect x="25" y="70" width="50" height="20" rx="10" fill="#7f8c8d" />
          <circle cx="35" cy="80" r="6" fill="#bdc3c7" />
          <circle cx="50" cy="80" r="6" fill="#bdc3c7" />
          <circle cx="65" cy="80" r="6" fill="#bdc3c7" />
          <path d="M 25 80 L 75 80" stroke="#34495e" strokeWidth="2" strokeDasharray="4 4" />
        </g>
        <path d="M 35 45 L 65 45 L 70 70 L 30 70 Z" fill="#2c3e50" />
        <rect x="40" y="50" width="20" height="15" fill="#e74c3c" className={animation === 'excited' ? 'animate-pulse' : ''} />
        <g className="limb-l"><rect x="20" y="45" width="8" height="20" rx="2" fill="#bdc3c7" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="72" y="45" width="8" height="20" rx="2" fill="#bdc3c7" /></g>
        <rect x="35" y="15" width="30" height="25" rx="5" fill="#bdc3c7" />
        <line x1="50" y1="15" x2="50" y2="5" stroke="#7f8c8d" strokeWidth="2" />
        <circle cx="50" cy="5" r="3" fill="#e74c3c" className="animate-pulse" />
        <rect x="38" y="22" width="24" height="10" rx="2" fill="#000" />
        {(animation === 'happy' || animation === 'excited') ? (
          <path d="M 40 27 Q 50 20 60 27" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : animation === 'sad' ? (
          <path d="M 40 25 Q 50 30 60 25" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : animation === 'angry' ? (
          <path d="M 40 24 L 50 28 L 60 24" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : (
          <g>
            <rect x="42" y="24" width="16" height="6" rx="3" fill="#e74c3c" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && <line x1="42" y1="27" x2="58" y2="27" stroke="#e74c3c" strokeWidth="2" />}
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const VampireLord: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isBat = animation === 'run' || animation === 'dance';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {isBat ? (
          <g transform="translate(0, 30)">
            <ellipse cx="50" cy="40" rx="15" ry="10" fill="#000" />
            <path d="M 35 40 Q 20 20 10 30 Q 25 45 35 40 Z" fill="#000" className="limb-l" />
            <path d="M 65 40 Q 80 20 90 30 Q 75 45 65 40 Z" fill="#000" className="limb-r" />
            <polygon points="45,35 48,25 50,30" fill="#000" />
            <polygon points="55,35 52,25 50,30" fill="#000" />
            <circle cx="45" cy="38" r="2" fill="#e74c3c" />
            <circle cx="55" cy="38" r="2" fill="#e74c3c" />
          </g>
        ) : (
          <g>
            <path d="M 30 30 L 10 90 L 90 90 L 70 30 Z" fill="#000" />
            <path d="M 35 30 L 20 85 L 80 85 L 65 30 Z" fill="#e74c3c" />
            <rect x="40" y="45" width="20" height="35" fill="#2c3e50" />
            <g className="limb-l"><rect x="35" y="45" width="6" height="25" fill="#2c3e50" /></g>
            <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="59" y="45" width="6" height="25" fill="#2c3e50" /></g>
            <g className="limb-l"><rect x="42" y="80" width="6" height="15" fill="#000" /></g>
            <g className="limb-r"><rect x="52" y="80" width="6" height="15" fill="#000" /></g>
            <circle cx="50" cy="30" r="14" fill="#ecf0f1" />
            <path d="M 36 30 Q 36 10 50 15 Q 64 10 64 30 L 60 20 Q 50 25 40 20 Z" fill="#000" />
            {(animation === 'happy' || animation === 'excited') ? (
              <g>
                <path d="M 42 28 Q 45 25 48 28" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 28 Q 55 25 58 28" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'sad' ? (
              <g>
                <path d="M 42 26 Q 45 25 48 30" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 30 Q 55 25 58 26" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'angry' ? (
              <g>
                <path d="M 42 26 L 48 30" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 30 L 58 26" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <circle cx="45" cy="28" r="2" fill="#c0392b" className={animation === 'sleep' ? 'opacity-0' : ''} />
                <circle cx="55" cy="28" r="2" fill="#c0392b" className={animation === 'sleep' ? 'opacity-0' : ''} />
                {animation === 'sleep' && (
                  <g>
                    <line x1="42" y1="28" x2="48" y2="28" stroke="#000" strokeWidth="2" />
                    <line x1="52" y1="28" x2="58" y2="28" stroke="#000" strokeWidth="2" />
                  </g>
                )}
              </g>
            )}
            <path d="M 46 35 Q 50 38 54 35" fill="none" stroke="#000" strokeWidth="1" />
            <polygon points="46,35 48,35 47,38" fill="#fff" />
            <polygon points="52,35 54,35 53,38" fill="#fff" />
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const GhostBoo: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isAngry = animation === 'angry' || animation === 'excited';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={animation === 'walk' || animation === 'run' ? 'translate(0, -5)' : ''} className="arm-wave">
          <path d={`M 30 40 Q 50 10 70 40 L 70 80 ${isAngry ? 'Q 65 90 60 80 Q 55 70 50 80 Q 45 90 40 80 Q 35 70 30 80' : 'Q 60 70 50 80 Q 40 90 30 80'} Z`} fill="#ecf0f1" opacity={isAngry ? "1" : "0.85"} />
          <path d="M 30 50 Q 20 40 15 50" fill="none" stroke="#ecf0f1" strokeWidth="6" strokeLinecap="round" className="limb-l" />
          <path d="M 70 50 Q 80 40 85 50" fill="none" stroke="#ecf0f1" strokeWidth="6" strokeLinecap="round" className={animation === 'wave' ? 'arm-wave' : 'limb-r'} />
          {(animation === 'happy' || animation === 'excited') ? (
            <g>
              <path d="M 40 33 Q 43 30 46 33" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 33 Q 57 30 60 33" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : animation === 'sad' ? (
            <g>
              <path d="M 40 31 Q 43 30 46 35" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 35 Q 57 30 60 31" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : animation === 'angry' ? (
            <g>
              <path d="M 40 31 L 46 35" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 35 L 60 31" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx="43" cy="35" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
              <circle cx="57" cy="35" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && (
                <g>
                  <line x1="40" y1="35" x2="46" y2="35" stroke="#2c3e50" strokeWidth="3" />
                  <line x1="54" y1="35" x2="60" y2="35" stroke="#2c3e50" strokeWidth="3" />
                </g>
              )}
            </g>
          )}
          {animation === 'talk' || animation === 'excited' ? (
            <ellipse cx="50" cy="48" rx="4" ry="6" fill="#2c3e50" />
          ) : animation === 'happy' ? (
            <path d="M 46 45 Q 50 50 54 45" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'sad' ? (
            <path d="M 46 48 Q 50 44 54 48" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <ellipse cx="50" cy="45" rx="3" ry="4" fill="#2c3e50" />
          )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const SamuraiWarrior: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isKneeling = animation === 'sleep';
  const drawSword = animation === 'excited' || animation === 'angry' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={isKneeling ? "translate(0, 15)" : ""}>
          {!drawSword && <line x1="20" y1="30" x2="80" y2="90" stroke="#7f8c8d" strokeWidth="4" />}
          <rect x="35" y="45" width="30" height="30" fill="#c0392b" />
          <line x1="35" y1="55" x2="65" y2="55" stroke="#922b21" strokeWidth="2" />
          <line x1="35" y1="65" x2="65" y2="65" stroke="#922b21" strokeWidth="2" />
          <g className={isKneeling ? "" : "limb-l"}><rect x="38" y="75" width="8" height={isKneeling ? "15" : "20"} fill="#34495e" transform={isKneeling ? "rotate(45 38 75)" : ""} /></g>
          <g className={isKneeling ? "" : "limb-r"}><rect x="54" y="75" width="8" height={isKneeling ? "15" : "20"} fill="#34495e" transform={isKneeling ? "rotate(-45 54 75)" : ""} /></g>
          <g className="limb-l"><rect x="25" y="45" width="8" height="25" rx="4" fill="#c0392b" /></g>
          <g className={animation === 'wave' ? 'arm-wave' : drawSword ? '' : 'limb-r'}>
            <rect x="67" y="45" width="8" height="25" rx="4" fill="#c0392b" transform={drawSword ? "rotate(-45 67 45)" : ""} />
            {drawSword && <line x1="71" y1="70" x2="90" y2="20" stroke="#bdc3c7" strokeWidth="4" />}
          </g>
          <circle cx="50" cy="30" r="14" fill="#f1c40f" />
          <path d="M 30 30 Q 50 10 70 30 L 65 35 L 35 35 Z" fill="#34495e" />
          <path d="M 45 15 L 40 5 L 48 10 Z" fill="#f1c40f" />
          <path d="M 55 15 L 60 5 L 52 10 Z" fill="#f1c40f" />
          <rect x="40" y="24" width="20" height="6" fill="#000" />
          {(animation === 'happy' || animation === 'excited') ? (
            <g>
              <path d="M 42 27 Q 45 25 48 27" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 27 Q 55 25 58 27" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : animation === 'sad' ? (
            <g>
              <path d="M 42 25 Q 45 25 48 28" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 28 Q 55 25 58 25" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : animation === 'angry' ? (
            <g>
              <path d="M 42 25 L 48 28" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 28 L 58 25" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx="45" cy="27" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
              <circle cx="55" cy="27" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && (
                <g>
                  <line x1="42" y1="27" x2="48" y2="27" stroke="#fff" strokeWidth="1" />
                  <line x1="52" y1="27" x2="58" y2="27" stroke="#fff" strokeWidth="1" />
                </g>
              )}
            </g>
          )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const Astronaut: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const zeroG = animation === 'walk' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={zeroG ? "arm-wave overflow-visible" : "body overflow-visible"}>
        <rect x="25" y="40" width="50" height="40" rx="5" fill="#bdc3c7" />
        <rect x="35" y="45" width="30" height="35" rx="10" fill="#fff" stroke="#ecf0f1" strokeWidth="2" />
        <g className="limb-l"><rect x="30" y="45" width="10" height="25" rx="5" fill="#fff" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="60" y="45" width="10" height="25" rx="5" fill="#fff" /></g>
        <g className="limb-l"><rect x="38" y="75" width="10" height="20" rx="5" fill="#fff" /></g>
        <g className="limb-r"><rect x="52" y="75" width="10" height="20" rx="5" fill="#fff" /></g>
        <circle cx="50" cy="30" r="18" fill="#fff" />
        <ellipse cx="50" cy="32" rx="12" ry="10" fill="#e67e22" opacity="0.8" />
        <ellipse cx="46" cy="28" rx="4" ry="3" fill="#fff" opacity="0.5" />
        {(animation === 'happy' || animation === 'excited') ? (
          <path d="M 45 35 Q 50 38 55 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : animation === 'sad' ? (
          <path d="M 45 36 Q 50 33 55 36" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : animation === 'angry' ? (
          <path d="M 45 35 L 55 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : (
          <path d="M 47 35 Q 50 36 53 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        )}
      </svg>
    </BaseCharacter>
  );
};

export const charactersMap: Record<string, React.FC<CharacterProps>> = {
  'jarvis-bot': JarvisBot,
  'pixel-fox': PixelFox,
  'space-cat': SpaceCat,
  'fire-drake': FireDrake,
  'ninja': Ninja,
  'wizard': Wizard,
  'cyber-punk': CyberPunk,
  'minion-bob': MinionBob,
  'space-bean': SpaceBean,
  'alien-dude': AlienDude,
  'spider-man': SpiderMan,
  'iron-hero': IronHero,
  'electric-mouse': ElectricMouse,
  'dark-knight': DarkKnight,
  'ninja-turtle': NinjaTurtle,
  'pirate-captain': PirateCaptain,
  'zombie-guy': ZombieGuy,
  'cyber-bot': CyberBot,
  'vampire-lord': VampireLord,
  'ghost-boo': GhostBoo,
  'samurai-warrior': SamuraiWarrior,
  'astronaut': Astronaut,
};

export const CustomCharacterRenderer: React.FC<CharacterProps & { character: CustomCharacter }> = ({ 
  animation = 'idle', 
  size = 80, 
  flipped = false,
  character
}) => {
  // Fallback to idle sprite if the requested animation doesn't have an uploaded sprite
  const spriteBase64 = character.sprites[animation] || character.sprites['idle'];

  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {spriteBase64 ? (
          <img 
            src={spriteBase64} 
            alt={character.name} 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <div className="text-muted-foreground text-xs flex items-center justify-center text-center p-2">
            No Sprite
          </div>
        )}
      </div>
    </BaseCharacter>
  );
};
