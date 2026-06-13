import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import robot from "@hurdlegroup/robotjs";
import { windowManager } from "node-window-manager";
import * as child_process from "child_process";
import * as path from "path";

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const antigravityTools = [
  new DynamicStructuredTool({
    name: "delegate_to_antigravity",
    description: "Delegates a coding task to the Antigravity IDE (VS Code extension). It opens VS Code, focuses the Antigravity chat, and types the prompt.",
    schema: z.object({
      prompt: z.string().describe("The instruction to send to Antigravity (e.g., 'add a new login module')."),
      workspacePath: z.string().optional().describe("Optional path to the project directory to open in VS Code."),
      shortcut: z.string().default("l").describe("The key to press along with Ctrl+Shift (or Cmd+Shift on Mac) to open Antigravity chat. Defaults to 'l' (Ctrl+Shift+L)."),
    }),
    func: async ({ prompt, workspacePath, shortcut }) => {
      try {
        // Step 1: Open or Focus VS Code
        if (workspacePath) {
          child_process.exec(`code "${workspacePath}"`);
          // Wait for VS code to launch and open the folder
          await delay(4000);
        }

        windowManager.requestAccessibility();
        const windows = windowManager.getWindows();
        
        // Find VS Code window (title usually ends with "- Visual Studio Code")
        const vsCodeWindows = windows.filter(w => w.isVisible() && w.getTitle().toLowerCase().includes("visual studio code"));
        
        if (vsCodeWindows.length > 0) {
          // Bring the first matched window to front
          vsCodeWindows[0].bringToTop();
          await delay(1000); // Wait for focus to settle
        } else if (!workspacePath) {
          return "Error: Could not find an open Visual Studio Code window, and no workspacePath was provided to launch it.";
        }

        // Step 2: Trigger Antigravity Chat Shortcut
        // We assume the default shortcut is Ctrl + Shift + L (or Cmd + Shift + L on Mac)
        const modifier = process.platform === "darwin" ? "command" : "control";
        robot.keyTap(shortcut.toLowerCase(), [modifier as any, "shift"]);
        
        await delay(1500); // Wait for chat panel to open and focus input

        // Step 3: Type the prompt
        // robot.typeString can be slow for long prompts, so we might want to use clipboard, 
        // but typing is safer for chat boxes to trigger input events.
        robot.typeString(prompt);

        await delay(500);

        // Step 4: Submit
        robot.keyTap("enter");

        return `Successfully delegated task to Antigravity in VS Code. Prompt sent: "${prompt}"`;
      } catch (err: any) {
        return `Error executing delegate_to_antigravity: ${err.message}`;
      }
    },
  })
];
