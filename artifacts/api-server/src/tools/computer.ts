import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";

// ─────────────────────────────────────────────────────────────────
// Helper: run a python one-liner via pyautogui
// ─────────────────────────────────────────────────────────────────
function runPython(code: string, timeout = 8000): Promise<string> {
  return new Promise((resolve) => {
    const escaped = code.replace(/"/g, '\\"');
    child_process.exec(
      `python -c "${escaped}"`,
      { timeout },
      (err, stdout, stderr) => {
        if (err) resolve(`Error: ${stderr || err.message}`);
        else resolve(stdout.trim() || "OK");
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────────
// Helper: run a PowerShell snippet
// ─────────────────────────────────────────────────────────────────
function runPS(script: string, timeout = 10000): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
      { timeout },
      (err, stdout, stderr) => {
        if (err) resolve(`PS Error: ${stderr || err.message}`);
        else resolve(stdout.trim() || "OK");
      }
    );
  });
}

export const computerTools = [
  // ──────────────────────────────────────────────────────────────
  // MOUSE CONTROL — real pyautogui implementation
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "mouse_control",
    description:
      "Control the computer mouse with REAL actions. " +
      "Actions: move (move to x,y), click (left click at x,y), " +
      "double_click, right_click, scroll (scroll at x,y by amount), drag (drag from x,y to x2,y2). " +
      "If x,y are omitted, action happens at current cursor position. " +
      "Use get_cursor_position first to know where the cursor is.",
    schema: z.object({
      action: z.enum(["move", "click", "double_click", "right_click", "scroll", "drag"]),
      x: z.number().optional().describe("Target X coordinate"),
      y: z.number().optional().describe("Target Y coordinate"),
      x2: z.number().optional().describe("End X for drag"),
      y2: z.number().optional().describe("End Y for drag"),
      amount: z.number().optional().describe("Scroll amount (positive = down, negative = up)"),
      duration: z.number().optional().describe("Movement duration in seconds (default 0.3)"),
    }),
    func: async ({ action, x, y, x2, y2, amount, duration }) => {
      const dur = duration ?? 0.3;

      let code = "import pyautogui; pyautogui.FAILSAFE = False; ";
      switch (action) {
        case "move":
          if (x !== undefined && y !== undefined)
            code += `pyautogui.moveTo(${x}, ${y}, duration=${dur})`;
          else return "Error: x and y are required for move.";
          break;
        case "click":
          code += x !== undefined && y !== undefined
            ? `pyautogui.click(${x}, ${y})`
            : `pyautogui.click()`;
          break;
        case "double_click":
          code += x !== undefined && y !== undefined
            ? `pyautogui.doubleClick(${x}, ${y})`
            : `pyautogui.doubleClick()`;
          break;
        case "right_click":
          code += x !== undefined && y !== undefined
            ? `pyautogui.rightClick(${x}, ${y})`
            : `pyautogui.rightClick()`;
          break;
        case "scroll":
          code += `pyautogui.scroll(${amount ?? -3}${x !== undefined ? `, x=${x}, y=${y}` : ""})`;
          break;
        case "drag":
          if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined)
            code += `pyautogui.moveTo(${x}, ${y}); pyautogui.dragTo(${x2}, ${y2}, duration=${dur})`;
          else return "Error: x, y, x2, y2 all required for drag.";
          break;
      }

      const result = await runPython(code);
      if (result.startsWith("Error")) return result;
      return `Mouse ${action} executed successfully${x !== undefined ? ` at (${x}, ${y})` : ""}.`;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // GET CURSOR POSITION — so JARVIS knows where the mouse is
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "get_cursor_position",
    description: "Returns the current mouse cursor position (x, y) on screen. Use this before mouse_control to know where to click or move.",
    schema: z.object({}),
    func: async () => {
      const result = await runPython(
        "import pyautogui; x, y = pyautogui.position(); print(f'{x},{y}')"
      );
      if (result.startsWith("Error")) return result;
      const [x, y] = result.split(",");
      return `Current cursor position: x=${x}, y=${y}`;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // FIND AND CLICK TEXT (OCR / Semantic UI Vision)
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "find_and_click_text",
    description: "Captures the screen, uses OCR to find the specified text, and clicks it. Use this when you don't know the exact X/Y coordinates of a UI button but you know its text.",
    schema: z.object({
      text: z.string().describe("The exact text to find and click on the screen (case-insensitive substring)"),
      action: z.enum(["click", "double_click", "right_click"]).default("click"),
    }),
    func: async ({ text, action }) => {
      try {
        const tmpPath = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
        const captureResult = await runPython(`import pyautogui; pyautogui.screenshot('${tmpPath.replace(/\\/g, '\\\\')}')`);
        if (captureResult.startsWith("Error")) return captureResult;

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker('eng');
        const { data } = await worker.recognize(tmpPath);
        await worker.terminate();

        const target = text.toLowerCase();
        let foundWord = null;

        for (const word of data.words) {
          if (word.text.toLowerCase().includes(target)) {
            foundWord = word;
            break;
          }
        }

        if (!foundWord) {
          return `Could not find text "${text}" on the screen.`;
        }

        const bbox = foundWord.bbox;
        const centerX = Math.floor((bbox.x0 + bbox.x1) / 2);
        const centerY = Math.floor((bbox.y0 + bbox.y1) / 2);

        let code = "import pyautogui; pyautogui.FAILSAFE = False; ";
        if (action === "click") code += `pyautogui.click(${centerX}, ${centerY})`;
        else if (action === "double_click") code += `pyautogui.doubleClick(${centerX}, ${centerY})`;
        else if (action === "right_click") code += `pyautogui.rightClick(${centerX}, ${centerY})`;

        const clickResult = await runPython(code);
        if (clickResult.startsWith("Error")) return clickResult;

        return `Successfully found "${text}" and executed ${action} at (${centerX}, ${centerY}).`;
      } catch (err: any) {
        return `Error during OCR processing: ${err.message}`;
      }
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // GET SCREEN SIZE
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "get_screen_size",
    description: "Returns the screen resolution (width x height). Use this to calculate where to click on the screen.",
    schema: z.object({}),
    func: async () => {
      const result = await runPython(
        "import pyautogui; w, h = pyautogui.size(); print(f'{w},{h}')"
      );
      if (result.startsWith("Error")) return result;
      const [w, h] = result.split(",");
      return `Screen size: ${w} x ${h} pixels`;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // KEYBOARD CONTROL — real pyautogui implementation
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "keyboard_control",
    description:
      "Type text or press keyboard keys with REAL actions. " +
      "Use action='type' to type a string, action='hotkey' to press combos (e.g. 'ctrl,c'), " +
      "action='press' to press a single special key (e.g. 'enter', 'tab', 'escape', 'f5', 'delete', 'backspace', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown'). " +
      "Always click the target window/field first with mouse_control before typing.",
    schema: z.object({
      action: z.enum(["type", "hotkey", "press"]),
      text: z.string().optional().describe("Text to type (for action='type')"),
      keys: z.string().optional().describe("Key name or comma-separated key combo (e.g. 'ctrl,c' or 'enter')"),
      interval: z.number().optional().describe("Interval between keystrokes in seconds (default 0.05)"),
    }),
    func: async ({ action, text, keys, interval }) => {
      let code = "import pyautogui; import time; pyautogui.FAILSAFE = False; ";
      switch (action) {
        case "type":
          if (!text) return "Error: text is required for type action.";
          // Escape single quotes
          const safeText = text.replace(/'/g, "\\'");
          code += `pyautogui.write('${safeText}', interval=${interval ?? 0.05})`;
          break;
        case "hotkey":
          if (!keys) return "Error: keys is required for hotkey action.";
          const keyList = keys.split(",").map(k => `'${k.trim()}'`).join(", ");
          code += `pyautogui.hotkey(${keyList})`;
          break;
        case "press":
          if (!keys) return "Error: keys is required for press action.";
          code += `pyautogui.press('${keys.trim()}')`;
          break;
      }
      const result = await runPython(code);
      if (result.startsWith("Error")) return result;
      return `Keyboard ${action} executed successfully: ${text || keys}`;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // SCREEN CAPTURE — real screenshot using PowerShell
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "screen_capture",
    description: "Take a real screenshot of the entire screen and save it to a file. Returns the file path.",
    schema: z.object({
      save_path: z.string().optional().describe("Where to save the screenshot (default: Desktop/jarvis_screenshot.png)"),
    }),
    func: async ({ save_path }) => {
      const outPath = save_path || path.join(os.homedir(), "Desktop", `jarvis_screenshot_${Date.now()}.png`);
      // Use pyautogui to capture screenshot
      const code = `import pyautogui; img = pyautogui.screenshot(); img.save(r'${outPath.replace(/\\/g, "\\\\")}'); print('OK')`;
      const result = await runPython(code);
      if (result.startsWith("Error")) return result;
      return `Screenshot saved to: ${outPath}`;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // WINDOW MANAGEMENT — real PowerShell implementation
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "window_management",
    description:
      "Manage windows on Windows. " +
      "Actions: minimize, maximize, restore, close, focus, list_windows. " +
      "window_title is a partial match (case-insensitive). " +
      "For list_windows, window_title is ignored.",
    schema: z.object({
      action: z.enum(["minimize", "maximize", "restore", "close", "focus", "list_windows"]),
      window_title: z.string().optional().describe("Partial window title to match"),
    }),
    func: async ({ action, window_title }) => {
      if (action === "list_windows") {
        const result = await runPS(
          `Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle | Sort-Object -Unique`
        );
        return `Open windows:\n${result}`;
      }

      if (!window_title) return "Error: window_title is required for this action.";

      const psAction = {
        minimize: "SW_MINIMIZE",
        maximize: "SW_MAXIMIZE",
        restore: "SW_RESTORE",
        close: "close()",
        focus: "SW_RESTORE",
      }[action];

      if (action === "close") {
        const result = await runPS(
          `$procs = Get-Process | Where-Object {$_.MainWindowTitle -match '${window_title}'}; $procs | ForEach-Object { $_.CloseMainWindow() } | Out-Null; "Closed $($procs.Count) window(s)"`
        );
        return result;
      }

      // Use pygetwindow for maximize/minimize/restore/focus
      const gwAction = { minimize: "minimize", maximize: "maximize", restore: "restore", focus: "activate" }[action];
      const code = `import pygetwindow as gw; wins = gw.getWindowsWithTitle('${window_title}'); [w.${gwAction}() for w in wins]; print(f'${action} applied to {len(wins)} window(s)')`;
      const result = await runPython(code);
      if (result.startsWith("Error")) return result;
      return result;
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // CLIPBOARD — read/write clipboard content
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "clipboard",
    description: "Read or write clipboard content. Action 'read' returns clipboard text; 'write' sets clipboard text.",
    schema: z.object({
      action: z.enum(["read", "write"]),
      text: z.string().optional().describe("Text to write to clipboard (for action='write')"),
    }),
    func: async ({ action, text }) => {
      if (action === "read") {
        const result = await runPS(`Get-Clipboard`);
        return `Clipboard content: ${result}`;
      } else {
        if (!text) return "Error: text is required for write action.";
        const safeText = text.replace(/'/g, "''"); // PS single-quote escaping
        const result = await runPS(`Set-Clipboard -Value '${safeText}'; echo 'OK'`);
        return `Clipboard set to: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`;
      }
    },
  }),
];
