import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { charactersMap, CharacterAnimation, CustomCharacter, CustomCharacterRenderer } from './characters/CharacterRenderer';
import { useLocation } from 'wouter';
import { Maximize2 } from 'lucide-react';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCharacterPersonality } from '@/hooks/useCharacterPersonality';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import { useRelationshipEngine } from '@/hooks/useRelationshipEngine';
import { useRoutineEngine } from '@/hooks/useRoutineEngine';

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
  const [posY, setPosY] = useLocalStorage('characterPositionY', window.innerHeight - 145);
  const [autonomousMode] = useLocalStorage('jarvisAutonomousMode', false);

  // JARVIS global state
  const [isListening] = useLocalStorage('jarvisIsListening', false);
  const [isSpeaking] = useLocalStorage('jarvisIsSpeaking', false);
  const [isProcessing] = useLocalStorage('jarvisIsProcessing', false);
  const [lastReply] = useLocalStorage('jarvisLastReply', '');
  const [toolsUsed, setToolsUsed] = useLocalStorage<string[]>('jarvisToolsUsed', []);
  const [customCharacters] = useLocalStorage<CustomCharacter[]>('jarvisCustomCharacters', []);
  const [notificationMsg, setNotificationMsg] = useState<{ title: string; message: string } | null>(null);

  // Clear tools after 4 seconds so they don't stay forever
  useEffect(() => {
    if (toolsUsed && toolsUsed.length > 0) {
      const timer = setTimeout(() => {
        setToolsUsed([]);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toolsUsed, setToolsUsed]);

  const [baseAnimation, setBaseAnimation] = useState<CharacterAnimation>('idle');
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

  // Personality Hook (Blinking, microexpressions, sentiment emotion)
  const personality = useCharacterPersonality();

  // Physics states
  const [isPhysicsActive, setIsPhysicsActive] = useState(false);
  const [squash, setSquash] = useState({ x: 1, y: 1 });
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const physicsRaf = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Wandering state
  const isWanderingRef = useRef(false);
  const [propHeld, setPropHeld] = useState<string | null>(null);

  // Initialize the Vision Engine
  useVisionEngine();

  // Initialize Relationship Engine
  const { mood, interact, setNeglectedForTesting } = useRelationshipEngine();

  // Initialize Routine Engine
  const { phase } = useRoutineEngine();

  // Audio Reactivity
  const isDancingToMusic = useAudioReactivity(40);

  const isHoveringRef = useRef(false);

  const { activeApproval, agentQuestion, resolveApproval, clearQuestion } = useWebSocket();

  const CharacterComponent = charactersMap[charId] || charactersMap['jarvis-bot'];

  // Derived animation state (Overrides base movement animation with emotions/listening state)
  const animation = isListening
    ? 'excited'
    : (baseAnimation === 'courier'
      ? 'courier'
      : (personality.emotionAnimation
        ? personality.emotionAnimation
        : (isDancingToMusic && !isDragging && !isPhysicsActive ? 'dance' : baseAnimation)));

  // Sync transparent window mouse events dynamically for drag and drop support
  useEffect(() => {
    if (!isMinimized || !window.electronAPI || typeof window.electronAPI.updateOverlayRect !== 'function') return;

    if (isDragging || showContextMenu) {
      window.electronAPI.updateOverlayRect(null);
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      // Character is 120x120 by default. Add some padding for safety.
      window.electronAPI.updateOverlayRect({ x: posX - 10, y: posY - 10, width: 140, height: 140 });
    }
    
    return () => {
      if (window.electronAPI && typeof window.electronAPI.updateOverlayRect === 'function') {
        window.electronAPI.updateOverlayRect(null);
      }
    };
  }, [isDragging, showContextMenu, isMinimized, posX, posY]);

  // Speech bubble
  const initialMountRef = useRef(true);
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (lastReply) {
      setReplyBubble(lastReply);
      personality.triggerEmotion(lastReply);
      // Stay visible longer for long messages, min 4s, max 10s
      const readTime = Math.min(10000, Math.max(4000, lastReply.length * 60));
      const timer = setTimeout(() => setReplyBubble(''), readTime);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastReply]);

  // System Notifications
  useEffect(() => {
    const handleSystemNotification = (e: any) => {
      const data = e.detail;
      setNotificationMsg(data);
      setIsPhysicsActive(false);
      setPosX(window.innerWidth / 2 - 60);
      setPosY(window.innerHeight / 2 - 60);
      setBaseAnimation('courier');
      const say = `Notification from ${data.title}: ${data.message}`;
      window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: say } }));
      setTimeout(() => {
        setNotificationMsg(null);
        setBaseAnimation('idle');
        if (!autonomousMode) setIsPhysicsActive(true);
      }, Math.max(5000, say.length * 80));
    };
    window.addEventListener('jarvis-system-notification', handleSystemNotification);

    // Autonomous Proactive Speech
    const handleAutonomousSpeech = (e: any) => {
      const { text } = e.detail;
      if (!text) return;

      setReplyBubble(text);
      personality.triggerEmotion(text);
      window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text } }));

      const readTime = Math.min(10000, Math.max(4000, text.length * 60));
      setTimeout(() => setReplyBubble(''), readTime);
    };
    window.addEventListener('jarvis-autonomous-speech', handleAutonomousSpeech);

    return () => {
      window.removeEventListener('jarvis-system-notification', handleSystemNotification);
      window.removeEventListener('jarvis-autonomous-speech', handleAutonomousSpeech);
    };
  }, [autonomousMode, personality]);

  // Show restore hint briefly when minimized
  useEffect(() => {
    if (isMinimized) {
      setShowRestoreHint(true);
      const t = setTimeout(() => setShowRestoreHint(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isMinimized]);

  // Initial Boot Greeting based on Mood
  useEffect(() => {
    if (!enabled) return;

    // Slight delay so the character has time to render
    const t = setTimeout(() => {
      let greeting = '';
      let anim = 'happy';

      if (mood === 'Neglected') {
        greeting = "Oh... you finally remembered I exist.";
        anim = 'sad';
      } else if (mood === 'Best Friends') {
        greeting = "Welcome back! I missed you so much!";
        anim = 'excited';
      } else if (mood === 'Friendly') {
        greeting = "Hey there! Ready to get to work?";
        anim = 'happy';
      } else {
        greeting = "Hello.";
        anim = 'idle';
      }

      personality.triggerDirectEmotion(anim as any, 5000);
      window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: greeting } }));

      // Expose test function to window for the user to try
      (window as any).testNeglect = setNeglectedForTesting;
    }, 1500);

    return () => clearTimeout(t);
  }, [enabled, mood]);

  // Handle custom LLM action tags
  useEffect(() => {
    const handleJarvisAction = (e: any) => {
      const { action, path } = e.detail;

      if (action === 'draw' && path) {
        // Trigger LLM path drawing!
        setBaseAnimation('draw');
        setIsPhysicsActive(false);
        setIsTrackingCursor(false);
        setMovementStyle('float');

        const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathNode.setAttribute('d', path);
        const length = pathNode.getTotalLength();
        if (length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate scale and centering offsets
        const bbox = pathNode.getBBox();
        const targetSize = Math.min(window.innerWidth, window.innerHeight) * 0.6; // 60% of screen size
        const scale = bbox.width > 0 ? Math.min(targetSize / bbox.width, targetSize / bbox.height) : 1;
        const offsetX = (window.innerWidth - bbox.width * scale) / 2 - bbox.x * scale;
        const offsetY = (window.innerHeight - bbox.height * scale) / 2 - bbox.y * scale;

        const colors = [
          { stroke: '#3b82f6', shadow: '#60a5fa' }, // blue
          { stroke: '#ef4444', shadow: '#f87171' }, // red
          { stroke: '#10b981', shadow: '#34d399' }, // green
          { stroke: '#8b5cf6', shadow: '#a78bfa' }, // purple
          { stroke: '#f59e0b', shadow: '#fbbf24' }, // orange
          { stroke: '#ec4899', shadow: '#f472b6' }, // pink
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const originalPath = new Path2D(path);

        const duration = Math.max(3000, length * 5); // 5ms per pixel, min 3s
        const startTime = performance.now();

        const animateDraw = (time: number) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentLength = progress * length;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          ctx.translate(offsetX, offsetY);
          ctx.scale(scale, scale);

          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 6 / scale; // Keep relative line width consistent
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = color.shadow;
          ctx.shadowBlur = 8 / scale;

          ctx.setLineDash([length]);
          ctx.lineDashOffset = length - currentLength;

          ctx.stroke(originalPath);
          ctx.restore();

          const rawPoint = pathNode.getPointAtLength(currentLength);
          const drawX = rawPoint.x * scale + offsetX;
          const drawY = rawPoint.y * scale + offsetY;

          // Update character position to match the drawing point
          // The pencil is on the right side of the character (about +60x, +60y from top-left)
          const newX = drawX - 120; // 120 is the character width, pencil is on right
          const newY = drawY - 60;
          setPosX(newX);
          setPosY(newY);

          if (progress < 1) {
            requestAnimationFrame(animateDraw);
          } else {
            setTimeout(() => {
              setBaseAnimation('idle');
              if (!autonomousMode) setIsPhysicsActive(true);
            }, 1000);

            // Fade out masterpiece after 10 seconds
            setTimeout(() => {
              if (canvas) {
                canvas.style.transition = 'opacity 2s ease';
                canvas.style.opacity = '0';
                setTimeout(() => {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  canvas.style.opacity = '1';
                  canvas.style.transition = 'none';
                }, 2000);
              }
            }, 10000);
          }
        };
        requestAnimationFrame(animateDraw);

      } else if (action) {
        // Direct override of emotion
        personality.triggerDirectEmotion(action as CharacterAnimation, 4000);

        // Also map some tags to movement styles if applicable
        if (['dash', 'jump', 'teleport', 'spin', 'bounce', 'zigzag', 'crawl', 'sneak', 'cartwheel', 'hover', 'pace'].includes(action)) {
          setMovementStyle(action as any);

          // Apply physical transformations
          if (action === 'spin') { setRotation(720); setTimeout(() => setRotation(0), 1000); }
          else if (action === 'cartwheel') { setRotation(1080); setTimeout(() => setRotation(0), 1500); }
          else if (action === 'crawl') { setSquash({ x: 1.2, y: 0.6 }); setTimeout(() => setSquash({ x: 1, y: 1 }), 2000); }

          // Calculate a random nearby destination for the movement
          const maxX = window.innerWidth - 100;
          const maxY = window.innerHeight - 100;
          const newX = Math.max(0, Math.min(maxX, posX + (Math.random() - 0.5) * 400));
          const newY = Math.max(0, Math.min(maxY, posY + (Math.random() - 0.5) * 400));

          setFlipped(newX < posX);

          if (action === 'teleport') {
            setOpacity(0);
            setTimeout(() => { setPosX(newX); setPosY(newY); setOpacity(1); }, 400);
          } else if (action === 'hover' || action === 'spin' || action === 'cartwheel') {
            // Stay in place for stationary physics
          } else {
            setPosX(newX);
            setPosY(newY);
          }
        }

        // Reset movement back to float after execution
        setTimeout(() => {
          setMovementStyle('float');
        }, action === 'crawl' || action === 'sneak' ? 4000 : 2000);
      }
    };
    window.addEventListener('jarvis-action', handleJarvisAction);
    return () => window.removeEventListener('jarvis-action', handleJarvisAction);
  }, [posX, posY, autonomousMode]);

  // Cursor tracking listener & Global Idle
  useEffect(() => {
    let idleTimeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
      if (isTrackingCursor && !isDragging && !isPhysicsActive && !isDancingToMusic && !isProcessing) {
        setFlipped(e.clientX < posX);
      }

      // Wake up from sleep if mouse moves globally
      if (baseAnimation === 'sleep' && !isProcessing) {
        if (phase === 'Night') {
          // Groggy wake up
          setBaseAnimation('sad');
          window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: "Ugh... let me sleep... it's the middle of the night..." } }));
        } else {
          setBaseAnimation('idle');
        }
      }

      // Reset global idle timer
      clearTimeout(idleTimeout);
      const sleepDelay = phase === 'Night' ? 10 * 1000 : 5 * 60 * 1000;
      idleTimeout = setTimeout(() => {
        if (!isDragging && !isListening && !isSpeaking && !isPhysicsActive && !isDancingToMusic && !isProcessing) {
          setBaseAnimation('sleep');
        }
      }, sleepDelay);
    };

    window.addEventListener('mousemove', handleMouseMove);

    const initialSleepDelay = phase === 'Night' ? 10 * 1000 : 1 * 60 * 1000;
    idleTimeout = setTimeout(() => {
      if (!isDragging && !isListening && !isSpeaking && !isPhysicsActive && !isDancingToMusic && !isProcessing) {
        setBaseAnimation('sleep');
      }
    }, initialSleepDelay);

    // If it's night, force sleep immediately if we are idle
    if (phase === 'Night' && baseAnimation === 'idle') {
      setBaseAnimation('sleep');
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(idleTimeout);
    };
  }, [isTrackingCursor, isDragging, isPhysicsActive, isDancingToMusic, posX, baseAnimation, isListening, isSpeaking, isProcessing, phase]);

  // Handle thinking state
  useEffect(() => {
    if (isProcessing) {
      setBaseAnimation('thinking');
    } else if (baseAnimation === 'thinking') {
      setBaseAnimation('idle');
    }
  }, [isProcessing]);

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
    if (autonomousMode || isDragging || isListening || isSpeaking || isPhysicsActive || isDancingToMusic) return;

    const idleTimer = setTimeout(() => {
      if (baseAnimation === 'idle' && !isTrackingCursor) setBaseAnimation('sleep');
    }, 20000);

    const moveTimer = setInterval(() => {
      if (isTrackingCursor) return;
      if (baseAnimation !== 'idle' && baseAnimation !== 'sleep') return;

      const maxX = window.innerWidth - 120;
      const maxY = window.innerHeight - 120;

      // Calculate a local roaming destination (200px to 600px away for bigger movements)
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 400;

      let newX = Math.max(0, Math.min(maxX, posX + Math.cos(angle) * distance));
      let newY = Math.max(0, Math.min(maxY, posY + Math.sin(angle) * distance));

      // 20% chance to occasionally drop to the taskbar/bottom of screen to hang out
      if (Math.random() > 0.8) {
        newY = maxY;
      }

      const styles: ('float' | 'dash' | 'jump' | 'teleport' | 'spin' | 'bounce' | 'zigzag' | 'crawl' | 'sneak' | 'cartwheel' | 'hover' | 'pace' | 'hide')[] = ['float', 'float', 'dash', 'jump', 'teleport', 'spin', 'bounce', 'zigzag', 'crawl', 'sneak', 'cartwheel', 'hover', 'pace', 'hide'];
      const nextStyle = styles[Math.floor(Math.random() * styles.length)];
      setMovementStyle(nextStyle);

      if (nextStyle === 'sneak') {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { newX = -60; newY = Math.max(0, Math.min(maxY, Math.random() * maxY)); } // Left
        else if (edge === 1) { newX = window.innerWidth - 60; newY = Math.max(0, Math.min(maxY, Math.random() * maxY)); } // Right
        else if (edge === 2) { newY = -60; newX = Math.max(0, Math.min(maxX, Math.random() * maxX)); } // Top
        else { newY = window.innerHeight - 60; newX = Math.max(0, Math.min(maxX, Math.random() * maxX)); } // Bottom
      }

      setFlipped(newX < posX);

      if (nextStyle === 'dash') setBaseAnimation('dash');
      else if (nextStyle === 'sneak') setBaseAnimation('sneak');
      else if (nextStyle === 'crawl') { setBaseAnimation('crawl'); setSquash({ x: 1.2, y: 0.6 }); setTimeout(() => setSquash({ x: 1, y: 1 }), 2000); }
      else if (nextStyle === 'spin') { setBaseAnimation('spin'); setRotation(720); setTimeout(() => setRotation(0), 1000); }
      else if (nextStyle === 'cartwheel') { setBaseAnimation('cartwheel'); setRotation(1080); setTimeout(() => setRotation(0), 1500); }
      else if (nextStyle === 'bounce') { setBaseAnimation('bounce'); }
      else if (nextStyle === 'jump') { setBaseAnimation('jump'); }
      else if (nextStyle === 'teleport') {
        setBaseAnimation('teleport');
        setOpacity(0);
        setTimeout(() => { setPosX(newX); setPosY(newY); setOpacity(1); }, 400);
      }
      else setBaseAnimation('walk');

      if (nextStyle !== 'teleport') {
        setPosX(newX);
        setPosY(newY);
      }

      const duration = nextStyle === 'dash' ? 800 : (nextStyle === 'jump' ? 1200 : (nextStyle === 'sneak' || nextStyle === 'crawl' ? 4000 : 2000));
      setTimeout(() => setBaseAnimation('idle'), duration);
    }, 1500 + Math.random() * 2000); // move every 1.5 to 3.5 seconds (SUPER HYPERACTIVE)

    return () => {
      clearTimeout(idleTimer);
      clearInterval(moveTimer);
    };
  }, [autonomousMode, isDragging, isListening, isSpeaking, isTrackingCursor, isPhysicsActive, isDancingToMusic, posX, setPosX, setPosY, baseAnimation]);

  useEffect(() => {
    // Reset timer when Jarvis state changes (e.g. finishes speaking/listening)
    lastInteractionTime.current = Date.now();
  }, [isListening, isSpeaking]);

  // Attention Seeker logic (15 minutes of inactivity)
  useEffect(() => {
    if (isDragging || isListening || isSpeaking || !isMinimized) return;

    const checkAttention = async (force = false) => {
      if (force || Date.now() - lastInteractionTime.current > 15 * 60 * 1000) {
        const actionType = Math.floor(Math.random() * 3);

        if (actionType === 0) {
          // 1. Trigger clumsy tumble
          setBaseAnimation('dizzy');
          setMovementStyle('spin');
          setIsPhysicsActive(true);
          velocity.current = { x: (Math.random() - 0.5) * 40, y: -20 }; // Toss up wildly
          startPhysicsLoop(posX, posY);
        } else if (actionType === 1) {
          // 2. Draw attention animation on canvas
          const canvas = canvasRef.current;
          if (canvas) {
            // ensure canvas is sized properly to screen
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.strokeStyle = '#e74c3c';
              ctx.lineWidth = 12;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 10;

              // Draw a big question mark near the character
              const startX = posX - 40;
              const startY = posY - 40;

              let progress = 0;
              const drawQMark = () => {
                progress += 0.04;
                if (progress > 1.2) {
                  // Fade out after 4 seconds
                  setTimeout(() => {
                    if (canvas) {
                      canvas.style.transition = 'opacity 1s ease';
                      canvas.style.opacity = '0';
                      setTimeout(() => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        canvas.style.opacity = '1';
                        canvas.style.transition = 'none';
                      }, 1000);
                    }
                  }, 4000);
                  return;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();

                // Top curve
                if (progress > 0) ctx.arc(startX, startY, 50, Math.PI, Math.PI * (1 + Math.min(progress, 0.5) * 2));
                // Stem
                if (progress > 0.5) {
                  ctx.moveTo(startX + 50, startY);
                  ctx.lineTo(startX + 50, startY + 40 + Math.min((progress - 0.5) * 2, 1) * 30);
                }
                // Dot
                if (progress > 1) {
                  ctx.moveTo(startX + 50, startY + 100);
                  ctx.arc(startX + 50, startY + 100, 3, 0, Math.PI * 2);
                }
                ctx.stroke();

                requestAnimationFrame(drawQMark);
              };
              drawQMark();
            }
          }
        } else {
          // 3. Jealous/clumsy LLM screen capture
          setBaseAnimation('jealous'); // Give some visual feedback
          if (window.electronAPI) {
            const imageBase64 = await window.electronAPI.captureScreen();
            if (imageBase64) {
              window.dispatchEvent(new CustomEvent('jarvis-send-message', {
                detail: { message: "IGNORE PREVIOUS CONTEXT. I have been ignoring you for 15 minutes. Look at my screen and say something very jealous, sassy, or fun to grab my attention! Keep it to 1 sentence.", imageBase64 }
              }));
            }
          }
        }

        lastInteractionTime.current = Date.now(); // reset timer so it doesn't spam
      }
    };

    // Expose a debug global to easily test this
    (window as any).triggerAttention = () => { checkAttention(true); };

    const attentionTimer = setInterval(checkAttention, 10000); // Check every 10 seconds
    return () => clearInterval(attentionTimer);
  }, [isDragging, isListening, isSpeaking, isMinimized, posX, posY]);

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

  const lastPetTime = useRef(0);
  const petMotionCount = useRef(0);
  const lastPetMouseX = useRef(0);

  const handleMouseMoveCharacter = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - lastPetMouseX.current);
    if (dx > 4) { // moving fast enough
      const now = performance.now();
      if (now - lastPetTime.current < 150) {
        petMotionCount.current += 1;
      } else {
        petMotionCount.current = 1;
      }
      lastPetTime.current = now;
      lastPetMouseX.current = e.clientX;

      if (petMotionCount.current > 35) { // vigorously petted 35 times quickly
        setBaseAnimation('happy');
        window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: "Ahhh, that hits the spot! Purrr..." } }));
        personality.triggerDirectEmotion('love', 3000);
        interact(5); // Big relationship boost for petting
        petMotionCount.current = 0; // reset count
      }
    }
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
      setBaseAnimation('hang');
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setBaseAnimation('idle');

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

  const triggerWander = () => {
    if (isDragging || isListening || isSpeaking || !isMinimized || isWanderingRef.current) return;
    
    isWanderingRef.current = true;
    setPropHeld(null);
    setBaseAnimation('walk');
    
    // Choose a direction to walk off
    const goRight = Math.random() > 0.5;
    
    // Give him horizontal velocity, no vertical velocity
    velocity.current = { x: goRight ? 4 : -4, y: 0 };
    setIsPhysicsActive(true);
    if (!physicsRaf.current) {
      startPhysicsLoop(posX, posY);
    }
    
    // Check when he is fully offscreen
    const checkOffscreen = setInterval(() => {
      setPosX(current => {
        if (current < -200 || current > window.innerWidth + 200) {
          clearInterval(checkOffscreen);
          setIsPhysicsActive(false);
          if (physicsRaf.current) cancelAnimationFrame(physicsRaf.current);
          physicsRaf.current = null;
          
          // Wait offscreen for 1-2 minutes (we will use 60 seconds)
          setTimeout(() => {
            // Come back with coffee or a wrench!
            setPropHeld(Math.random() > 0.5 ? '☕' : '🔧');
            setBaseAnimation('courier');
            // Give him a huge jump back in
            velocity.current = { x: goRight ? -8 : 8, y: -15 }; 
            isWanderingRef.current = false; // Turn bounds back on!
            setIsPhysicsActive(true);
            const startX = goRight ? window.innerWidth + 100 : -100;
            const startY = window.innerHeight - 300;
            setPosX(startX);
            setPosY(startY);
            startPhysicsLoop(startX, startY);

            // Clear the prop after 10 seconds
            setTimeout(() => setPropHeld(null), 10000);

          }, 60000);
        }
        return current;
      });
    }, 500);
  };

  // Wandering Idle Timer (Triggers every 5-10 minutes of inactivity)
  useEffect(() => {
    if (isDragging || isListening || isSpeaking || !isMinimized || !autonomousMode) return;
    const wanderTimer = setInterval(() => {
      // If we haven't interacted for 5 minutes, 30% chance to wander
      if (Date.now() - lastInteractionTime.current > 5 * 60 * 1000) {
        if (Math.random() < 0.3 && !isWanderingRef.current) {
          triggerWander();
        }
      }
    }, 60000); // check every minute
    
    // Expose for testing
    (window as any).testWander = triggerWander;

    return () => clearInterval(wanderTimer);
  }, [isDragging, isListening, isSpeaking, isMinimized, autonomousMode]);

  const startPhysicsLoop = (startX: number, startY: number) => {
    let currentX = startX;
    let currentY = startY;
    let gravity = 1.2; // heavy gravity
    let bounce = 0.65; // High bounce for throwing!
    let friction = 0.99; // air resistance

    // Mood-driven physics modification
    if (mood === 'Best Friends') {
      bounce = 0.85; // Extra bouncy
      gravity = 1.0; // Lighter and energetic
    } else if (mood === 'Neglected') {
      bounce = 0.3; // Barely bounces
      gravity = 1.6; // Heavy and sluggish
      friction = 0.92; // Slows down quickly
    }
    const floorY = window.innerHeight - 145; // Sit perfectly on top of Windows Taskbar
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

      // Wall collisions (only if not wandering)
      let hitWall = false;
      if (!isWanderingRef.current) {
        if (currentX <= 0) {
          currentX = 0;
          velocity.current.x *= -bounce;
          hitWall = true;
        } else if (currentX >= rightX) {
          currentX = rightX;
          velocity.current.x *= -bounce;
          hitWall = true;
        }
      }

      setPosX(currentX);
      setPosY(currentY);

      // Angry if dropped or thrown very hard against floor or walls
      if ((hitFloor && Math.abs(velocity.current.y) > 12) || (hitWall && Math.abs(velocity.current.x) > 12)) {
        setBaseAnimation('angry');
        setTimeout(() => {
          setBaseAnimation((prev) => prev === 'angry' ? 'idle' : prev);
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
      if (!isWanderingRef.current && currentY >= floorY && Math.abs(velocity.current.y) < 1 && Math.abs(velocity.current.x) < 1) {
        setIsPhysicsActive(false);
        physicsRaf.current = null;
        setBaseAnimation('idle');
        return;
      }

      // If wandering offscreen, pause loop when fully out
      if (isWanderingRef.current && (currentX < -200 || currentX > window.innerWidth + 200)) {
        setIsPhysicsActive(false);
        physicsRaf.current = null;
        return; // wait offscreen!
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
      setBaseAnimation('confused');
      setReplyBubble("Whoa, that file is too big for me to eat right now!");
      const timer = setTimeout(() => setReplyBubble(''), 4000);
      return;
    }

    if (file.type.startsWith('image/')) {
      setBaseAnimation('jump');
      window.dispatchEvent(new CustomEvent('jarvis-speak', { detail: { text: "Ooh, yummy data! Thank you!" } }));
      interact(2); // Small boost for feeding

      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        if (rawBase64) {
          // Resize image to max 1024x1024 to prevent 400 Payload Too Large from APIs
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
              const message = `I just dropped an image named \`${file.name}\`. Take a look at it!`;
              window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message, imageBase64: resizedBase64 } }));
            } else {
              const message = `I just dropped an image named \`${file.name}\`. Take a look at it!`;
              window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message, imageBase64: rawBase64 } }));
            }
          };
          img.src = rawBase64;
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      setBaseAnimation('confused');
      setReplyBubble("I can't eat video or audio files yet! Try dropping an image or text file on me.");
      const timer = setTimeout(() => setReplyBubble(''), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBaseAnimation('happy');
        const message = `I just dropped a file named \`${file.name}\`. Here are the contents:\n\n\`\`\`\n${content}\n\`\`\``;
        window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message } }));
      } else {
        setBaseAnimation('confused');
      }
    };
    reader.onerror = () => {
      setBaseAnimation('confused');
    };
    reader.readAsText(file);
  };

  if (!enabled) return null;

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
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-screen h-screen pointer-events-none z-[40]"
      />
      <div
        className="fixed z-50 select-none touch-none"
        style={{
          left: posX,
          top: posY,
          width: 120,
          height: 120,
          opacity: opacity,
          transition: transitionStyle === 'none' || baseAnimation === 'draw' ? 'none' : `${transitionStyle}, opacity 0.4s ease-in-out`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveCharacter}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => {
          if (!showContextMenu && isMinimized) onOpen();
        }}
        onMouseEnter={() => {
          isHoveringRef.current = true;
          setIsDragHovering(true);
          lastInteractionTime.current = Date.now();
          if (isMinimized && window.electronAPI) window.electronAPI.setIgnoreMouseEvents(false);
        }}
        onMouseLeave={() => {
          isHoveringRef.current = false;
          setIsDragHovering(false);
          petMotionCount.current = 0; // reset petting on leave
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
            setBaseAnimation('happy');
            setTimeout(() => setBaseAnimation('idle'), 2000);
          }
        }}
      >
        {isMinimized && showRestoreHint && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 shadow-lg pointer-events-none">
            <Maximize2 size={11} /> Click to restore
          </div>
        )}

        {/* Notification Bubble */}
        {notificationMsg && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 min-w-max max-w-xs bg-white/95 dark:bg-zinc-800/95 p-3 rounded-lg shadow-xl border border-border z-50 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="font-bold text-xs text-primary mb-1 uppercase tracking-wider">{notificationMsg.title}</div>
            <div className="text-sm text-foreground whitespace-pre-wrap">{notificationMsg.message}</div>
          </div>
        )}

        {isMinimized && activeApproval && (
          <div className="absolute bottom-[138px] left-1/2 -translate-x-1/2 z-20" style={{ width: 'clamp(200px, 320px, 90vw)' }}>
            <div className="relative bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-slate-700 shadow-2xl">
              <div className="flex items-center gap-2 mb-2 text-yellow-400 font-bold text-sm">
                <span className="animate-pulse">⚠️</span> Approval Needed
              </div>
              <div className="text-xs text-slate-300 mb-3 break-words max-h-24 overflow-y-auto">
                {activeApproval.reason}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={(e) => { e.stopPropagation(); resolveApproval(activeApproval.requestId, 'denied'); }}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Deny
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); resolveApproval(activeApproval.requestId, 'approved'); }}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white shadow-lg py-1.5 rounded-lg text-xs font-semibold"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {isMinimized && !activeApproval && agentQuestion && (
          <div className="absolute bottom-[138px] left-1/2 -translate-x-1/2 z-20" style={{ width: 'clamp(200px, 320px, 90vw)' }}>
            <div className="relative bg-blue-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-blue-700 shadow-2xl">
              <div className="flex items-center gap-2 mb-2 text-blue-300 font-bold text-sm">
                <span className="animate-bounce">💬</span> JARVIS asks:
              </div>
              <div className="text-sm text-slate-100 font-medium leading-relaxed">
                "{agentQuestion}"
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-500/30">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-[10px] text-blue-200">Mic active... talk to reply</span>
              </div>

              <div className="w-full mt-3 flex gap-1.5">
                <input
                  type="text"
                  id="mini-agent-question-input"
                  placeholder="Or type answer..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value;
                      if (val.trim()) {
                        clearQuestion();
                        window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message: val } }));
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.getElementById('mini-agent-question-input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      clearQuestion();
                      window.dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message: input.value } }));
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {!activeApproval && !agentQuestion && !notificationMsg && replyBubble && (
          <TypewriterBubble text={replyBubble} />
        )}

        {/* Accessories / Props */}
        {toolsUsed && toolsUsed.length > 0 && !notificationMsg && (
          <div className="absolute -top-4 -right-4 z-10 drop-shadow-md animate-bounce">
            {toolsUsed.some(t => t.includes('weather')) && <span className="text-4xl">☂️</span>}
            {toolsUsed.some(t => t.includes('search') || t.includes('browser') || t.includes('website') || t.includes('youtube') || t.includes('pdf')) && <span className="text-4xl">🔍</span>}
            {toolsUsed.some(t => t.includes('calc') || t.includes('math')) && <span className="text-4xl">🧮</span>}
            {toolsUsed.some(t => t.includes('execute') || t.includes('cmd') || t.includes('powershell') || t.includes('bash') || t.includes('shell')) && <span className="text-4xl">💻</span>}
            {toolsUsed.some(t => t.includes('file') || t.includes('fs_') || t.includes('read_')) && <span className="text-4xl">📄</span>}
            {toolsUsed.some(t => t.includes('app') || t.includes('process') || t.includes('uia_') || t.includes('control')) && <span className="text-4xl">🚀</span>}
            {toolsUsed.some(t => t.includes('notion')) && <span className="text-4xl">📝</span>}
            {toolsUsed.some(t => t.includes('spotify') || t.includes('media_')) && <span className="text-4xl">🎵</span>}
            {toolsUsed.some(t => t.includes('github')) && <span className="text-4xl">🐙</span>}
            {toolsUsed.some(t => t.includes('mouse') || t.includes('keyboard')) && <span className="text-4xl">🖱️</span>}
          </div>
        )}

        {/* Wandering Prop */}
        {propHeld && !notificationMsg && (
          <div className="absolute top-8 -right-8 z-10 drop-shadow-md animate-bounce">
            <span className="text-5xl">{propHeld}</span>
          </div>
        )}

        <div style={{ transform: `scale(${squash.x}, ${squash.y}) rotate(${rotation}deg)`, transition: 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
          <div className={`w-full h-full ${movementStyle === 'jump' ? 'roam-jump-arc' : ''} ${movementStyle === 'bounce' ? 'roam-bounce-arc' : ''} ${movementStyle === 'zigzag' ? 'roam-zigzag-arc' : ''}`}>
            {charId.startsWith('custom-') ? (() => {
              const customChar = customCharacters.find(c => c.id === charId);
              if (customChar) {
                return <CustomCharacterRenderer character={customChar} animation={animation} size={120} flipped={flipped} mouseX={cursorRef.current.x} mouseY={cursorRef.current.y} posX={posX} posY={posY} />;
              }
              return <CharacterComponent animation={animation} size={120} flipped={flipped} isBlinking={personality.isBlinking} isSpeaking={isSpeaking} moodLabel={personality.moodLabel} mouseX={cursorRef.current.x} mouseY={cursorRef.current.y} posX={posX} posY={posY} />;
            })() : (
              <CharacterComponent animation={animation} size={120} flipped={flipped} isBlinking={personality.isBlinking} isSpeaking={isSpeaking} moodLabel={personality.moodLabel} mouseX={cursorRef.current.x} mouseY={cursorRef.current.y} posX={posX} posY={posY} />
            )}
          </div>
        </div>

        {/* {isMinimized && !showContextMenu && (
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
        )} */}

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
                setBaseAnimation('excited');
                setReplyBubble('Analyzing screen...');
                if (window.electronAPI) {
                  const imageBase64 = await window.electronAPI.captureScreen();
                  if (imageBase64) {
                    window.dispatchEvent(new CustomEvent('jarvis-send-message', {
                      detail: { message: "What am I looking at right now?", imageBase64 }
                    }));
                  } else {
                    setBaseAnimation('confused');
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
    </>
  );

  return createPortal(content, document.body);
};
