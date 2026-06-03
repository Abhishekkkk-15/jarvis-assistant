import React from 'react';
import './animations.css';

export type CharacterAnimation = 'idle' | 'walk' | 'run' | 'wave' | 'dance' | 'sleep' | 'excited' | 'talk';

export interface CharacterProps {
  animation: CharacterAnimation;
  size?: number;
  flipped?: boolean;
}

const BaseCharacter: React.FC<{
  size: number;
  flipped: boolean;
  animation: CharacterAnimation;
  children: React.ReactNode;
}> = ({ size, flipped, animation, children }) => {
  return (
    <div
      className={`relative inline-block anim-${animation}`}
      style={{
        width: size,
        height: size,
        transform: flipped ? 'scaleX(-1)' : 'scaleX(1)',
      }}
    >
      {animation === 'sleep' && (
        <div className="zzz-particles">
          <div className="absolute zzz-1">Z</div>
          <div className="absolute zzz-2">z</div>
          <div className="absolute zzz-3">Z</div>
        </div>
      )}
      {children}
    </div>
  );
};

export const JarvisBot: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {/* Antenna */}
        <line x1="50" y1="20" x2="50" y2="5" stroke="#0ff" strokeWidth="2" />
        <circle cx="50" cy="5" r="3" fill="#0ff" className={animation === 'excited' || animation === 'talk' ? 'animate-pulse' : ''} />
        {/* Head */}
        <rect x="35" y="20" width="30" height="25" rx="5" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        {/* Eyes */}
        <rect x="40" y="28" width="8" height="4" fill="#0ff" className={animation === 'sleep' ? 'opacity-20' : ''} />
        <rect x="52" y="28" width="8" height="4" fill="#0ff" className={animation === 'sleep' ? 'opacity-20' : ''} />
        {/* Body */}
        <rect x="30" y="45" width="40" height="35" rx="5" fill="#1a1a2e" stroke="#0ff" strokeWidth="2" />
        {/* Chest Core */}
        <circle cx="50" cy="62" r="8" fill="none" stroke="#0ff" strokeWidth="2" />
        <circle cx="50" cy="62" r="4" fill="#0ff" className={animation === 'talk' || animation === 'excited' ? 'animate-pulse' : ''} />
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

export const PixelFox: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
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
        <rect x="50" y="45" width="5" height="5" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        <rect x="70" y="45" width="5" height="5" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        {animation === 'sleep' && (
          <g>
            <rect x="48" y="47" width="9" height="2" fill="#000" />
            <rect x="68" y="47" width="9" height="2" fill="#000" />
          </g>
        )}
        <rect x="60" y="55" width="5" height="5" fill="#000" />
      </svg>
    </BaseCharacter>
  );
};

export const SpaceCat: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
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
        <circle cx="44" cy="30" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        <circle cx="56" cy="30" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        {animation === 'sleep' && (
          <g>
            <line x1="42" y1="31" x2="46" y2="31" stroke="#000" strokeWidth="2" />
            <line x1="54" y1="31" x2="58" y2="31" stroke="#000" strokeWidth="2" />
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
        <circle cx="42" cy="28" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        <circle cx="58" cy="28" r="3" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
        {animation === 'sleep' && (
          <g>
            <line x1="40" y1="29" x2="45" y2="29" stroke="#000" strokeWidth="2" />
            <line x1="55" y1="29" x2="60" y2="29" stroke="#000" strokeWidth="2" />
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

export const charactersMap: Record<string, React.FC<CharacterProps>> = {
  'jarvis-bot': JarvisBot,
  'pixel-fox': PixelFox,
  'space-cat': SpaceCat,
  'fire-drake': FireDrake,
};
