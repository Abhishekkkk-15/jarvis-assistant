interface Window {
  electronAPI: {
    platform: string;
    versions: {
      node: string;
      chrome: string;
      electron: string;
    };
    setIgnoreMouseEvents: (ignore: boolean) => void;
    setFullscreen: (isFullscreen: boolean, alwaysOnTop?: boolean) => void;
    minimizeWindow: () => void;
    captureScreen: () => Promise<string | null>;
    getActiveWindow: () => Promise<{ title: string; id: number; bounds: { x: number; y: number; width: number; height: number; }; owner: { name: string; processId: number; path: string; }; url?: string; memoryUsage?: number; } | null>;
    hideQuickInput: () => void;
    sendToMain: (msg: string) => void;
    updateOverlayRect: (rect: { x: number, y: number, width: number, height: number } | null) => void;
    setStartupLaunch: (enable: boolean) => void;
    getStartupLaunch: () => Promise<boolean>;
  };
}
