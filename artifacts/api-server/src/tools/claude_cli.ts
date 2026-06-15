import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as os from "os";

export const claudeTools = [
  new DynamicStructuredTool({
    name: "spawn_claude",
    description: "Opens a visible terminal window and starts Claude CLI (or Aider) in the specified directory.",
    schema: z.object({
      command: z.string().default("claude").describe("The command to run (e.g., 'claude' or 'aider')"),
      message: z.string().optional().describe("An optional prompt or message to pass to the agent upon startup."),
      cwd: z.string().describe("The absolute path to the directory where the agent should run.")
    }),
    func: async ({ command, message, cwd }) => {
      try {
        let fullCommand = command;
        if (message) {
           fullCommand += ` -m "${message.replace(/"/g, '\\"')}"`;
        }

        if (os.platform() === "win32") {
          // Pops open a new Command Prompt window, changes to the target directory, and runs the command
          child_process.exec(`start cmd.exe /K "cd /d \\"${cwd}\\" && ${fullCommand}"`, { cwd });
          return `Successfully opened a new terminal window running ${command} in ${cwd}. You can now interact with it directly on your screen.`;
        } else if (os.platform() === "darwin") {
          // Mac: opens a new terminal window
          child_process.exec(`osascript -e 'tell application "Terminal" to do script "cd \\"${cwd}\\" && ${fullCommand}"'`);
          return `Successfully opened a new terminal window running ${command} in ${cwd}.`;
        } else {
          // Linux (GNOME terminal by default)
          child_process.exec(`gnome-terminal -- working-directory="${cwd}" -- bash -c "${fullCommand}; exec bash"`);
          return `Successfully opened a new terminal window running ${command} in ${cwd}.`;
        }
      } catch (e: any) {
        return `Failed to spawn ${command} in a new window: ${e.message}`;
      }
    },
  })
];
