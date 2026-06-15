# Linux Support Implementation Plan

## Overview

JARVIS currently runs on **Windows only**. This document is the complete implementation plan to add full Linux (x64, X11) support. macOS already has partial support via existing `process.platform === "darwin"` guards.

The work is split into **3 phases** ordered by impact and risk. Phases 1 and 2 are non-breaking for existing Windows users — all changes use platform guards. Phase 3 replaces the core input automation library.

**Target Linux environment:** Ubuntu 22.04 LTS / Debian-based distros, X11 display server. Wayland is out of scope for now (most Wayland compositors still run XWayland for compatibility).

---

## Audit Summary — What Blocks Linux Today

| Blocker | File(s) | Type |
|---|---|---|
| `@hurdlegroup/robotjs` — Windows/Mac only native binary | `computer.ts`, `antigravity.ts` | Hard block |
| Active window tracking via PowerShell Win32 DLLs | `electron/main.cts` | Hard block |
| `open_app` / `open_website` spawn `cmd.exe /c start` | `services/chatService.ts` | Hard block |
| `windowsSystem.ts` — rundll32, WMI, reg.exe, WScript | `tools/windowsSystem.ts` | Hard block |
| `uiautomation.ts` — Windows UIAutomation Python library | `tools/uiautomation.ts` | Hard block |
| `everything.ts` — Voidtools `es.exe`, PowerShell download | `tools/everything.ts` | Hard block |
| `clipboard` tool — `Get-Clipboard` / `Set-Clipboard` via PowerShell | `tools/computer.ts` | Hard block |
| Hardcoded `\\` path separator in clipboard temp file | `tools/antigravity.ts:16` | Bug |
| `execute_powershell` / `execute_cmd` — Windows shells | `tools/shell.ts` | Graceful |
| `spawn_claude` — already has Linux path via gnome-terminal | `tools/claude_cli.ts` | Already done |
| `screen_capture` — pyautogui path uses Windows raw string | `tools/computer.ts:240` | Minor fix |
| electron-builder Linux target — AppImage defined but bare | `jarvis/package.json` | Config |

---

## Linux System Dependencies

These packages must be installed on the user's Linux machine. JARVIS should check for them at startup and surface a clear warning in the Settings page if any are missing.

```bash
# Core automation (required)
sudo apt install xdotool wmctrl xclip

# Media control (for media_control tool)
sudo apt install playerctl

# Brightness control (for display_brightness tool)
sudo apt install brightnessctl

# File search (for search_everything equivalent)
sudo apt install plocate          # or: sudo apt install mlocate

# nut-js native dependencies (Phase 3, replaces robotjs)
sudo apt install libxtst-dev libpng-dev

# Python automation (for find_and_click_text, screen_capture)
pip install pyautogui pillow
```

A future enhancement can auto-detect and prompt for missing tools.

---

## Phase 1 — Quick Structural Fixes

**Goal:** Fix all hardcoded Windows commands that have trivial cross-platform equivalents. Zero new dependencies, zero API surface changes.

---

### 1.1 — Fix `open_app` in `chatService.ts`

**File:** `artifacts/api-server/src/services/chatService.ts`

**Current behavior:** Spawns `cmd.exe /c start "" <appname>` — Windows only.

**Fix:** Add platform branching.

```typescript
// Windows  → cmd.exe /c start "" <app>
// macOS    → open -a <app>
// Linux    → gtk-launch <app>.desktop  OR  xdg-open <app>  OR  just exec <app>
func: async ({ app_name }) => {
  return new Promise((resolve) => {
    let child: child_process.ChildProcess;
    if (process.platform === "win32") {
      const aliasMap: Record<string, string> = { /* existing map */ };
      const target = aliasMap[app_name.toLowerCase().trim()] || app_name;
      child = child_process.spawn("cmd.exe", ["/c", "start", "", target], { detached: true, stdio: "ignore" });
    } else if (process.platform === "darwin") {
      child = child_process.spawn("open", ["-a", app_name], { detached: true, stdio: "ignore" });
    } else {
      // Linux: try gtk-launch first (works with .desktop entries), fall back to exec
      child = child_process.spawn("gtk-launch", [app_name], { detached: true, stdio: "ignore" });
      child.on("error", () => {
        child_process.spawn(app_name, [], { detached: true, stdio: "ignore" }).unref();
      });
    }
    child.unref();
    resolve(`App '${app_name}' open command issued successfully.`);
  });
}
```

