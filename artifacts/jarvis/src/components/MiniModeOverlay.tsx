import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { charactersMap, CharacterAnimation } from './characters/CharacterRenderer';
import { useLocation } from 'wouter';
import { Maximize2 } from 'lucide-react';

interface MiniModeOverlayProps {
  isListening: boolean;
  isSpeaking: boolean;
  lastReply: string;
  isMinimized: boolean;
  onOpen: () => void;
}

export const MiniModeOverlay: React.FC<MiniModeOverlayProps> = ({
  isListening,
  isSpeaking,
  lastReply,
  isMinimized,
  onOpen,
}) => {
  const [enabled] = useLocalStorage('miniModeEnabled', true);
  const [charId] = useLocalStorage('selectedCharacterId', 'jarvis-bot');
  const [posX, setPosX] = useLocalStorage('characterPositionX', window.innerWidth - 150);
  const [posY, setPosY] = useLocalStorage('characterPositionY', window.innerHeight - 150);

  const [animation, setAnimation] = useState<CharacterAnimation>('idle');
  const [flipped, setFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [replyBubble, setReplyBubble] = useState('');
  const [showRestoreHint, setShowRestoreHint] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const hasDragged = useRef(false);
  const [, setLocation] = useLocation();

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
    else setAnimation('idle');
  }, [isListening, isSpeaking]);

  // Autonomous movement
  useEffect(() => {
    if (isDragging || isListening || isSpeaking) return;

    const idleTimer = setTimeout(() => {
      if (animation === 'idle') setAnimation('sleep');
    }, 30000);

    const moveTimer = setInterval(() => {
      const maxX = window.innerWidth - 120;
      const maxY = window.innerHeight - 120;
      const newX = Math.max(0, Math.min(Math.random() * maxX, maxX));
      const newY = Math.max(0, Math.min(Math.random() * maxY, maxY));
      setFlipped(newX < posX);
      setAnimation('walk');
      setPosX(newX);
      setPosY(newY);
      setTimeout(() => setAnimation('idle'), 2000);
    }, 8000 + Math.random() * 7000);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(moveTimer);
    };
  }, [isDragging, isListening, isSpeaking, posX, setPosX, setPosY, animation]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDragged.current = false;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: posX,
      initialY: posY,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
      setPosX(dragRef.current.initialX + dx);
      setPosY(dragRef.current.initialY + dy);
      setAnimation('wave');
    };
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setAnimation('idle');
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
  }, [isDragging, setPosX, setPosY]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  // Don't render if not enabled and not minimized
  if (!enabled && !isMinimized) return null;

  const content = (
    <div
      className="fixed z-50 select-none touch-none"
      style={{
        left: posX,
        top: posY,
        width: 120,
        height: 120,
        transition: isDragging ? 'none' : 'left 2s ease-in-out, top 2s ease-in-out',
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
      {/* Restore hint when minimized */}
      {isMinimized && showRestoreHint && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 shadow-lg pointer-events-none">
          <Maximize2 size={11} /> Click to restore
        </div>
      )}

      {/* Speech bubble */}
      {replyBubble && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 shadow-md text-xs max-w-[200px] truncate whitespace-nowrap z-10">
          {replyBubble}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-solid border-t-white border-t-8 border-x-transparent border-x-8 border-b-0" />
        </div>
      )}

      <CharacterComponent animation={animation} size={120} flipped={flipped} />

      {/* Restore button overlay when minimized */}
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
