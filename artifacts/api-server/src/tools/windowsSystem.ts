import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";

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

export const windowsSystemTools = [
  new DynamicStructuredTool({
    name: "media_control",
    description: "Control system media and volume natively.",
    schema: z.object({
      action: z.enum(["volume_up", "volume_down", "mute", "play_pause", "next", "prev"]),
    }),
    func: async ({ action }) => {
      // Key codes:
      // 173 = Mute, 174 = Vol Down, 175 = Vol Up
      // 176 = Next Track, 177 = Prev Track, 179 = Play/Pause
      const codeMap: Record<string, string> = {
        "mute": "173",
        "volume_down": "174",
        "volume_up": "175",
        "next": "176",
        "prev": "177",
        "play_pause": "179",
      };
      
      const keyCode = codeMap[action];
      if (!keyCode) return `Error: Unknown action ${action}`;

      const script = `(New-Object -ComObject WScript.Shell).SendKeys([char]${keyCode})`;
      await runPS(script);
      return `Executed media control: ${action}`;
    },
  }),
  new DynamicStructuredTool({
    name: "power_management",
    description: "Manage system power states. ALWAYS call requestApproval first before sleep, restart, or shutdown.",
    schema: z.object({
      action: z.enum(["lock", "sleep", "restart", "shutdown"]),
    }),
    func: async ({ action }) => {
      if (action === "lock") {
        child_process.exec(`rundll32.exe user32.dll,LockWorkStation`);
        return "Workstation locked successfully.";
      } else if (action === "sleep") {
        child_process.exec(`rundll32.exe powrprof.dll,SetSuspendState 0,1,0`);
        return "System put to sleep.";
      } else if (action === "restart") {
        child_process.exec(`shutdown /r /t 0`);
        return "System restarting...";
      } else if (action === "shutdown") {
        child_process.exec(`shutdown /s /t 0`);
        return "System shutting down...";
      }
      return "Unknown action.";
    },
  }),
  new DynamicStructuredTool({
    name: "registry_control",
    description: "Query or modify the Windows Registry. Modifying requires calling requestApproval first.",
    schema: z.object({
      action: z.enum(["query", "add"]),
      keyPath: z.string().describe("The registry key path (e.g., HKCU\\Software\\...)"),
      valueName: z.string().optional().describe("The value name to query or add"),
      valueData: z.string().optional().describe("The data to add (required for 'add' action)"),
      valueType: z.enum(["REG_SZ", "REG_DWORD", "REG_BINARY"]).default("REG_SZ").describe("The type of the data (for 'add' action)"),
    }),
    func: async ({ action, keyPath, valueName, valueData, valueType }) => {
      try {
        if (action === "query") {
          let cmd = `reg query "${keyPath}"`;
          if (valueName) cmd += ` /v "${valueName}"`;
          
          return new Promise((resolve) => {
            child_process.exec(cmd, (err, stdout, stderr) => {
              if (err) resolve(`Registry Error: ${stderr || err.message}`);
              else resolve(stdout.trim());
            });
          });
        } else if (action === "add") {
          if (!valueName || !valueData) return "Error: valueName and valueData are required for 'add'.";
          
          const cmd = `reg add "${keyPath}" /v "${valueName}" /t ${valueType} /d "${valueData}" /f`;
          return new Promise((resolve) => {
            child_process.exec(cmd, (err, stdout, stderr) => {
              if (err) resolve(`Registry Error: ${stderr || err.message}`);
              else resolve(stdout.trim() || "Registry value added successfully.");
            });
          });
        }
        return "Unknown action.";
      } catch (err: any) {
        return `Error in registry_control: ${err.message}`;
      }
    },
  })
];
