import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";

function formatResult(stdout: string, stderr: string, err: child_process.ExecException | null): string {
  if (!err) return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
  const exitCode = (err as any).code !== undefined ? ` (exit code ${(err as any).code})` : "";
  return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}\nERROR: ${err.message}${exitCode}`;
}

export const shellTools = [
  new DynamicStructuredTool({
    name: "execute_bash",
    description: "Executes a Bash command on the host OS.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional().describe("Working directory to run the command in. Defaults to the server's working directory."),
    }),
    func: async ({ command, cwd }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "bash", timeout: 30000, cwd },
          (err, stdout, stderr) => resolve(formatResult(stdout, stderr, err)),
        );
      });
    },
  }),
  new DynamicStructuredTool({
    name: "execute_powershell",
    description: "Executes a PowerShell command on the host OS.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional().describe("Working directory to run the command in. Defaults to the server's working directory."),
    }),
    func: async ({ command, cwd }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "powershell.exe", timeout: 30000, cwd },
          (err, stdout, stderr) => resolve(formatResult(stdout, stderr, err)),
        );
      });
    },
  }),
  new DynamicStructuredTool({
    name: "execute_cmd",
    description: "Executes a CMD command on the host OS.",
    schema: z.object({
      command: z.string(),
      cwd: z.string().optional().describe("Working directory to run the command in. Defaults to the server's working directory."),
    }),
    func: async ({ command, cwd }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "cmd.exe", timeout: 30000, cwd },
          (err, stdout, stderr) => resolve(formatResult(stdout, stderr, err)),
        );
      });
    },
  }),
  new DynamicStructuredTool({
    name: "process_management",
    description:
      "Manage processes (list, kill by PID). Action can be 'list' or 'kill'.",
    schema: z.object({
      action: z.enum(["list", "kill"]),
      pid: z.number().optional(),
    }),
    func: async ({ action, pid }) => {
      return new Promise((resolve) => {
        if (action === "list") {
          const cmd = process.platform === "win32" ? "tasklist" : "ps aux";
          child_process.exec(cmd, (err, stdout, stderr) => resolve(formatResult(stdout, stderr, err)));
        } else if (action === "kill" && pid) {
          const cmd =
            process.platform === "win32"
              ? `taskkill /PID ${pid} /F`
              : `kill -9 ${pid}`;
          child_process.exec(cmd, (err, stdout, stderr) => resolve(formatResult(stdout, stderr, err)));
        } else {
          resolve("Invalid action or missing PID.");
        }
      });
    },
  }),
];
