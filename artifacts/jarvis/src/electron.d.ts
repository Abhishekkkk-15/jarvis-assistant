interface Window {
  electronAPI: {
    platform: string;
    versions: {
      node: string;
      chrome: string;
      electron: string;
    };
    setIgnoreMouseEvents: (ignore: boolean) => void;
    setFullscreen: (isFullscreen: boolean) => void;
    captureScreen: () => Promise<string | null>;
  };
}
