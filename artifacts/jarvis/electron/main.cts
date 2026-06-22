import { app, BrowserWindow, shell, ipcMain, desktopCapturer, globalShortcut, powerMonitor, utilityProcess, screen } from 'electron';
import path from 'path';
const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow: BrowserWindow | null = null;
let quickInputWindow: BrowserWindow | null = null;

// Bypass Chrome's autoplay policy so the background AudioContext (for Wake Word) starts immediately
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Bypass CORS for file:// protocol so the Vosk Web Worker and model can be loaded in production
app.commandLine.appendSwitch('allow-file-access-from-files');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 1080,
    minHeight: 600,
    title: 'JARVIS',
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.removeMenu();

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, we MUST use a custom protocol because Chromium's fetch() 
    // cannot read files (like vosk-model.zip) directly out of an ASAR archive.
    const { protocol, net } = require('electron');
    // We register this once
    if (!protocol.isProtocolHandled('app')) {
      protocol.handle('app', (request: any) => {
        // request.url is something like "app://-/index.html" or "app://-/vosk-model.zip"
        const urlPath = request.url.substring(7); // strips 'app://-/'
        let filePath = path.join(__dirname, '..', 'public', urlPath);
        // Fallback for SPA routing if file doesn't have an extension
        if (!path.extname(filePath)) {
          filePath = path.join(__dirname, '..', 'public', 'index.html');
        }
        return net.fetch('file://' + filePath);
      });
    }
    mainWindow.loadURL('app://-/index.html');
  }

  // Auto-grant all permissions (like microphone for wake word) so it doesn't hang
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(true);
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

function createQuickInputWindow() {
  quickInputWindow = new BrowserWindow({
    width: 700,
    height: 100,
    title: 'JARVIS Quick Input',
    transparent: true,
    frame: false,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  quickInputWindow.removeMenu();

  if (isDev) {
    quickInputWindow.loadURL(`${VITE_DEV_SERVER_URL}/#/quick-input`);
  } else {
    quickInputWindow.loadURL('app://-/index.html#/quick-input');
  }

  quickInputWindow.on('blur', () => {
    quickInputWindow?.hide();
  });

  quickInputWindow.on('closed', () => {
    quickInputWindow = null;
  });
}

import { protocol } from 'electron';
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

app.whenReady().then(() => {
  createWindow();
  createQuickInputWindow();

  const sendSystemEvent = (eventName: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('system-event', eventName);
    }
  };

  powerMonitor.on('suspend', () => sendSystemEvent('suspend'));
  powerMonitor.on('resume', () => sendSystemEvent('resume'));
  powerMonitor.on('lock-screen', () => sendSystemEvent('lock-screen'));
  powerMonitor.on('unlock-screen', () => sendSystemEvent('unlock-screen'));
  powerMonitor.on('on-ac', () => sendSystemEvent('on-ac'));
  powerMonitor.on('on-battery', () => sendSystemEvent('on-battery'));

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+K', () => {
    let win = quickInputWindow;
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    } else {
      createQuickInputWindow();
      win = quickInputWindow;
      if (win) {
        win.show();
      }
    }
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-minimode');
    }
  });

  let backendProcess: Electron.UtilityProcess | null = null;
  if (!isDev) {
    const backendPath = path.join(__dirname, '..', 'backend', 'dist', 'index.cjs');
    const envFile = path.join(__dirname, '..', 'backend', '.env');
    const dbPath = path.join(app.getPath('userData'), 'sqlite.db');

    console.log("Starting backend utility process at", backendPath);
    const logFs = require('fs');
    const logFsPath = path.join(app.getPath('userData'), 'backend-crash.log');
    logFs.writeFileSync(logFsPath, 'Backend starting...\n');

    const bootScript = path.join(app.getPath('userData'), 'boot.cjs');
    logFs.writeFileSync(bootScript, `
const fs = require('fs');
try {
  require(process.env.REAL_BACKEND_PATH);
} catch(e) {
  fs.appendFileSync(process.env.CRASH_LOG_PATH, 'SYNC CATCH ERR: ' + (e.stack || e.message) + '\\n');
  process.exit(1);
}
        `);

    backendProcess = utilityProcess.fork(bootScript, [], {
      stdio: 'pipe',
      env: {
        ...process.env,
        DB_PATH: dbPath,
        ENV_FILE: envFile,
        REAL_BACKEND_PATH: backendPath,
        CRASH_LOG_PATH: logFsPath
      }
    });
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (d) => logFs.appendFileSync(logFsPath, d.toString()));
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (d) => logFs.appendFileSync(logFsPath, 'ERR: ' + d.toString()));
    }

    backendProcess.on('message', (msg) => {
      console.log('Backend says:', msg);
    });
    backendProcess.on('exit', (code) => {
      logFs.appendFileSync(logFsPath, `\nBackend exited with code ${code}\n`);
    });

    app.on('will-quit', () => {
      if (backendProcess) {
        backendProcess.kill();
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let overlayRect: { x: number, y: number, width: number, height: number } | null = null;
let overlayRectWinId: number | null = null;
let ignoreMousePollingInterval: NodeJS.Timeout | null = null;

ipcMain.on('update-overlay-rect', (event, rect) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  overlayRect = rect;

  if (rect && !ignoreMousePollingInterval) {
    overlayRectWinId = win.id;
    ignoreMousePollingInterval = setInterval(() => {
      if (!overlayRect || !overlayRectWinId) {
        clearInterval(ignoreMousePollingInterval!);
        ignoreMousePollingInterval = null;
        return;
      }
      const targetWin = BrowserWindow.fromId(overlayRectWinId);
      if (!targetWin || targetWin.isDestroyed()) {
        clearInterval(ignoreMousePollingInterval!);
        ignoreMousePollingInterval = null;
        return;
      }

      const mousePos = screen.getCursorScreenPoint();
      // Calculate intersection based on the screen position of the window
      const winBounds = targetWin.getBounds();
      // overlayRect is relative to the window, so we add winBounds.x and winBounds.y
      const globalRectX = winBounds.x + overlayRect.x;
      const globalRectY = winBounds.y + overlayRect.y;

      const isInside = mousePos.x >= globalRectX &&
        mousePos.x <= globalRectX + overlayRect.width &&
        mousePos.y >= globalRectY &&
        mousePos.y <= globalRectY + overlayRect.height;

      if (isInside) {
        targetWin.setIgnoreMouseEvents(false);
      } else {
        targetWin.setIgnoreMouseEvents(true, { forward: true });
      }
    }, 50);
  } else if (!rect && ignoreMousePollingInterval) {
    clearInterval(ignoreMousePollingInterval);
    ignoreMousePollingInterval = null;
    win.setIgnoreMouseEvents(true, { forward: true });
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  // We disable manual toggling if overlay polling is active to prevent conflicts
  if (overlayRect) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (ignore) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('set-fullscreen', (event, isFullscreen, alwaysOnTop = false) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setFullScreen(isFullscreen);
  if (alwaysOnTop) {
    win.setAlwaysOnTop(isFullscreen, 'pop-up-menu');
  } else {
    win.setAlwaysOnTop(false);
  }
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.minimize();
});

ipcMain.on('maximize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 }, // scale down slightly for token limits
    });
    // usually sources[0] is the primary display
    if (sources && sources.length > 0) {
      return sources[0].thumbnail.toDataURL(); // base64 string
    }
    return null;
  } catch (error) {
    console.error('Failed to capture screen:', error);
    return null;
  }
});

