import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as fs from "fs";
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
      // Verify the target directory exists before opening a terminal
      if (!fs.existsSync(cwd)) {
        return `Error: Directory does not exist: ${cwd}`;
      }

      try {
        let fullCommand = command;
        if (message) {
          // --message is the correct long-form flag for both Claude CLI and Aider
          fullCommand += ` --message "${message.replace(/"/g, '\\"')}"`;
        }

        let execCmd: string;
        if (os.platform() === "win32") {
          // /D sets the startup directory directly — avoids cd quoting issues
          execCmd = `start cmd.exe /D "${cwd}" /K ${fullCommand}`;
        } else if (os.platform() === "darwin") {
          execCmd = `osascript -e 'tell application "Terminal" to do script "cd \\"${cwd}\\" && ${fullCommand}"'`;
        } else {
          execCmd = `gnome-terminal --working-directory="${cwd}" -- bash -c "${fullCommand}; exec bash"`;
        }

        child_process.exec(execCmd, (err) => {
          if (err) console.error(`[spawn_claude] Failed to open terminal: ${err.message}`);
        });

        return `Successfully opened a new terminal running '${command}' in ${cwd}.`;
      } catch (e: any) {
        return `Failed to spawn ${command}: ${e.message}`;
      }
    },
  })
];
