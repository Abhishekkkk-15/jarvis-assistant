import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  setFullscreen: (isFullscreen: boolean) => ipcRenderer.send('set-fullscreen', isFullscreen),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
});
