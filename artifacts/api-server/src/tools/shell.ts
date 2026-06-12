import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";

export const shellTools = [
  new DynamicStructuredTool({
    name: "execute_bash",
    description: "Executes a Bash command on the host OS.",
    schema: z.object({ command: z.string() }),
    func: async ({ command }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "bash" },
          (err, stdout, stderr) => {
            resolve(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          },
        );
      });
    },
  }),
  new DynamicStructuredTool({
    name: "execute_powershell",
    description: "Executes a PowerShell command on the host OS.",
    schema: z.object({ command: z.string() }),
    func: async ({ command }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "powershell.exe" },
          (err, stdout, stderr) => {
            resolve(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          },
        );
      });
    },
  }),
  new DynamicStructuredTool({
    name: "execute_cmd",
    description: "Executes a CMD command on the host OS.",
    schema: z.object({ command: z.string() }),
    func: async ({ command }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { shell: "cmd.exe" },
          (err, stdout, stderr) => {
            resolve(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          },
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
          child_process.exec(cmd, (err, stdout, stderr) =>
            resolve(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`),
          );
        } else if (action === "kill" && pid) {
          const cmd =
            process.platform === "win32"
              ? `taskkill /PID ${pid} /F`
              : `kill -9 ${pid}`;
          child_process.exec(cmd, (err, stdout, stderr) =>
            resolve(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`),
          );
        } else {
          resolve("Invalid action or missing PID.");
        }
      });
    },
  }),
];
