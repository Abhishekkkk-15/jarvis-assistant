import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Users, MessageSquare, Settings, ShieldAlert, Wifi, WifiOff, Minimize2, CalendarRange } from 'lucide-react';
import { useGetSettings, getGetSettingsQueryKey, useHealthCheck, getHealthCheckQueryKey } from '@workspace/api-client-react';

interface NavigationProps {
  onMinimize: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onMinimize }) => {
  const [location] = useLocation();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });

  const navItems = [
    { href: '/', label: 'Assistant', icon: Home },
    { href: '/characters', label: 'Characters', icon: Users },
    { href: '/conversations', label: 'History', icon: MessageSquare },
    { href: '/scheduler', label: 'Scheduler', icon: CalendarRange },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const needsApiKeys = settings && !settings.groqApiKeySet;
  const isOnline = health?.status === 'ok';

  return (
    <nav className="w-16 md:w-56 border-r border-border bg-slate-50 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-4 md:p-5 flex items-center gap-3 border-b border-border select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <img src="/icon.png" alt="JARVIS Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
        <div className="hidden md:block">
          <h1 className="text-base font-semibold text-foreground tracking-tight">JARVIS</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isOnline
              ? <Wifi size={11} className="text-emerald-500" />
              : <WifiOff size={11} className="text-destructive" />
            }
            <span className={`text-[11px] ${isOnline ? 'text-emerald-600' : 'text-destructive'}`}>
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} data-testid={`link-${item.label.toLowerCase()}`}>
              <div
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150
                  ${isActive
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'}
                `}
              >
                <Icon size={18} className="shrink-0" />
                <span className="hidden md:block text-sm font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Warning */}
      {needsApiKeys && (
        <div className="m-3 p-3 border border-amber-200 bg-amber-50 rounded-lg">
          <div className="flex flex-col items-center md:items-start gap-1.5">
            <ShieldAlert className="text-amber-500 w-5 h-5" />
            <div className="hidden md:block">
              <p className="text-amber-700 text-xs font-semibold">Groq Key Missing</p>
              <p className="text-amber-600 text-[11px] mt-0.5">Required for speech & AI</p>
              <Link href="/settings">
                <span className="text-primary text-[11px] font-medium hover:underline mt-1.5 inline-block cursor-pointer">
                  Go to Settings →
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Minimize button */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onMinimize}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors duration-150"
          title="Minimize — character stays on screen"
          data-testid="button-minimize"
        >
          <Minimize2 size={18} className="shrink-0" />
          <span className="hidden md:block text-sm font-medium">Minimize</span>
        </button>
      </div>
    </nav>
  );
};