---

### 1.2 — Fix `open_website` in `chatService.ts`

**File:** `artifacts/api-server/src/services/chatService.ts`

**Current behavior:** Spawns `cmd.exe /c start "" <url>` — Windows only.

**Fix:**

```typescript
if (process.platform === "win32") {
  child_process.spawn("cmd.exe", ["/c", "start", "", finalUrl], { detached: true, stdio: "ignore" }).unref();
} else if (process.platform === "darwin") {
  child_process.spawn("open", [finalUrl], { detached: true, stdio: "ignore" }).unref();
} else {
  child_process.spawn("xdg-open", [finalUrl], { detached: true, stdio: "ignore" }).unref();
}
```

---

### 1.3 — Fix `clipboard` tool in `computer.ts`

**File:** `artifacts/api-server/src/tools/computer.ts`

**Current behavior:** `read` calls `Get-Clipboard`, `write` calls `Set-Clipboard` — PowerShell only.

**Fix:** Platform-branched implementation.

```typescript
// READ
if (process.platform === "win32") {
  return runPS("Get-Clipboard");
} else if (process.platform === "darwin") {
  return new Promise(resolve => child_process.exec("pbpaste", (_, out) => resolve(out.trim())));
} else {
  return new Promise(resolve => child_process.exec("xclip -selection clipboard -o", (err, out, stderr) => {
    if (err) resolve(`Error reading clipboard: ${stderr || err.message}`);
    else resolve(`Clipboard content: ${out}`);
  }));
}

// WRITE
if (process.platform === "win32") {
  return runPS(`Set-Clipboard -Value '${text.replace(/'/g, "''")}'; echo 'OK'`);
} else if (process.platform === "darwin") {
  return new Promise(resolve => {
    const proc = child_process.spawn("pbcopy");
    proc.stdin.write(text); proc.stdin.end();
    proc.on("close", () => resolve(`Clipboard set.`));
  });
} else {
  return new Promise(resolve => {
    const proc = child_process.spawn("xclip", ["-selection", "clipboard"]);
    proc.stdin.write(text); proc.stdin.end();
    proc.on("close", () => resolve(`Clipboard set.`));
    proc.on("error", (e) => resolve(`Error: xclip not found. Install with: sudo apt install xclip`));
  });
}
```

---

### 1.4 — Fix path separator bug in `antigravity.ts`

**File:** `artifacts/api-server/src/tools/antigravity.ts`, **line 16**

**Current:**
```typescript
const tmp = `${os.tmpdir()}\\jarvis_clip_${Date.now()}.txt`;
```

**Fix:**
```typescript
const tmp = path.join(os.tmpdir(), `jarvis_clip_${Date.now()}.txt`);
```

Also add `import * as path from "path"` if not already imported (it is used elsewhere in the same file via `path` — verify).

---

### 1.5 — Fix `screen_capture` path in `computer.ts`

**File:** `artifacts/api-server/src/tools/computer.ts`, **line 240**

**Current:**
```typescript
const code = `import pyautogui; img = pyautogui.screenshot(); img.save(r'${outPath.replace(/\\/g, "\\\\")}'); print('OK')`;
```

The `r'...'` raw string and Windows backslash-doubling only matters on Windows. On Linux, forward slashes are native and the `r` prefix is harmless — but the double-escape is wrong for Linux paths. Fix to use forward slashes on Linux:

```typescript
const safePath = process.platform === "win32"
  ? outPath.replace(/\\/g, "\\\\")
  : outPath;
const quoteChar = process.platform === "win32" ? "r'" : "'";
const code = `import pyautogui; img = pyautogui.screenshot(); img.save(${quoteChar}${safePath}'); print('OK')`;
```

---

### 1.6 — Fix `execute_powershell` and `execute_cmd` on Linux

**File:** `artifacts/api-server/src/tools/shell.ts`

**Current behavior:** Silently fails or crashes on Linux (no PowerShell, no cmd.exe).

**Fix:** Return an informative message instead of crashing:

```typescript
// execute_powershell
func: async ({ command }) => {
  if (process.platform !== "win32") {
    return "PowerShell is not available on this platform. Use execute_bash instead.";
  }
  // existing implementation
}

