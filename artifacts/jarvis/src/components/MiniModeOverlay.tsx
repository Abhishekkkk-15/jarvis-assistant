import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { charactersMap, CharacterAnimation } from './characters/CharacterRenderer';
import { useLocation } from 'wouter';
import { Maximize2 } from 'lucide-react';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';

interface MiniModeOverlayProps {
  isMinimized: boolean;
  onOpen: () => void;
}

export const MiniModeOverlay: React.FC<MiniModeOverlayProps> = ({
  isMinimized,
  onOpen,
}) => {
  const [enabled] = useLocalStorage('miniModeEnabled', true);
  const [charId] = useLocalStorage('selectedCharacterId', 'jarvis-bot');
  const [posX, setPosX] = useLocalStorage('characterPositionX', window.innerWidth - 150);
  const [posY, setPosY] = useLocalStorage('characterPositionY', window.innerHeight - 150);

  // JARVIS global state
  const [isListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const [lastReply] = useLocalStorage('jarvisLastReply', '');

  const [animation, setAnimation] = useState<CharacterAnimation>('idle');
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [replyBubble, setReplyBubble] = useState('');
  const [showRestoreHint, setShowRestoreHint] = useState(false);
  
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const hasDragged = useRef(false);
  const [, setLocation] = useLocation();

  // Smart movement states
  const [isTrackingCursor, setIsTrackingCursor] = useState(false);
  const [movementStyle, setMovementStyle] = useState<'float' | 'dash' | 'jump'>('float');
  const cursorRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Physics states
  const [isPhysicsActive, setIsPhysicsActive] = useState(false);
  const [squash, setSquash] = useState({ x: 1, y: 1 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const physicsRaf = useRef<number | null>(null);

  // Audio Reactivity
  const isDancingToMusic = useAudioReactivity(40);

  const CharacterComponent = charactersMap[charId] || charactersMap['jarvis-bot'];

  // Show restore hint briefly when minimized
  useEffect(() => {
    if (isMinimized) {
      setShowRestoreHint(true);
      const t = setTimeout(() => setShowRestoreHint(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isMinimized]);

  // Speech bubble
  useEffect(() => {
    if (lastReply) {
      setReplyBubble(lastReply);
      const timer = setTimeout(() => setReplyBubble(''), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastReply]);

  // State animations
  useEffect(() => {
    if (isListening) setAnimation('excited');
    else if (isSpeaking) setAnimation('talk');
    else if (isDancingToMusic && !isDragging && !isPhysicsActive) setAnimation('dance');
    else if (!isDragging && !isPhysicsActive) setAnimation('idle');
  }, [isListening, isSpeaking, isDancingToMusic, isDragging, isPhysicsActive]);

  // Cursor tracking listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      if (isTrackingCursor && !isDragging && !isPhysicsActive && !isDancingToMusic) {
        setFlipped(e.clientX < posX);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isTrackingCursor, isDragging, isPhysicsActive, isDancingToMusic, posX]);

  // Randomize tracking state
  useEffect(() => {
    if (isDragging || isListening || isSpeaking || isPhysicsActive || isDancingToMusic) return;
    const trackingTimer = setInterval(() => {
      const startTracking = Math.random() > 0.7;
      setIsTrackingCursor(startTracking);
      if (startTracking) {
        setFlipped(cursorRef.current.x < posX);
        setTimeout(() => setIsTrackingCursor(false), 3000 + Math.random() * 4000);
      }
    }, 10000);
    return () => clearInterval(trackingTimer);
  }, [isDragging, isListening, isSpeaking, isPhysicsActive, isDancingToMusic, posX]);

  // Autonomous movement
  useEffect(() => {
    if (isDragging || isListening || isSpeaking || isPhysicsActive || isDancingToMusic) return;

    const idleTimer = setTimeout(() => {
      if (animation === 'idle' && !isTrackingCursor) setAnimation('sleep');
    }, 20000);

    const moveTimer = setInterval(() => {
      if (isTrackingCursor) return; 

      const maxX = window.innerWidth - 120;
      const maxY = window.innerHeight - 120;
      const newX = Math.max(0, Math.min(Math.random() * maxX, maxX));
      
      // If we have gravity, we want it to roam mostly along the bottom floor
      const isFloorRoaming = Math.random() > 0.3;
      const newY = isFloorRoaming ? maxY : Math.max(0, Math.min(Math.random() * maxY, maxY));
      
      const styles: ('float' | 'dash' | 'jump')[] = ['float', 'float', 'dash', 'jump'];
      const nextStyle = styles[Math.floor(Math.random() * styles.length)];
      setMovementStyle(nextStyle);
      
      setFlipped(newX < posX);
      setAnimation(nextStyle === 'dash' ? 'run' : 'walk');
      
      setPosX(newX);
      setPosY(newY);
      
      const duration = nextStyle === 'dash' ? 800 : (nextStyle === 'jump' ? 1200 : 2000);
      setTimeout(() => setAnimation('idle'), duration);
    }, 6000 + Math.random() * 6000);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(moveTimer);
    };
  }, [isDragging, isListening, isSpeaking, isTrackingCursor, isPhysicsActive, isDancingToMusic, posX, setPosX, setPosY, animation]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (physicsRaf.current) cancelAnimationFrame(physicsRaf.current);
    hasDragged.current = false;
    setIsDragging(true);
    setIsPhysicsActive(false);
    setSquash({ x: 1, y: 1 });
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: posX,
      initialY: posY,
    };
    lastMousePos.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velocity.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
      
      const now = performance.now();
      const dt = now - lastMousePos.current.time;
      if (dt > 0) {
        // Calculate velocity (pixels per ms)
        velocity.current = {
          x: (e.clientX - lastMousePos.current.x) / dt * 16, // scale to ~60fps frame delta
          y: (e.clientY - lastMousePos.current.y) / dt * 16
        };
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };
      
      setPosX(dragRef.current.initialX + dx);
      setPosY(dragRef.current.initialY + dy);
      setAnimation('wave');
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setAnimation('idle');
        
        // Start physics loop if dragged
        if (hasDragged.current) {
          setIsPhysicsActive(true);
          startPhysicsLoop(posX, posY);
        }
      }
    };
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, posX, posY]);

  const startPhysicsLoop = (startX: number, startY: number) => {
    let currentX = startX;
    let currentY = startY;
    const gravity = 1.2; // heavy gravity
    const bounce = 0.2; // sandbag bounce
    const friction = 0.98; // air resistance
    const floorY = window.innerHeight - 120;
    const rightX = window.innerWidth - 120;

    const loop = () => {
      velocity.current.y += gravity;
      velocity.current.x *= friction;
      velocity.current.y *= friction;

      currentX += velocity.current.x;
      currentY += velocity.current.y;

      let hitFloor = false;

      // Floor collision
      if (currentY >= floorY) {
        currentY = floorY;
        if (Math.abs(velocity.current.y) > 2) {
          velocity.current.y *= -bounce;
          hitFloor = true;
        } else {
          velocity.current.y = 0;
        }
        velocity.current.x *= 0.8; // ground friction
      }

      // Wall collisions
      if (currentX <= 0) {
        currentX = 0;
        velocity.current.x *= -bounce;
      } else if (currentX >= rightX) {
        currentX = rightX;
        velocity.current.x *= -bounce;
      }

      setPosX(currentX);
      setPosY(currentY);

      // Visual squash on impact
      if (hitFloor && Math.abs(velocity.current.y) > 3) {
        setSquash({ x: 1.2, y: 0.7 });
        setTimeout(() => setSquash({ x: 1, y: 1 }), 150);
      } else if (!hitFloor && Math.abs(velocity.current.y) > 10) {
        // Stretch while falling fast
        setSquash({ x: 0.9, y: 1.1 });
      } else if (!hitFloor) {
        setSquash({ x: 1, y: 1 });
      }

      // Stop condition
      if (currentY >= floorY && Math.abs(velocity.current.y) < 1 && Math.abs(velocity.current.x) < 1) {
        setIsPhysicsActive(false);
        setSquash({ x: 1, y: 1 });
        return;
      }

      physicsRaf.current = requestAnimationFrame(loop);
    };

    physicsRaf.current = requestAnimationFrame(loop);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  if (!enabled && !isMinimized) return null;

  const transitionStyle = isDragging || isPhysicsActive
    ? 'none' 
    : movementStyle === 'dash' 
      ? 'left 0.8s cubic-bezier(0.1, 0.9, 0.2, 1), top 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)'
      : movementStyle === 'jump'
        ? 'left 1.2s linear, top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        : 'left 2s ease-in-out, top 2s ease-in-out';

  const content = (
    <div
      className="fixed z-50 select-none touch-none"
      style={{
        left: posX,
        top: posY,
        width: 120,
        height: 120,
        transition: transitionStyle,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => { if (isMinimized && window.electronAPI) window.electronAPI.setIgnoreMouseEvents(false); }}
      onMouseLeave={() => { if (isMinimized && window.electronAPI) window.electronAPI.setIgnoreMouseEvents(true); }}
      onClick={() => {
        if (!hasDragged.current && !showContextMenu) onOpen();
      }}
    >
      {isMinimized && showRestoreHint && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 shadow-lg pointer-events-none">
          <Maximize2 size={11} /> Click to restore
        </div>
      )}

      {replyBubble && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 shadow-md text-xs max-w-[200px] truncate whitespace-nowrap z-10">
          {replyBubble}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-solid border-t-white border-t-8 border-x-transparent border-x-8 border-b-0" />
        </div>
      )}

      <div style={{ transform: `scale(${squash.x}, ${squash.y})`, transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
        <CharacterComponent animation={animation} size={120} flipped={flipped} />
      </div>

      {isMinimized && !showContextMenu && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-sm pointer-events-none">
          <Maximize2 size={11} className="text-white" />
        </div>
      )}

      {showContextMenu && (
        <div
          className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[60] overflow-hidden"
          onMouseLeave={() => setShowContextMenu(false)}
        >
          {isMinimized && (
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); onOpen(); }}
            >
              <Maximize2 size={14} /> Restore App
            </button>
          )}
          {!isMinimized && (
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); onOpen(); }}
            >
              Open Dashboard
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); setLocation('/characters'); if (isMinimized) onOpen(); }}
          >
            Change Character
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); setLocation('/settings'); if (isMinimized) onOpen(); }}
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};
