import React, { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { MiniModeOverlay } from './MiniModeOverlay';
import { DisclaimerModal } from './DisclaimerModal';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useGetSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const [miniModeEnabled] = useLocalStorage('miniModeEnabled', true);
  const [minimized, setMinimized] = useLocalStorage('appMinimized', false);
  const [isAppFullscreen, setIsAppFullscreen] = React.useState(false);
  
  // Initialize background wake word listener
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  useWakeWord(settings?.wakeWord || 'jarvis');

  const handleRestore = () => {
    setMinimized(false);
    setLocation('/');
  };

  React.useEffect(() => {
    const handleToggleMiniMode = () => {
      setMinimized(prev => !prev);
    };
    window.addEventListener('toggle-minimode', handleToggleMiniMode);
    return () => window.removeEventListener('toggle-minimode', handleToggleMiniMode);
  }, [setMinimized]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setIsAppFullscreen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (window.electronAPI) {
      if (minimized) {
        window.electronAPI.setFullscreen(true, true);
        window.electronAPI.setIgnoreMouseEvents(true);
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
      } else {
        window.electronAPI.setFullscreen(isAppFullscreen, false);
        window.electronAPI.setIgnoreMouseEvents(false);
        document.body.style.backgroundColor = '';
        document.documentElement.style.backgroundColor = '';
      }
    }
  }, [minimized, isAppFullscreen]);

  return (
    <>
      {/* Main app — hidden when minimized */}
      <div className={`h-[100dvh] w-full flex overflow-hidden bg-background text-foreground relative transition-opacity duration-300 ${minimized ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'}`}>
        <Navigation
          onMinimize={() => {
            if (miniModeEnabled) {
              setMinimized(true);
            } else if (window.electronAPI && typeof window.electronAPI.minimizeWindow === 'function') {
              window.electronAPI.minimizeWindow();
            }
          }}
        />

        <main className="flex-1 relative overflow-hidden flex flex-col">
          {/* Custom Window Titlebar Action Controls */}
          <div 
            className="h-10 border-b flex items-center justify-end px-4 gap-1 shrink-0 select-none bg-slate-50 border-border"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button 
                onClick={() => {
                  if (window.electronAPI && typeof window.electronAPI.minimizeWindow === 'function') {
                    window.electronAPI.minimizeWindow();
                  }
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                title="Minimize Window"
              >
                <svg width="12" height="1" viewBox="0 0 12 1" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="0" y1="0.5" x2="12" y2="0.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button 
                onClick={() => {
                  if (window.electronAPI && typeof window.electronAPI.maximizeWindow === 'function') {
                    window.electronAPI.maximizeWindow();
                  }
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                title="Maximize / Restore"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button 
                onClick={() => {
                  if (window.electronAPI && typeof window.electronAPI.closeWindow === 'function') {
                    window.electronAPI.closeWindow();
                  }
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white transition-colors"
                title="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="flex-1 w-full h-full overflow-y-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Disclaimer modal displayed on first launch */}
      <DisclaimerModal />

      {/* Character overlay — only rendered when mini mode is enabled */}
      {miniModeEnabled && (
        <MiniModeOverlay
          isMinimized={minimized}
          onOpen={handleRestore}
        />
      )}
    </>
  );
};