// execute_cmd
func: async ({ command }) => {
  if (process.platform !== "win32") {
    return "CMD is not available on this platform. Use execute_bash instead.";
  }
  // existing implementation
}
```

---

### 1.7 — Fix electron-builder Linux config

**File:** `artifacts/jarvis/package.json`, `"build"` section

**Current Linux config (bare):**
```json
"linux": {
  "target": "AppImage"
}
```

**Updated config:**
```json
"linux": {
  "target": ["AppImage", "deb"],
  "category": "Utility",
  "icon": "build/icon.png",
  "maintainer": "JARVIS Project",
  "description": "JARVIS AI Desktop Assistant"
},
```

**Also update `asarUnpack`** to ensure Linux shared libs (`.so`) are unpacked. Currently has `**/*.so` — that's already correct.

**Also update `onlyBuiltDependencies`** (if present in root `package.json`) to include nut-js and rebuilt natives for Linux once Phase 3 is done.

The icon must exist as a 1024×1024 PNG at `artifacts/jarvis/build/icon.png`. The existing `generate-icon.mjs` script may already produce this — verify it outputs PNG alongside ICO/ICNS.

---

## Phase 2 — Replace/Adapt Windows-Specific Tools

**Goal:** Give each Windows-only tool a Linux equivalent. Where no equivalent exists (e.g. Windows Registry), fail gracefully with a clear message.

---

### 2.1 — `windowsSystem.ts` — Add Linux equivalents

**File:** `artifacts/api-server/src/tools/windowsSystem.ts`

Wrap each tool's `func` body in a `process.platform` branch.

#### `media_control`

```typescript
// Windows → WScript.Shell SendKeys (existing)
// Linux   → playerctl (MPRIS2-compliant media players: Spotify, VLC, Firefox, etc.)
if (process.platform !== "win32") {
  const linuxCmdMap: Record<string, string[]> = {
    play_pause: ["playerctl", ["play-pause"]],
    next:       ["playerctl", ["next"]],
    prev:       ["playerctl", ["previous"]],
    mute:       ["pactl",     ["set-sink-mute", "@DEFAULT_SINK@", "toggle"]],
    volume_up:  ["pactl",     ["set-sink-volume", "@DEFAULT_SINK@", "+5%"]],
    volume_down:["pactl",     ["set-sink-volume", "@DEFAULT_SINK@", "-5%"]],
  };
  const [cmd, args] = linuxCmdMap[action] || [null, null];
  if (!cmd) return `Unknown action: ${action}`;
  return new Promise(resolve => {
    child_process.execFile(cmd, args, (err) => {
      if (err) resolve(`Error: ${cmd} not found. Install with: sudo apt install ${cmd === "playerctl" ? "playerctl" : "pulseaudio-utils"}`);
      else resolve(`Executed media control: ${action}`);
    });
  });
}
// ... existing Windows implementation
```

#### `power_management`

```typescript
if (process.platform !== "win32") {
  const linuxCmdMap: Record<string, string> = {
    lock:     "loginctl lock-session",
    sleep:    "systemctl suspend",
    restart:  "systemctl reboot",
    shutdown: "systemctl poweroff",
  };
  const cmd = linuxCmdMap[action];
  if (!cmd) return "Unknown action.";
  return new Promise(resolve => {
    child_process.exec(cmd, (err) => {
      if (err) resolve(`Error executing power action: ${err.message}`);
      else resolve(`Power action '${action}' executed.`);
    });
  });
}
```

#### `display_brightness`

```typescript
if (process.platform !== "win32") {
  // brightnessctl is the most portable cross-distro tool
  return new Promise(resolve => {
    child_process.exec(`brightnessctl set ${level}%`, (err, stdout, stderr) => {
      if (err) resolve(`Error: brightnessctl not found or failed. Install with: sudo apt install brightnessctl. Error: ${stderr || err.message}`);
      else resolve(`Screen brightness set to ${level}%.`);
    });
  });
}
```

#### `registry_control`

```typescript
if (process.platform !== "win32") {
  return "The Windows Registry does not exist on Linux. This tool is Windows-only.";
}
```

---

### 2.2 — `everything.ts` — Replace with `locate` on Linux

**File:** `artifacts/api-server/src/tools/everything.ts`

**Strategy:** Keep Voidtools Everything for Windows, use `locate` (from `plocate` or `mlocate`) on Linux.

```typescript
func: async ({ query, maxResults }) => {
  if (process.platform !== "win32") {
    // Linux: use locate (fast inode-indexed search, requires mlocate/plocate)
    return new Promise(resolve => {
      child_process.exec(
        `locate -l ${maxResults} "${query.replace(/"/g, '\\"')}"`,
        { maxBuffer: 1024 * 1024 * 5 },
        (err, stdout, stderr) => {
          if (err && !stdout.trim()) {
            // locate not installed OR database not updated
            if (stderr?.includes("command not found") || err.code === 127) {
              resolve("locate is not installed. Run: sudo apt install plocate");
            } else {
              // Fallback: use `find` (slower but always available)
              child_process.exec(
                `find / -name "*${query.replace(/"/g, '\\"')}*" -maxdepth 10 2>/dev/null | head -${maxResults}`,
                { maxBuffer: 1024 * 1024 * 5, timeout: 30000 },
                (err2, out2) => resolve(out2.trim() || `No results found for "${query}"`)
              );
            }
          } else {
            resolve(stdout.trim() || `No results found for "${query}"`);
          }
        }
      );
    });
  }
  // existing Windows Everything implementation...
}
```

Also update the tool's `description` field to mention both platforms:
```typescript
description: "Search the filesystem for files or folders. On Windows uses Voidtools Everything (instant NTFS index). On Linux uses locate/find.",
```

---

### 2.3 — `uiautomation.ts` — Linux fallback via xdotool

**File:** `artifacts/api-server/src/tools/uiautomation.ts`

The Windows UIAutomation accessibility tree has no direct Linux equivalent without a significant AT-SPI2 integration. The pragmatic approach is:

- `uia_inspect_window` → on Linux, return the active window title + PID using `xdotool` and `wmctrl -l`. Accessibility tree dumping is out of scope for now.
- `uia_click_element` → on Linux, `xdotool search --name "<name>"` + `xdotool click` using the found window/control position. This is a best-effort approximation.
- `uia_set_text` → on Linux, focus the window then `xdotool type "<text>"`.

```typescript
// At top of each tool's func:
if (process.platform !== "win32") {
  // uia_inspect_window
  return new Promise(resolve => {
    child_process.exec(
      "xdotool getactivewindow getwindowname; wmctrl -l",
      (err, stdout) => resolve(stdout || "Could not inspect window. Ensure xdotool and wmctrl are installed.")
    );
  });
}

// uia_click_element — find by window name, then click
if (process.platform !== "win32") {
  return new Promise(resolve => {
    child_process.exec(`xdotool search --name "${name}" windowfocus click`, (err, _, stderr) => {
      if (err) resolve(`Could not find/click element: ${stderr || err.message}`);
      else resolve("Click executed.");
    });
  });
}

// uia_set_text
if (process.platform !== "win32") {
  return new Promise(resolve => {
    child_process.exec(`xdotool type --clearmodifiers "${text.replace(/"/g, '\\"')}"`, (err, _, stderr) => {
      if (err) resolve(`Could not type text: ${stderr || err.message}`);
      else resolve("Text typed successfully.");
    });
  });
}
```

---

### 2.4 — Active window tracking in `main.cts`

**File:** `artifacts/jarvis/electron/main.cts` — lines 354–421

**Current:** A persistent PowerShell process using `GetForegroundWindow()` Win32 P/Invoke, polling every 2 seconds.

**Fix:** Wrap the existing PowerShell approach in a `win32` guard, add an `xdotool`-based poller for Linux.

```typescript
// Replace the unconditional psProcess block with:

if (process.platform === "win32") {
  // ── EXISTING PowerShell implementation (unchanged) ──
  const psProcess = spawn("powershell", ["-NoProfile", "-Command", psScript]);
  psProcess.stdout.on("data", (data) => { /* existing handler */ });
  psProcess.stderr.on("data", (data) => { console.error("PowerShell Error:", data.toString()); });
  app.on("will-quit", () => { try { psProcess.kill(); } catch {} });

} else if (process.platform === "linux") {
  // ── Linux: poll with xdotool every 2 seconds ──
  const pollLinux = () => {
    child_process.exec(
      "xdotool getactivewindow getwindowname 2>/dev/null && xdotool getactivewindow getwindowpid 2>/dev/null",
      (err, stdout) => {
        if (!mainWindow || err) return;
        const lines = stdout.trim().split("\n");
        const title = lines[0] || "";
        const pid = lines[1] || "";
        if (title && title !== lastActiveWindowTitle) {
          lastActiveWindowTitle = title;
          if (title.includes("JARVIS")) return;
          mainWindow.webContents.send("active-window-changed", {
            title,
            owner: { name: pid }
          });
        }
      }
    );
  };
  const linuxPollInterval = setInterval(pollLinux, 2000);
  app.on("will-quit", () => clearInterval(linuxPollInterval));

} else if (process.platform === "darwin") {
  // macOS: existing behavior or AppleScript polling (already partially handled elsewhere)
}
```

---

## Phase 3 — Replace `@hurdlegroup/robotjs`

**This is the largest change.** `@hurdlegroup/robotjs` is unmaintained and has no Linux native binary. All mouse, keyboard, and screen-size tools in `computer.ts` depend on it, as does `antigravity.ts`.

### Replacement: `@nut-tree/nut-js`

`@nut-tree/nut-js` is the actively maintained cross-platform successor. It supports Windows, macOS, and Linux (X11 via libXtst).

**Package changes:**

```bash
# Remove
pnpm remove @hurdlegroup/robotjs --filter @workspace/api-server

