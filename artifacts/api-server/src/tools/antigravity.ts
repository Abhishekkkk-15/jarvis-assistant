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
    description: "Delegates a coding task to the standalone Antigravity IDE. It opens the Antigravity IDE, focuses its AI chat, and types the prompt. Do NOT use this if the user specifically asked for Claude or another tool.",
    schema: z.object({
      prompt: z.string().describe("The instruction to send to Antigravity IDE (e.g., 'add a new login module')."),
      workspacePath: z.string().optional().describe("Optional path to the project directory to open in Antigravity IDE."),
      shortcut: z.string().default("l").describe("The key to press along with Ctrl (or Cmd on Mac) to open Antigravity chat. Defaults to 'l' (Ctrl+L)."),
    }),
    func: async ({ prompt, workspacePath, shortcut }) => {
      try {
        // Step 1: Open or Focus Antigravity IDE
        if (workspacePath) {
          child_process.exec(`antigravity-ide "${workspacePath}"`);
          // Wait for Antigravity IDE to launch and open the folder
          await delay(4000);
        }

        windowManager.requestAccessibility();
        const windows = windowManager.getWindows();
        
        // Find Antigravity IDE window
        const ideWindows = windows.filter(w => w.isVisible() && w.getTitle().toLowerCase().includes("antigravity ide"));
        
        if (ideWindows.length > 0) {
          // Bring the first matched window to front
          ideWindows[0].bringToTop();
          await delay(1000); // Wait for focus to settle
        } else if (!workspacePath) {
          return "Error: Could not find an open Antigravity IDE window, and no workspacePath was provided to launch it.";
        }

        // Step 2: Trigger Antigravity Chat Shortcut
        // Defaulting to Ctrl+L (common for AI IDEs like Cursor/Antigravity) unless specified
        const modifier = process.platform === "darwin" ? "command" : "control";
        
        // If the shortcut is a single character like 'l', press ctrl+l
        // If it requires shift, we'll assume it's passed as 'l' and we add shift if needed.
        robot.keyTap(shortcut.toLowerCase(), [modifier as any]);
        
        await delay(1500); // Wait for chat panel to open and focus input

        // Step 3: Type the prompt
        robot.typeString(prompt);

        await delay(500);

        // Step 4: Submit
        robot.keyTap("enter");

        return `Successfully delegated task to Antigravity IDE. Prompt sent: "${prompt}"`;
      } catch (err: any) {
        return `Error executing delegate_to_antigravity: ${err.message}`;
      }
    },
  })
];
