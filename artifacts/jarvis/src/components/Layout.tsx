import React, { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { MiniModeOverlay } from './MiniModeOverlay';
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
