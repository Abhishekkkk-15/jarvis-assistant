import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import robot from "@hurdlegroup/robotjs";
import { windowManager } from "node-window-manager";
import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Sets the system clipboard via a temp file to handle any text,
// including special characters, backticks, quotes, and non-ASCII.
const setClipboard = async (text: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      const tmp = `${os.tmpdir()}\\jarvis_clip_${Date.now()}.txt`;
      try {
        fs.writeFileSync(tmp, text, "utf8");
      } catch (err: any) {
        return reject(new Error(`Failed to write clipboard temp file: ${err.message}`));
      }
      child_process.exec(
        `powershell -NoProfile -NonInteractive -Command "Get-Content -Path '${tmp}' -Raw | Set-Clipboard"`,
        (err) => {
          try { fs.unlinkSync(tmp); } catch {}
          err ? reject(new Error(`Clipboard failed: ${err.message}`)) : resolve();
        }
      );
    } else if (process.platform === "darwin") {
      const proc = child_process.spawn("pbcopy");
      if (!proc.stdin) return reject(new Error("pbcopy stdin unavailable"));
      proc.stdin.write(text, "utf8");
      proc.stdin.end();
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`)));
      proc.on("error", reject);
    } else {
      const proc = child_process.spawn("xclip", ["-selection", "clipboard"]);
      if (!proc.stdin) return reject(new Error("xclip stdin unavailable"));
      proc.stdin.write(text, "utf8");
      proc.stdin.end();
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`xclip exited ${code}`)));
      proc.on("error", reject);
    }
  });
};

// Polls for the Antigravity IDE window by title AND exe path,
// giving it up to maxWaitMs to appear (useful after a cold launch).
const findIdeWindow = async (maxWaitMs: number) => {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const windows = windowManager.getWindows();
    const found = windows.find(w => {
      if (!w.isVisible()) return false;
      const title = w.getTitle().toLowerCase();
      const exePath = ((w as any).path ?? "").toLowerCase();
      return title.includes("antigravity") || exePath.includes("antigravity");
    });
    if (found) return found;
    await delay(500);
  }
  return null;
};

export const antigravityTools = [
  new DynamicStructuredTool({
    name: "delegate_to_antigravity",
    description: "Delegates a coding task to the standalone Antigravity IDE. It opens the Antigravity IDE, focuses its AI chat, and types the prompt. Do NOT use this if the user specifically asked for Claude or another tool.",
    schema: z.object({
      prompt: z.string().describe("The instruction to send to Antigravity IDE (e.g., 'add a new login module')."),
      workspacePath: z.string().optional().describe("Optional path to the project directory to open in Antigravity IDE."),
      shortcut: z.string().default("l").describe("The key to press along with Ctrl (or Cmd on Mac) to open Antigravity chat. Defaults to 'l' (Ctrl+L)."),
    }),
    func: async ({ prompt, workspacePath, shortcut }) => {
      try {
        // Step 1: Launch Antigravity IDE if a workspace path was provided
        if (workspacePath) {
          child_process.exec(`antigravity-ide "${workspacePath}"`, (err) => {
            if (err) console.error(`[antigravity] Launch error: ${err.message}`);
          });
        }

        windowManager.requestAccessibility();

        // Step 2: Poll for the IDE window — 10 s after a cold launch, 3 s if already open
        const ideWindow = await findIdeWindow(workspacePath ? 10000 : 3000);
        if (!ideWindow) {
          return workspacePath
            ? "Error: Antigravity IDE did not open within 10 seconds."
            : "Error: Could not find an open Antigravity IDE window. Provide a workspacePath to launch it.";
        }

        // Step 3: Bring to front and let focus settle
        ideWindow.bringToTop();
        await delay(800);

        // Step 4: Trigger the AI chat shortcut (Ctrl+L by default)
        const modifier = process.platform === "darwin" ? "command" : "control";
        robot.keyTap(shortcut.toLowerCase(), [modifier as any]);
        await delay(1200);

        // Step 5: Write prompt to clipboard then paste — 100% accurate for any text
        await setClipboard(prompt);
        robot.keyTap("v", [modifier as any]);
        await delay(400);

        // Step 6: Submit
        robot.keyTap("enter");

        return `Successfully delegated task to Antigravity IDE. Prompt sent: "${prompt}"`;
      } catch (err: any) {
        return `Error executing delegate_to_antigravity: ${err.message}`;
      }
    },
  })
];
