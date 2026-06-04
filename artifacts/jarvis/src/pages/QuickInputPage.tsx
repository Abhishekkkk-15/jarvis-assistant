import React, { useEffect, useRef, useState } from 'react';
import { useSendChat, useGetSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { Send, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';

export const QuickInputPage: React.FC = () => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sendChat = useSendChat();
  const { toast } = useToast();
  
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const [activeConversationId, setActiveConversationId] = useLocalStorage<number | null>('activeConversationId', null);

  useEffect(() => {
    // Force body background to transparent for the frameless window effect
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const rootElement = document.getElementById('root');
    if (rootElement) rootElement.style.backgroundColor = 'transparent';

    // Focus input when window becomes visible
    const handleFocus = () => inputRef.current?.focus();
    window.addEventListener('focus', handleFocus);
    // Initial focus
    setTimeout(() => handleFocus(), 100);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      if (rootElement) rootElement.style.backgroundColor = '';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) {
      if (window.electronAPI?.hideQuickInput) {
        window.electronAPI.hideQuickInput();
      }
      return;
    }

    if (window.electronAPI?.sendToMain) {
      window.electronAPI.sendToMain(text);
    }
    
    // Clear and hide immediately for snappy feeling
    setInput('');
    if (window.electronAPI?.hideQuickInput) {
      window.electronAPI.hideQuickInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (window.electronAPI?.hideQuickInput) {
        window.electronAPI.hideQuickInput();
      }
    }
  };

  return (
    <div 
      className="w-full h-full bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl overflow-hidden flex items-center px-4"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex-1 flex items-center gap-3">
        <Sparkles className="text-primary/70 shrink-0" size={24} />
        <form onSubmit={handleSubmit} className="flex-1 flex items-center w-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask JARVIS..."
            className="w-full bg-transparent border-none outline-none text-white text-2xl placeholder:text-white/40 font-medium"
            autoFocus
          />
          <button 
            type="submit" 
            disabled={!input.trim() || sendChat.isPending}
            className="ml-2 text-white/50 hover:text-primary transition-colors disabled:opacity-30"
          >
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
};