ipcMain.on('hide-quick-input', () => {
  if (quickInputWindow) {
    quickInputWindow.hide();
  }
});

ipcMain.on('set-startup-launch', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe'),
  });
});

ipcMain.handle('get-startup-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('send-to-main', (event, msg) => {
  let win = mainWindow;
  if (win) {
    if (!win.isVisible()) {
      win.show();
    }
    win.focus();
    win.webContents.send('message-from-quick-input', msg);
  } else {
    createWindow();
    win = mainWindow;
    win?.once('ready-to-show', () => {
      win?.show();
      win?.focus();
      win?.webContents.send('message-from-quick-input', msg);
    });
  }
});

ipcMain.handle('get-active-window', async () => {
  return null;
});

// Active Window Polling Loop using Native PowerShell (Robust Fallback)
import { spawn } from 'child_process';

let lastActiveWindowTitle = '';

const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  }
"@
while ($true) {
  $hwnd = [Win32]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder(256)
  [Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
  $title = $sb.ToString()
  
  [UInt32]$procId = 0
  [Win32]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
  $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
  $name = if ($process) { $process.ProcessName } else { "" }
  
  Write-Output "$title|JARVIS_SPLIT|$name"
  Start-Sleep -Milliseconds 2000
}
`;

const psProcess = spawn('powershell', ['-NoProfile', '-Command', psScript]);

psProcess.stdout.on('data', (data) => {
  if (!mainWindow) return;
  const lines = data.toString().trim().split('\\n');
  for (const line of lines) {
    const parts = line.trim().split('|JARVIS_SPLIT|');
    if (parts.length === 2) {
      const winInfo = { title: parts[0], owner: { name: parts[1] } };

      if (winInfo.title !== lastActiveWindowTitle) {
        lastActiveWindowTitle = winInfo.title;

        // Still don't send the event for JARVIS itself, but we DID update lastActiveWindowTitle
        if (winInfo.title.includes('JARVIS')) continue;

        mainWindow.webContents.send('active-window-changed', winInfo);
      }
    }
  }
});

psProcess.stderr.on('data', (data) => {
  console.error('PowerShell Error:', data.toString());
});

app.on('will-quit', () => {
  if (psProcess) {
    try {
      psProcess.kill();
    } catch (e) { }
  }
});
