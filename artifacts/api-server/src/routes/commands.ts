import { Router } from "express";
import { db, commandLogsTable } from "@workspace/db";
import { ExecuteCommandBody } from "@workspace/api-zod";
import { resolveApproval } from "../lib/wsManager.js";
import { z } from "zod";

const router = Router();

router.post("/commands/approval", (req, res) => {
  const schema = z.object({
    requestId: z.string(),
    decision: z.enum(["approved", "denied"])
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  
  const success = resolveApproval(parsed.data.requestId, parsed.data.decision);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Approval request not found or expired" });
  }
});

const COMMAND_CATEGORIES = [
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

router.get("/commands/suggestions", async (_req, res) => {
  res.json(COMMAND_CATEGORIES);
});

router.post("/commands/execute", async (req, res) => {
  try {
    const parsed = ExecuteCommandBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { type, payload } = parsed.data;
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
        const query = (payload as any).query ?? "";
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        result = {
          success: true,
          message: `Opening search for "${query}"`,
          data: { url: searchUrl, query },
        };
        break;
      }

      case "open_app": {
        const app = (payload as any).app ?? "";
        result = {
          success: true,
          message: `Attempting to open ${app}`,
          data: { app },
        };
        break;
      }

      case "clipboard": {
        const action = (payload as any).action ?? "read";
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
        const cmd = (payload as any).command ?? "";
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

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Command execution failed");
    res.status(500).json({ error: "Command failed" });
  }
});

export default router;