# Add
pnpm add @nut-tree/nut-js --filter @workspace/api-server

# Linux system requirement (must document for users)
sudo apt install libxtst-dev libpng-dev
```

**Add to `onlyBuiltDependencies` in root `package.json`:**
```json
"@nut-tree/nut-js"
```

---

### 3.1 — Rewrite `computer.ts` — mouse and keyboard tools

**File:** `artifacts/api-server/src/tools/computer.ts`

Replace the `robotjs` import and all `robot.*` calls with `@nut-tree/nut-js` equivalents.

#### Import change

```typescript
// Remove:
import robot from "@hurdlegroup/robotjs";

// Add:
import { mouse, keyboard, screen, Button, Key } from "@nut-tree/nut-js";
```

#### `mouse_control` — API mapping

| robotjs | nut-js |
|---|---|
| `robot.moveMouse(x, y)` | `await mouse.move(straightTo(point(x, y)))` |
| `robot.moveMouseSmooth(x, y)` | `await mouse.move(straightTo(point(x, y)))` |
| `robot.mouseClick()` | `await mouse.click(Button.LEFT)` |
| `robot.mouseClick("right")` | `await mouse.click(Button.RIGHT)` |
| `robot.mouseClick("left", true)` | `await mouse.doubleClick(Button.LEFT)` |
| `robot.scrollMouse(0, amount)` | `await mouse.scrollDown(Math.abs(amount))` / `scrollUp` |
| `robot.mouseToggle("down")` | `await mouse.pressButton(Button.LEFT)` |
| `robot.dragMouse(x2, y2)` | `await mouse.move(straightTo(point(x2, y2)))` |
| `robot.mouseToggle("up")` | `await mouse.releaseButton(Button.LEFT)` |

```typescript
import { mouse, keyboard, screen, Button, Key, straightTo, point } from "@nut-tree/nut-js";

