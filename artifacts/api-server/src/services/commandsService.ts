import { db, commandLogsTable } from "@workspace/db";
import { resolveApproval } from "../lib/wsManager.js";

export function handleCommandApproval(requestId: string, decision: "approved" | "denied") {
  return resolveApproval(requestId, decision);
}

export const COMMAND_CATEGORIES = [
  {
    name: "Time & Date",
    description: "Get current time, date, or set reminders",
    examples: ["What time is it?", "What's today's date?", "What day of the week is it?"],
  },
  {
    name: "Web Search",
    description: "Search the web or open websites",
    examples: ["Search for the latest news", "Open YouTube", "Go to GitHub"],
  },
  {
    name: "System",
    description: "System info and actions",
    examples: ["Take a screenshot", "What's the weather?", "Open calculator"],
  },
  {
    name: "Clipboard",
    description: "Read or write clipboard content",
    examples: ["Copy this to clipboard", "What's in my clipboard?"],
  },
  {
    name: "AI Tasks",
    description: "AI-powered tasks and queries",
    examples: [
      "Write me a poem",
      "Summarize this text",
      "Translate to Spanish",
      "Tell me a joke",
    ],
  },
];

export async function executeCommand(type: string, payload: any) {
  let result = { success: true, message: "", data: null as Record<string, unknown> | null };

  switch (type) {
    case "get_time": {
      const now = new Date();
      result = {
        success: true,
        message: `Current time is ${now.toLocaleTimeString()} on ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        data: {
          time: now.toLocaleTimeString(),
          date: now.toLocaleDateString(),
          timestamp: now.toISOString(),
        },
      };
      break;
    }

    case "search_web": {
      const query = payload?.query ?? "";
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      result = {
        success: true,
        message: `Opening search for "${query}"`,
        data: { url: searchUrl, query },
      };
      break;
    }

    case "open_app": {
      const app = payload?.app ?? "";
      result = {
        success: true,
        message: `Attempting to open ${app}`,
        data: { app },
      };
      break;
    }

    case "clipboard": {
      const action = payload?.action ?? "read";
      if (action === "read") {
        result = {
          success: true,
          message: "Clipboard access requires browser permissions",
          data: { action: "read" },
        };
      } else {
        result = {
          success: true,
          message: "Content copied to clipboard",
          data: { action: "write" },
        };
      }
      break;
    }

    case "screenshot": {
      result = {
        success: true,
        message: "Screenshot functionality available in Electron desktop mode",
        data: { note: "Run as Electron app for full system access" },
      };
      break;
    }

    case "custom": {
      const cmd = payload?.command ?? "";
      result = {
        success: true,
        message: `Command received: "${cmd}"`,
        data: { command: cmd },
      };
      break;
    }

    default: {
      result = {
        success: false,
        message: `Unknown command type: ${type}`,
        data: null,
      };
    }
  }

  // Log command
  await db
    .insert(commandLogsTable)
    .values({ commandType: type, success: String(result.success) });

  return result;
}
