import { app, BrowserWindow, shell, ipcMain, desktopCapturer, globalShortcut, powerMonitor } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { activeWindow } from 'active-win';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow: BrowserWindow | null = null;
let quickInputWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'JARVIS',
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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
      preload: path.join(__dirname, 'preload.js'),
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
    quickInputWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'), { hash: 'quick-input' });
  }

  quickInputWindow.on('blur', () => {
    quickInputWindow?.hide();
  });

  quickInputWindow.on('closed', () => {
    quickInputWindow = null;
  });
}

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
        win.focus();
      }
    }
  });
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

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (ignore) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('set-fullscreen', (event, isFullscreen) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setFullScreen(isFullscreen);
  win.setAlwaysOnTop(isFullscreen, 'pop-up-menu');
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
  try {
    const win = await activeWindow();
    return win;
  } catch (err) {
    console.error('Failed to get active window:', err);
    return null;
  }
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