// mouse_control func:
func: async ({ action, x, y, x2, y2, amount }) => {
  try {
    if (action === "move" && x !== undefined && y !== undefined) {
      await mouse.move(straightTo(point(x, y)));
    } else if (action === "click") {
      if (x !== undefined && y !== undefined) await mouse.move(straightTo(point(x, y)));
      await mouse.click(Button.LEFT);
    } else if (action === "double_click") {
      if (x !== undefined && y !== undefined) await mouse.move(straightTo(point(x, y)));
      await mouse.doubleClick(Button.LEFT);
    } else if (action === "right_click") {
      if (x !== undefined && y !== undefined) await mouse.move(straightTo(point(x, y)));
      await mouse.click(Button.RIGHT);
    } else if (action === "scroll") {
      if (x !== undefined && y !== undefined) await mouse.move(straightTo(point(x, y)));
      if ((amount || -3) < 0) await mouse.scrollUp(Math.abs(amount || 3));
      else await mouse.scrollDown(amount || 3);
    } else if (action === "drag") {
      if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined) {
        await mouse.move(straightTo(point(x, y)));
        await mouse.pressButton(Button.LEFT);
        await mouse.move(straightTo(point(x2, y2)));
        await mouse.releaseButton(Button.LEFT);
      } else return "Error: x, y, x2, y2 all required for drag.";
    }
    return `Mouse ${action} executed successfully.`;
  } catch (err: any) {
    return `Error executing mouse_control: ${err.message}`;
  }
}
```

#### `get_cursor_position`

```typescript
func: async () => {
  const pos = await mouse.getPosition();
  return `Current cursor position: x=${pos.x}, y=${pos.y}`;
}
```

#### `get_screen_size`

```typescript
func: async () => {
  const size = await screen.width();
  const height = await screen.height();
  return `Screen size: ${size} x ${height} pixels`;
}
```

#### `keyboard_control` — API mapping

| robotjs | nut-js |
|---|---|
| `robot.typeString(text)` | `await keyboard.type(text)` |
| `robot.keyTap(key, modifiers)` | `await keyboard.pressKey(...modifiers, key); await keyboard.releaseKey(...modifiers, key)` |

Key name mapping (robotjs → nut-js `Key` enum):

| robotjs string | nut-js Key |
|---|---|
| `"enter"` | `Key.Return` |
| `"tab"` | `Key.Tab` |
| `"escape"` | `Key.Escape` |
| `"backspace"` | `Key.Backspace` |
| `"delete"` | `Key.Delete` |
| `"control"` | `Key.LeftControl` |
| `"alt"` | `Key.LeftAlt` |
| `"shift"` | `Key.LeftShift` |
| `"f4"` | `Key.F4` |
| `"up"` | `Key.Up` |
| `"down"` | `Key.Down` |
| `"left"` | `Key.Left` |
| `"right"` | `Key.Right` |
| `"home"` | `Key.Home` |
| `"end"` | `Key.End` |
| `"pageup"` | `Key.PageUp` |
| `"pagedown"` | `Key.PageDown` |
| `"c"` (alpha) | `Key.C` |

Build a `keyMap: Record<string, Key>` object to do the translation. Any unknown key should return a helpful error.

```typescript
func: async ({ action, text, keys }) => {
  try {
    if (action === "type") {
      if (!text) return "Error: text is required for type.";
      await keyboard.type(text);
    } else if (action === "hotkey") {
      if (!keys) return "Error: keys is required for hotkey.";
      const parts = keys.split(",").map(k => k.trim().toLowerCase());
      const nutKeys = parts.map(k => keyMap[k] ?? k);
      await keyboard.pressKey(...nutKeys);
      await keyboard.releaseKey(...nutKeys);
    } else if (action === "press") {
      if (!keys) return "Error: keys is required for press.";
      const nutKey = keyMap[keys.trim().toLowerCase()];
      if (!nutKey) return `Unknown key: ${keys}`;
      await keyboard.pressKey(nutKey);
      await keyboard.releaseKey(nutKey);
    }
    return `Keyboard ${action} executed successfully.`;
  } catch (err: any) {
    return `Error executing keyboard_control: ${err.message}`;
  }
}
```

#### `window_management` — replace `node-window-manager`

`node-window-manager` has partial Linux support but unreliable bindings. Replace the `close` action's `robot.keyTap("f4", "alt")` with nut-js, and for the rest use `wmctrl`:

```typescript
// list_windows → wmctrl -l on Linux, windowManager.getWindows() on Windows
// minimize/maximize/restore/focus → wmctrl -r "<title>" -b add,minimized etc.
// close → wmctrl -c "<title>"

