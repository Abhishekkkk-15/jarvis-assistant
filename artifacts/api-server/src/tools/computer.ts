import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import robot from "@hurdlegroup/robotjs";
import { windowManager } from "node-window-manager";

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
  // MOUSE CONTROL — real robotjs implementation
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
      duration: z.number().optional().describe("Movement duration in seconds (ignored by robotjs)"),
    }),
    func: async ({ action, x, y, x2, y2, amount }) => {
      try {
        if (action === "move") {
          if (x !== undefined && y !== undefined) {
             robot.moveMouseSmooth(x, y);
          } else {
            return "Error: x and y are required for move.";
          }
        } else if (action === "click") {
          if (x !== undefined && y !== undefined) robot.moveMouse(x, y);
          robot.mouseClick();
        } else if (action === "double_click") {
          if (x !== undefined && y !== undefined) robot.moveMouse(x, y);
          robot.mouseClick("left", true);
        } else if (action === "right_click") {
          if (x !== undefined && y !== undefined) robot.moveMouse(x, y);
          robot.mouseClick("right");
        } else if (action === "scroll") {
           // robotjs scroll is horizontal, vertical
           if (x !== undefined && y !== undefined) robot.moveMouse(x, y);
           robot.scrollMouse(0, amount || -3);
        } else if (action === "drag") {
          if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined) {
             robot.moveMouse(x, y);
             robot.mouseToggle("down");
             robot.dragMouse(x2, y2);
             robot.mouseToggle("up");
          } else {
            return "Error: x, y, x2, y2 all required for drag.";
          }
        }
        return `Mouse ${action} executed successfully${x !== undefined ? ` at (${x}, ${y})` : ""}.`;
      } catch (err: any) {
        return `Error executing mouse_control: ${err.message}`;
      }
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
      try {
        const pos = robot.getMousePos();
        return `Current cursor position: x=${pos.x}, y=${pos.y}`;
      } catch (err: any) {
        return `Error getting cursor position: ${err.message}`;
      }
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
      try {
        const size = robot.getScreenSize();
        return `Screen size: ${size.width} x ${size.height} pixels`;
      } catch(err: any) {
         return `Error getting screen size: ${err.message}`;
      }
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // KEYBOARD CONTROL — real robotjs implementation
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
      keys: z.string().optional().describe("Key name or comma-separated key combo (e.g. 'control,c' or 'enter'). Note: robotjs uses 'control' not 'ctrl'."),
      interval: z.number().optional().describe("Interval between keystrokes in seconds (ignored by robotjs)"),
    }),
    func: async ({ action, text, keys }) => {
      try {
        if (action === "type") {
          if (!text) return "Error: text is required for type action.";
          // To send characters fast without delay:
          robot.typeString(text);
        } else if (action === "hotkey") {
          if (!keys) return "Error: keys is required for hotkey action.";
          const parts = keys.split(",").map(k => k.trim().toLowerCase());
          const key = parts.pop() as string;
          robot.keyTap(key, parts as any);
        } else if (action === "press") {
          if (!keys) return "Error: keys is required for press action.";
          robot.keyTap(keys.trim().toLowerCase());
        }
        return `Keyboard ${action} executed successfully: ${text || keys}`;
      } catch (err: any) {
        return `Error executing keyboard_control: ${err.message}`;
      }
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
  // OCR IMAGE — extract text from an image file using Tesseract
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "ocr_image",
    description: "Extract text from any image file (PNG, JPG, BMP, TIFF, etc.) using OCR (Tesseract). Returns all recognized text from the file.",
    schema: z.object({
      file_path: z.string().describe("Absolute path to the image file to read"),
      language: z.string().default("eng").describe("OCR language code (eng, fra, deu, spa, etc.) — default is English"),
    }),
    func: async ({ file_path, language }) => {
      try {
        await fs.stat(file_path);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(language);
        const { data } = await worker.recognize(file_path);
        await worker.terminate();
        return data.text.trim() || "No text found in image.";
      } catch (err: any) {
        return `OCR error: ${err.message}`;
      }
    },
  }),

  // ──────────────────────────────────────────────────────────────
  // WINDOW MANAGEMENT — node-window-manager implementation
  // ──────────────────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: "window_management",
    description:
      "Manage windows on Windows natively using node-window-manager. " +
      "Actions: minimize, maximize, restore, close, focus, list_windows. " +
      "window_title is a partial match (case-insensitive). " +
      "For list_windows, window_title is ignored.",
    schema: z.object({
      action: z.enum(["minimize", "maximize", "restore", "close", "focus", "list_windows"]),
      window_title: z.string().optional().describe("Partial window title to match"),
    }),
    func: async ({ action, window_title }) => {
      try {
        if (action === "list_windows") {
          windowManager.requestAccessibility();
          const windows = windowManager.getWindows();
          const list = windows
              .filter(w => w.isVisible() && w.getTitle())
              .map(w => w.getTitle());
          const uniqueList = Array.from(new Set(list));
          return `Open windows:\n${uniqueList.join("\n")}`;
        }

        if (!window_title) return "Error: window_title is required for this action.";

        const targetTitle = window_title.toLowerCase();
        windowManager.requestAccessibility();
        const windows = windowManager.getWindows();
        const matchedWindows = windows.filter(w => w.isVisible() && w.getTitle().toLowerCase().includes(targetTitle));

        if (matchedWindows.length === 0) {
            return `No open windows found matching "${window_title}"`;
        }

        for (const win of matchedWindows) {
            if (action === "minimize") win.minimize();
            else if (action === "maximize") win.maximize();
            else if (action === "restore") win.restore();
            else if (action === "focus") win.bringToTop();
            else if (action === "close") {
                // node-window-manager does not have a direct close() method, we can kill its process or send a close key
                // A reliable way is sending alt+f4 using robotjs to the focused window.
                win.bringToTop();
                robot.keyTap("f4", "alt");
            }
        }
        
        return `${action} applied successfully to ${matchedWindows.length} window(s) matching "${window_title}".`;
      } catch (err: any) {
        return `Error in window_management: ${err.message}`;
      }
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
