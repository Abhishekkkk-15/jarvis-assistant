import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import { broadcast } from "../lib/wsManager.js";
import { integrationsManager } from "../integrations/manager.js";

// Singleton manager to keep track of the running Claude process
class ClaudeManager {
  private child: child_process.ChildProcess | null = null;
  private outputBuffer: string = "";
  private lastReadIndex: number = 0;

  public start(command: string, args: string[], cwd: string): string {
    if (this.child) {
      return "Error: Claude is already running. Please check its status or kill it first.";
    }

    this.outputBuffer = "";
    this.lastReadIndex = 0;

    try {
      this.child = child_process.spawn(command, args, {
        cwd,
        shell: process.platform === "win32",
        env: { ...process.env, FORCE_COLOR: "0" } // Strip color codes for easier parsing
      });

      this.child.stdout?.on("data", (data) => {
        const text = data.toString();
        this.outputBuffer += text;
        
        // Optionally detect prompts here automatically, 
        // but for now we let the agent poll via check_claude_status
      });

      this.child.stderr?.on("data", (data) => {
        this.outputBuffer += `\n[STDERR]: ${data.toString()}`;
      });

      this.child.on("close", (code) => {
        this.outputBuffer += `\n[Process exited with code ${code}]`;
        this.child = null;
      });

      this.child.on("error", (err) => {
        this.outputBuffer += `\n[Process Error]: ${err.message}`;
        this.child = null;
      });

      return "Claude CLI spawned successfully in the background. Use check_claude_status to read its output.";
    } catch (e: any) {
      return `Failed to spawn Claude: ${e.message}`;
    }
  }

  public getStatus(): string {
    if (!this.child && this.outputBuffer === "") {
      return "Claude CLI is not currently running.";
    }

    // Return new output since last read
    const newOutput = this.outputBuffer.slice(this.lastReadIndex);
    this.lastReadIndex = this.outputBuffer.length;
    
    let statusMsg = "Claude CLI Output:\n" + newOutput;
    if (!this.child) {
      statusMsg += "\n(Note: The Claude process is no longer running.)";
    }

    return statusMsg || "No new output from Claude CLI. It might still be processing.";
  }

  public sendInput(input: string): string {
    if (!this.child) {
      return "Error: Claude CLI is not running.";
    }

    if (this.child.stdin) {
      this.child.stdin.write(input + "\n");
      return `Input "${input}" sent to Claude CLI.`;
    } else {
      return "Error: Could not access Claude's standard input.";
    }
  }

  public kill(): string {
    if (!this.child) {
      return "Claude CLI is not running.";
    }
    this.child.kill();
    this.child = null;
    return "Claude CLI process was killed.";
  }
}

const claudeManager = new ClaudeManager();

export const claudeTools = [
  new DynamicStructuredTool({
    name: "spawn_claude",
    description: "Starts Claude CLI (or Aider) in the background. Use this to delegate tasks to it.",
    schema: z.object({
      command: z.string().default("claude-engineer").describe("The command to run (e.g., 'claude-engineer' or 'aider')"),
      message: z.string().describe("The prompt or message to pass to the agent."),
      cwd: z.string().describe("The absolute path to the directory where the agent should run.")
    }),
    func: async ({ command, message, cwd }) => {
      // Typically CLI agents accept --message or -m
      const args = ["--message", message];
      return claudeManager.start(command, args, cwd);
    },
  }),

  new DynamicStructuredTool({
    name: "check_claude_status",
    description: "Reads the new console output from the background Claude CLI process. Use this to check its progress or see if it's asking for a permission/confirmation.",
    schema: z.object({}),
    func: async () => {
      return claudeManager.getStatus();
    },
  }),

  new DynamicStructuredTool({
    name: "send_claude_input",
    description: "Sends a string (like 'y' or 'n' or a follow-up instruction) to the running Claude CLI process. Use this to answer its permission requests.",
    schema: z.object({
      input: z.string().describe("The text to send (e.g., 'y')"),
    }),
    func: async ({ input }) => {
      return claudeManager.sendInput(input);
    },
  }),

  new DynamicStructuredTool({
    name: "kill_claude",
    description: "Forcefully stops the background Claude CLI process.",
    schema: z.object({}),
    func: async () => {
      return claudeManager.kill();
    },
  }),
];