if (process.platform !== "win32") {
  if (action === "list_windows") {
    return new Promise(resolve =>
      child_process.exec("wmctrl -l", (err, out) =>
        resolve(err ? "wmctrl not found. Install with: sudo apt install wmctrl" : out.trim())
      )
    );
  }
  if (!window_title) return "Error: window_title is required.";
  const wmctrlActionMap: Record<string, string> = {
    minimize: `wmctrl -r "${window_title}" -b add,minimized`,
    maximize: `wmctrl -r "${window_title}" -b add,maximized_vert,maximized_horz`,
    restore:  `wmctrl -r "${window_title}" -b remove,maximized_vert,maximized_horz`,
    focus:    `wmctrl -a "${window_title}"`,
    close:    `wmctrl -c "${window_title}"`,
  };
  const cmd = wmctrlActionMap[action];
  return new Promise(resolve =>
    child_process.exec(cmd, (err, _, stderr) =>
      resolve(err ? `Error: ${stderr || err.message}` : `${action} applied to window matching "${window_title}".`)
    )
  );
}
// existing node-window-manager Windows implementation below
```

---

### 3.2 — Update `antigravity.ts`

**File:** `artifacts/api-server/src/tools/antigravity.ts`

Replace `robot.keyTap(...)` and `robot.typeString(...)` with `@nut-tree/nut-js`:

```typescript
// Remove:
import robot from "@hurdlegroup/robotjs";

