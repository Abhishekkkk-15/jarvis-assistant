import cron, { ScheduledTask } from "node-cron";
import { db, settingsTable } from "@workspace/db";
import { scheduledTasksTable } from "@workspace/db/schema";
import { HumanMessage } from "@langchain/core/messages";
import { createJarvisGraph } from "./multiagent.js";
import { allTools } from "../tools/index.js";
import { createLLM } from "./llmFactory.js";
import { getWss } from "../index.js";
import WebSocket from "ws";

// In-memory task registry
const activeTasks = new Map<number, ScheduledTask>();

export function scheduleTaskInMemory(
  id: number,
  cronExpression: string,
  taskDescription: string,
) {
  if (activeTasks.has(id)) {
    activeTasks.get(id)?.stop();
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Cron] Triggering task ${id}: ${taskDescription}`);

    // Get settings
    const settingsRows = await db.select().from(settingsTable).limit(1);
    const settings = settingsRows[0];

    if (!settings) {
      console.error(`[Cron] Task ${id} failed: No settings found in DB.`);
      return;
    }

    let provider = settings.selectedProvider || "groq";
    let isFallback = false;

    const getApiKey = (p: string) => {
      switch (p) {
        case "groq": return settings.groqApiKey;
        case "nvidia": return settings.nvidiaApiKey;
        case "openai": return settings.openaiApiKey;
        case "anthropic": return settings.anthropicApiKey;
        case "mistral": return settings.mistralApiKey;
        case "openrouter": return settings.openrouterApiKey;
        case "gemini": return settings.geminiApiKey;
        case "custom": return settings.customTextApiKey;
        default: return null;
      }
    };

    let apiKey = getApiKey(provider);
    if (!apiKey) {
      const providersList = ["groq", "nvidia", "openai", "anthropic", "mistral", "openrouter", "gemini", "custom"];
      for (const p of providersList) {
        const key = getApiKey(p);
        if (key) {
          provider = p;
          apiKey = key;
          isFallback = true;
          break;
        }
      }
    }

    if (!apiKey) {
      throw new Error(`No API key configured for provider ${provider.toUpperCase()}`);
    }

    let modelName = settings.selectedModel;

    const getDefaultModel = (p: string) => {
      if (p === "groq") return "llama-3.3-70b-versatile";
      if (p === "nvidia") return "nvidia/llama-3.1-405b-instruct";
      if (p === "openai") return "gpt-4o";
      if (p === "anthropic") return "claude-3-5-sonnet-20241022";
      if (p === "gemini") return "gemini-1.5-flash";
      if (p === "mistral") return "mistral-large-latest";
      return "llama-3.3-70b-versatile";
    };

    if (isFallback || !modelName) {
      modelName = getDefaultModel(provider);
    }

    const llm = createLLM({
      provider,
      apiKey,
      modelName,
      customApiUrl: settings.customTextApiUrl,
    });

    const agent = createJarvisGraph(llm as any, allTools);

    // Invoke graph with a synthetic system/human message
    const messages = [
      new HumanMessage({
        content: `[Scheduled Background Task Triggered]: ${taskDescription}`,
        name: "System",
      }),
    ];

    try {
      const agentResult = await agent.invoke(
        { messages, next: "Orchestrator" },
        { recursionLimit: 25 },
      );
      const lastMessage = agentResult.messages[agentResult.messages.length - 1];
      let agentResponse = String(lastMessage.content);

      agentResponse = agentResponse.replace(/\[Orchestrator\]:/g, "").trim();

      // Send the response to the frontend via WebSocket
      const wss = getWss();
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "system_notification",
                title: "Background Task",
                message: agentResponse,
              }),
            );
          }
        });
      }
      console.log(`[Cron] Task ${id} completed successfully.`);
    } catch (err) {
      console.error(`[Cron] Task ${id} failed:`, err);
    }
  });

  task.start();
  activeTasks.set(id, task);
}

export function cancelTaskInMemory(id: number) {
  if (activeTasks.has(id)) {
    activeTasks.get(id)?.stop();
    activeTasks.delete(id);
  }
}

export async function initializeScheduler() {
  console.log("[Scheduler] Loading scheduled tasks from database...");
  try {
    const tasks = await db.select().from(scheduledTasksTable);
    for (const task of tasks) {
      scheduleTaskInMemory(task.id, task.cronExpression, task.taskDescription);
    }
    console.log(`[Scheduler] Loaded ${tasks.length} tasks.`);
  } catch (err) {
    console.error("[Scheduler] Failed to load tasks:", err);
  }
}
