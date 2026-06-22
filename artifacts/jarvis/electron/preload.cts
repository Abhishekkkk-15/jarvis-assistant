import { contextBridge, ipcRenderer } from 'electron';

declare const window: any;
declare const CustomEvent: any;

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  setFullscreen: (isFullscreen: boolean, alwaysOnTop?: boolean) => ipcRenderer.send('set-fullscreen', isFullscreen, alwaysOnTop),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  hideQuickInput: () => ipcRenderer.send('hide-quick-input'),
  sendToMain: (msg: string) => ipcRenderer.send('send-to-main', msg),
  updateOverlayRect: (rect: { x: number, y: number, width: number, height: number } | null) => ipcRenderer.send('update-overlay-rect', rect),
  setStartupLaunch: (enable: boolean) => ipcRenderer.send('set-startup-launch', enable),
  getStartupLaunch: () => ipcRenderer.invoke('get-startup-launch'),
});

ipcRenderer.on('message-from-quick-input', (event, message) => {
  (window as any).dispatchEvent(new CustomEvent('jarvis-send-message', { detail: { message } }));
});

ipcRenderer.on('active-window-changed', (event, winInfo) => {
  (window as any).dispatchEvent(new CustomEvent('active-window-changed', { detail: { winInfo } }));
});

ipcRenderer.on('system-event', (event, eventName) => {
  (window as any).dispatchEvent(new CustomEvent('system-event', { detail: { eventName } }));
});

ipcRenderer.on('toggle-minimode', () => {
  (window as any).dispatchEvent(new CustomEvent('toggle-minimode'));
});