// Add:
import { keyboard, Key } from "@nut-tree/nut-js";

// Replace:
robot.keyTap(shortcut.toLowerCase(), [modifier as any]);
// With:
const modKey = process.platform === "darwin" ? Key.LeftSuper : Key.LeftControl;
const shortcutKey = keyMap[shortcut.toLowerCase()] ?? shortcut.toUpperCase();
await keyboard.pressKey(modKey, shortcutKey);
await keyboard.releaseKey(modKey, shortcutKey);

// Replace:
robot.keyTap("v", [modifier as any]);
// With:
const mod = process.platform === "darwin" ? Key.LeftSuper : Key.LeftControl;
await keyboard.pressKey(mod, Key.V);
await keyboard.releaseKey(mod, Key.V);

// Replace:
robot.keyTap("enter");
// With:
await keyboard.pressKey(Key.Return);
await keyboard.releaseKey(Key.Return);
```

---

### 3.3 — Handle `findIdeWindow` in `antigravity.ts`

`node-window-manager` is also used in `findIdeWindow`. Add a Linux path using `wmctrl`:

```typescript
async function findIdeWindowLinux(maxWaitMs: number) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const result = await new Promise<string>(resolve =>
      child_process.exec("wmctrl -l", (_, out) => resolve(out || ""))
    );
    if (result.toLowerCase().includes("antigravity")) return true;
    await delay(500);
  }
  return false;
}

// In the main func:
if (process.platform !== "win32") {
  const found = await findIdeWindowLinux(workspacePath ? 10000 : 3000);
  if (!found) return workspacePath
    ? "Error: Antigravity IDE did not open within 10 seconds."
    : "Error: Could not find an open Antigravity IDE window.";
  // Then use xdotool to focus:
  child_process.exec(`wmctrl -a antigravity`);
  await delay(800);
  // keyboard shortcut already handled above
}
```

---

## Native Module Build Changes

### `package.json` (root) — `onlyBuiltDependencies`

Add nut-js to ensure its native bindings are rebuilt during install:

```json
"onlyBuiltDependencies": [
  "better-sqlite3",
  "sqlite-vec",
  "@img/sharp-win32-x64",
  "@nut-tree/nut-js"
]
```

### `electron-builder` — `extraResources` for Linux

nut-js bundles its own native `.so` files. Ensure they unpack correctly from asar:

```json
"asarUnpack": [
  "**/*.node",
  "**/*.dll",
  "**/*.so",
  "**/*.dylib",
  "**/node_modules/@nut-tree/**"
]
```

### CI / Build Script

If a GitHub Actions or build pipeline exists, add a Linux build job:

```yaml
- name: Install Linux system deps
  run: |
    sudo apt-get update
    sudo apt-get install -y libxtst-dev libpng-dev rpm fakeroot

- name: Build (Linux)
  run: pnpm run electron:build
  env:
    CSC_IDENTITY_AUTO_DISCOVERY: false  # skip code signing on Linux
