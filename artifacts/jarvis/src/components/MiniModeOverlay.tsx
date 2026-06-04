import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { charactersMap, CharacterAnimation, CustomCharacter, CustomCharacterRenderer } from './characters/CharacterRenderer';
import { useLocation } from 'wouter';
import { Maximize2 } from 'lucide-react';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';
import ReactMarkdown from 'react-markdown';

const TypewriterBubble: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(text.substring(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setIsDone(true);
      }
    }, 18); // typing speed

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div
      className="absolute bottom-[138px] left-1/2 -translate-x-1/2 z-10"
      style={{ width: 'clamp(200px, 320px, 90vw)' }}
    >
      <div className="relative bg-white/95 backdrop-blur-md text-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm border border-slate-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.12)] text-sm leading-relaxed max-h-[280px] overflow-y-auto break-words transition-all duration-300">
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
            li: ({ node, ...props }) => <li className="text-sm" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
            em: ({ node, ...props }) => <em className="italic text-slate-600" {...props} />,
            code: ({ node, ...props }) => <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
            h1: ({ node, ...props }) => <h1 className="text-base font-bold mb-1" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-sm font-bold mb-1" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mb-1" {...props} />,
            hr: () => <hr className="border-slate-200 my-1.5" />,
          }}
        >
          {displayedText}
        </ReactMarkdown>
        {!isDone && <span className="inline-block animate-pulse text-primary ml-0.5">▍</span>}
      </div>
      {/* Tail pointing down to character */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-solid border-t-white/95 border-t-8 border-x-transparent border-x-8 border-b-0 drop-shadow-sm" />
    </div>
  );
};

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
  const [toolsUsed, setToolsUsed] = useLocalStorage<string[]>('jarvisToolsUsed', []);
  const [customCharacters] = useLocalStorage<CustomCharacter[]>('jarvisCustomCharacters', []);

  // Clear tools after 4 seconds so they don't stay forever
  useEffect(() => {
    if (toolsUsed && toolsUsed.length > 0) {
      const timer = setTimeout(() => {
        setToolsUsed([]);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toolsUsed, setToolsUsed]);

  const [animation, setAnimation] = useState<CharacterAnimation>('idle');
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [replyBubble, setReplyBubble] = useState('');
  const [showRestoreHint, setShowRestoreHint] = useState(false);

  const [isDragHovering, setIsDragHovering] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const hasDragged = useRef(false);
  const [, setLocation] = useLocation();

  // Smart movement states
  const [isTrackingCursor, setIsTrackingCursor] = useState(false);
  const [movementStyle, setMovementStyle] = useState<'float' | 'dash' | 'jump' | 'teleport' | 'spin' | 'bounce' | 'zigzag' | 'crawl' | 'sneak' | 'cartwheel' | 'hover' | 'pace' | 'hide'>('float');
  const cursorRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Window Roaming
  const activeWindowRef = useRef<any>(null);
  const isWindowRoamingRef = useRef(false);

  // Attention Seeker Tracker
  const lastInteractionTime = useRef(Date.now());

  // Physics states
  const [isPhysicsActive, setIsPhysicsActive] = useState(false);
  const [squash, setSquash] = useState({ x: 1, y: 1 });
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const physicsRaf = useRef<number | null>(null);

  // Audio Reactivity
  const isDancingToMusic = useAudioReactivity(40);

  const isHoveringRef = useRef(false);

  const CharacterComponent = charactersMap[charId] || charactersMap['jarvis-bot'];

  // Sync mouse events for transparent window properly
  useEffect(() => {
    if (!isMinimized || !window.electronAPI) return;

    if (isDragging || showContextMenu || isHoveringRef.current) {
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      window.electronAPI.setIgnoreMouseEvents(true);
    }
  }, [isDragging, showContextMenu, isMinimized]);

  // Speech bubble
  useEffect(() => {
    if (lastReply) {
      setReplyBubble(lastReply);
      // Stay visible longer for long messages, min 4s, max 10s
      const readTime = Math.min(10000, Math.max(4000, lastReply.length * 60));
      const timer = setTimeout(() => setReplyBubble(''), readTime);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastReply]);

  // Show restore hint briefly when minimized
  useEffect(() => {
    if (isMinimized) {
      setShowRestoreHint(true);
      const t = setTimeout(() => setShowRestoreHint(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isMinimized]);

  // Handle custom LLM action tags
  useEffect(() => {
    const handleJarvisAction = (e: any) => {
      const { action } = e.detail;
      if (action) {
        // We know action is one of CharacterAnimation because we instructed the LLM
        setAnimation(action as CharacterAnimation);
        
        // Also map some tags to movement styles if applicable
        if (['dash', 'jump', 'teleport', 'spin', 'bounce', 'zigzag', 'crawl', 'sneak', 'cartwheel', 'hover'].includes(action)) {
          setMovementStyle(action as any);
        }
        
        // Reset back to idle/float after 4 seconds
        setTimeout(() => {
          setAnimation('idle');
          setMovementStyle('float');
        }, 4000);
      }
    };
    window.addEventListener('jarvis-action', handleJarvisAction);
    return () => window.removeEventListener('jarvis-action', handleJarvisAction);
  }, []);

  // State animations
  useEffect(() => {
    if (isListening) setAnimation('excited');
    else if (isSpeaking && animation === 'idle') setAnimation('talk');
    else if (isDancingToMusic && !isDragging && !isPhysicsActive && animation === 'idle') setAnimation('dance');
  }, [isListening, isSpeaking, isDancingToMusic, isDragging, isPhysicsActive, animation]);

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

      let maxX = window.innerWidth - 120;
      let minX = 0;
      let newY;

      const maxY = window.innerHeight - 120;
      // If we have gravity, we want it to roam mostly along the bottom floor
      const isFloorRoaming = Math.random() > 0.3;
      newY = isFloorRoaming ? maxY : Math.max(0, Math.min(Math.random() * maxY, maxY));

      const newX = Math.max(minX, Math.min(minX + Math.random() * (maxX - minX), maxX));

      const styles: ('float' | 'dash' | 'jump' | 'teleport' | 'spin' | 'bounce' | 'zigzag' | 'crawl' | 'sneak' | 'cartwheel' | 'hover' | 'pace' | 'hide')[] = ['float', 'float', 'dash', 'jump', 'teleport', 'spin', 'bounce', 'zigzag', 'crawl', 'sneak', 'cartwheel', 'hover', 'pace', 'hide'];
      const nextStyle = styles[Math.floor(Math.random() * styles.length)];
      setMovementStyle(nextStyle);

      setFlipped(newX < posX);

      if (nextStyle === 'dash') setAnimation('run');
      else if (nextStyle === 'sneak') setAnimation('walk');
      else if (nextStyle === 'crawl') { setAnimation('walk'); setSquash({ x: 1.2, y: 0.6 }); setTimeout(() => setSquash({ x: 1, y: 1 }), 2000); }
      else if (nextStyle === 'spin') { setAnimation('idle'); setRotation(720); setTimeout(() => setRotation(0), 1000); }
      else if (nextStyle === 'cartwheel') { setAnimation('run'); setRotation(1080); setTimeout(() => setRotation(0), 1500); }
      else if (nextStyle === 'bounce') { setAnimation('happy'); }
      else if (nextStyle === 'teleport') {
        setAnimation('idle');
        setOpacity(0);
        setTimeout(() => { setPosX(newX); setPosY(newY); setOpacity(1); }, 400);
      }
      else setAnimation('walk');

      if (nextStyle !== 'teleport') {
        setPosX(newX);
        setPosY(newY);
      }

      const duration = nextStyle === 'dash' ? 800 : (nextStyle === 'jump' ? 1200 : 2000);
      setTimeout(() => setAnimation('idle'), duration);
    }, 6000 + Math.random() * 6000);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(moveTimer);
    };
  }, [isDragging, isListening, isSpeaking, isTrackingCursor, isPhysicsActive, isDancingToMusic, posX, setPosX, setPosY, animation]);

  useEffect(() => {
    // Reset timer when Jarvis state changes (e.g. finishes speaking/listening)
    lastInteractionTime.current = Date.now();
  }, [isListening, isSpeaking]);

  // Attention Seeker logic (15 minutes of inactivity)
  useEffect(() => {
    if (isDragging || isListening || isSpeaking || !isMinimized) return;
    const attentionTimer = setInterval(async () => {
      if (Date.now() - lastInteractionTime.current > 1 * 60 * 1000) {
        // Trigger attention seeker!
        setAnimation('jealous');
        lastInteractionTime.current = Date.now(); // reset timer so it doesn't spam
        if (window.electronAPI) {
          const imageBase64 = await window.electronAPI.captureScreen();
          if (imageBase64) {
            window.dispatchEvent(new CustomEvent('jarvis-send-message', {
              detail: { message: "IGNORE PREVIOUS CONTEXT. I have been ignoring you for 15 minutes. Look at my screen and say something very jealous, sassy, or fun to grab my attention! Keep it to 1 sentence.", imageBase64 }
            }));
          }
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(attentionTimer);
  }, [isDragging, isListening, isSpeaking, isMinimized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    lastInteractionTime.current = Date.now();
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
      setAnimation('hang');
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
      let hitWall = false;
      if (currentX <= 0) {
        currentX = 0;
        velocity.current.x *= -bounce;
        hitWall = true;
      } else if (currentX >= rightX) {
        currentX = rightX;
        velocity.current.x *= -bounce;
        hitWall = true;
      }

      setPosX(currentX);
      setPosY(currentY);

      // Angry if dropped or thrown very hard against floor or walls
      if ((hitFloor && Math.abs(velocity.current.y) > 12) || (hitWall && Math.abs(velocity.current.x) > 12)) {
        setAnimation('angry');
        setTimeout(() => {
          setAnimation((prev) => prev === 'angry' ? 'idle' : prev);
        }, 3000); // clear anger after 3s
      }

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragHovering) setIsDragHovering(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragHovering(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragHovering(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check if it's likely a text/code file
    // Some files have empty type but are text (e.g. .md, .ts)
    // We'll just try to read it as text. If it fails or is massive, we can handle it.
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setAnimation('confused');
      setReplyBubble("Whoa, that file is too big for me to eat right now!");
      const timer = setTimeout(() => setReplyBubble(''), 4000);
      return;
    }

    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      setAnimation('confused');
      setReplyBubble("I can't read media files yet! Try dropping a text or code file on me.");
      const timer = setTimeout(() => setReplyBubble(''), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setAnimation('happy');
        const message = `I just dropped a file named \`${file.name}\`. Here are the contents:\n\n\`\`\`\n${content}\n\`\`\``;
        window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message } }));
      } else {
        setAnimation('confused');
      }
    };
    reader.onerror = () => {
      setAnimation('confused');
    };
    reader.readAsText(file);
  };

  if (!enabled && !isMinimized) return null;

  const transitionStyle = isDragging || isPhysicsActive || movementStyle === 'teleport'
    ? 'none'
    : movementStyle === 'dash'
      ? 'left 0.8s cubic-bezier(0.1, 0.9, 0.2, 1), top 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)'
      : movementStyle === 'jump' || movementStyle === 'bounce'
        ? 'left 1.2s linear, top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        : movementStyle === 'spin' || movementStyle === 'cartwheel'
          ? 'left 1.5s ease-in-out, top 1.5s ease-in-out'
          : movementStyle === 'zigzag'
            ? 'left 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55), top 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)'
            : movementStyle === 'sneak' || movementStyle === 'crawl'
              ? 'left 4s linear, top 4s linear'
              : movementStyle === 'pace'
                ? 'left 1s cubic-bezier(0.25, 1, 0.5, 1), top 1s cubic-bezier(0.25, 1, 0.5, 1)'
                : 'left 2s ease-in-out, top 2s ease-in-out';

  const content = (
    <div
      className="fixed z-50 select-none touch-none"
      style={{
        left: posX,
        top: posY,
        width: 120,
        height: 120,
        opacity: opacity,
        transition: transitionStyle === 'none' ? 'opacity 0.4s ease-in-out' : `${transitionStyle}, opacity 0.4s ease-in-out`,
        cursor: isDragging ? 'grabbing' : 'grab',
        filter: isDragHovering ? 'brightness(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.8))' : 'none',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={() => {
        if (!showContextMenu && isMinimized) onOpen();
      }}
      onMouseEnter={() => {
        isHoveringRef.current = true;
        lastInteractionTime.current = Date.now();
        if (isMinimized && window.electronAPI) window.electronAPI.setIgnoreMouseEvents(false);
      }}
      onMouseLeave={() => {
        isHoveringRef.current = false;
        if (isMinimized && window.electronAPI && !isDragging && !showContextMenu) {
          window.electronAPI.setIgnoreMouseEvents(true);
        }
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!hasDragged.current && !showContextMenu) {
          // Pet the character
          setAnimation('happy');
          setTimeout(() => setAnimation('idle'), 2000);
        }
      }}
    >
      {isMinimized && showRestoreHint && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 shadow-lg pointer-events-none">
          <Maximize2 size={11} /> Click to restore
        </div>
      )}

      {replyBubble && (
        <TypewriterBubble text={replyBubble} />
      )}

      {/* Accessories / Props */}
      {toolsUsed && toolsUsed.length > 0 && (
        <div className="absolute -top-4 -right-4 z-10 drop-shadow-md animate-bounce">
          {toolsUsed.includes('get_weather') && <span className="text-4xl">☂️</span>}
          {toolsUsed.includes('search_web') && <span className="text-4xl">🔍</span>}
          {toolsUsed.includes('calculate') && <span className="text-4xl">🧮</span>}
          {toolsUsed.includes('run_command') && <span className="text-4xl">💻</span>}
          {toolsUsed.includes('read_file') && <span className="text-4xl">📄</span>}
          {toolsUsed.includes('open_app') && <span className="text-4xl">🚀</span>}
          {toolsUsed.includes('open_website') && <span className="text-4xl">🌐</span>}
        </div>
      )}

      <div style={{ transform: `scale(${squash.x}, ${squash.y}) rotate(${rotation}deg)`, transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
        {charId.startsWith('custom-') ? (() => {
          const customChar = customCharacters.find(c => c.id === charId);
          if (customChar) {
            return <CustomCharacterRenderer character={customChar} animation={animation} size={120} flipped={flipped} />;
          }
          return <CharacterComponent animation={animation} size={120} flipped={flipped} />;
        })() : (
          <CharacterComponent animation={animation} size={120} flipped={flipped} />
        )}
      </div>

      {isMinimized && !showContextMenu && (
        <button
          className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary hover:bg-primary/90 transition-colors rounded-full flex items-center justify-center shadow-md cursor-pointer z-50"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          title="Restore Application"
        >
          <Maximize2 size={12} className="text-white" />
        </button>
      )}

      {showContextMenu && (
        <div
          className={`absolute left-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[60] overflow-hidden ${posY > window.innerHeight - 200 ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
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
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={async (e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              setAnimation('excited');
              setReplyBubble('Analyzing screen...');
              if (window.electronAPI) {
                const imageBase64 = await window.electronAPI.captureScreen();
                if (imageBase64) {
                  window.dispatchEvent(new CustomEvent('jarvis-send-message', {
                    detail: { message: "What am I looking at right now?", imageBase64 }
                  }));
                } else {
                  setAnimation('confused');
                  setReplyBubble('Failed to capture screen.');
                  setTimeout(() => setReplyBubble(''), 3000);
                }
              }
            }}
          >
            👁️ Analyze Screen
          </button>
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