```

---

## File Change Summary

| File | Change | Phase |
|---|---|---|
| `artifacts/api-server/src/services/chatService.ts` | Platform-branch `open_app` and `open_website` | 1 |
| `artifacts/api-server/src/tools/computer.ts` | Platform-branch `clipboard`; fix screenshot path; swap robotjs → nut-js | 1 + 3 |
| `artifacts/api-server/src/tools/antigravity.ts` | Fix `\\` path separator; swap robotjs → nut-js; add Linux window find | 1 + 3 |
| `artifacts/api-server/src/tools/shell.ts` | Graceful error on non-Windows for PowerShell/CMD tools | 1 |
| `artifacts/api-server/src/tools/windowsSystem.ts` | Add Linux equivalents for media/power/brightness; disable registry | 2 |
| `artifacts/api-server/src/tools/everything.ts` | Add `locate`/`find` fallback on Linux | 2 |
| `artifacts/api-server/src/tools/uiautomation.ts` | xdotool-based fallback for inspect/click/type | 2 |
| `artifacts/jarvis/electron/main.cts` | Platform-branch active window polling; add xdotool poller for Linux | 2 |
| `artifacts/jarvis/package.json` | Expand Linux electron-builder config | 1 |
| `package.json` (root) | Add nut-js to onlyBuiltDependencies | 3 |

---

## Implementation Order

```
Phase 1 (start here — zero dependency changes)
  1.4  antigravity.ts path separator fix      ← trivial, do first
  1.1  chatService.ts open_app                ← high value, simple
  1.2  chatService.ts open_website            ← same PR as 1.1
  1.3  computer.ts clipboard                  ← medium complexity
  1.5  computer.ts screen_capture path        ← trivial
  1.6  shell.ts graceful errors               ← 3 lines each
  1.7  electron-builder config                ← config only

Phase 2 (after Phase 1 is merged and tested)
  2.4  main.cts active window Linux poller    ← do first, high visibility
  2.1  windowsSystem.ts Linux equivalents     ← most user-facing value
  2.2  everything.ts locate fallback          ← medium complexity
  2.3  uiautomation.ts xdotool fallback       ← medium complexity

Phase 3 (after Phase 2 — requires careful API migration testing)
  Install @nut-tree/nut-js, remove robotjs
  3.1  computer.ts full rewrite
  3.2  antigravity.ts nut-js keyboard
  3.3  antigravity.ts Linux window find
  Update onlyBuiltDependencies + asarUnpack
```

---

## Testing Checklist (Linux)

Tested on Ubuntu 22.04 LTS, X11 session.

**Phase 1**
- [ ] `open_app "firefox"` launches Firefox
- [ ] `open_website "https://google.com"` opens in default browser via xdg-open
- [ ] `clipboard write "hello"` then `clipboard read` returns "hello"
- [ ] `screen_capture` saves PNG to Desktop without path error
- [ ] `execute_powershell` returns helpful "not available" message
- [ ] `execute_bash "echo hello"` works

**Phase 2**
- [ ] Active window title updates in JARVIS when switching apps
- [ ] `media_control play_pause` controls Spotify/Firefox playback via playerctl
- [ ] `power_management lock` locks the screen via loginctl
- [ ] `display_brightness 50` sets brightness via brightnessctl
- [ ] `registry_control` returns "Windows-only" message
- [ ] `search_everything "*.pdf"` returns results via locate
- [ ] `search_everything` falls back to `find` if locate not installed
- [ ] `uia_inspect_window` returns active window name via xdotool
- [ ] `window_management list_windows` returns window list via wmctrl

**Phase 3**
- [ ] `mouse_control click 500 300` clicks at coordinates
- [ ] `mouse_control scroll` scrolls page
- [ ] `keyboard_control type "hello"` types in focused field
- [ ] `keyboard_control hotkey "control,c"` sends Ctrl+C
- [ ] `get_cursor_position` returns current x,y
- [ ] `get_screen_size` returns screen resolution
- [ ] `window_management close "gedit"` closes the window
- [ ] `delegate_to_antigravity` opens Antigravity IDE and sends prompt

**Build**
- [ ] `pnpm run electron:build` produces `dist/release/*.AppImage`
- [ ] AppImage runs on clean Ubuntu 22.04
- [ ] All tools load without import errors (no robotjs missing binary crash)
- [ ] Settings page loads and saves credentials correctly
