import cron, { ScheduledTask } from "node-cron";
import { db, settingsTable } from "@workspace/db";
import { scheduledTasksTable } from "@workspace/db/schema";
import { HumanMessage } from "@langchain/core/messages";
import { createJarvisGraph } from "./multiagent.js";
import { allTools } from "../tools/index.js";
import { ChatOpenAI } from "@langchain/openai";
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

    if (provider === "groq" && !settings.groqApiKey && settings.nvidiaApiKey) {
      provider = "nvidia";
      isFallback = true;
    } else if (
      provider === "nvidia" &&
      !settings.nvidiaApiKey &&
      settings.groqApiKey
    ) {
      provider = "groq";
      isFallback = true;
    }

    const apiKey = provider === "nvidia" ? settings.nvidiaApiKey : settings.groqApiKey;
    if (!apiKey) {
      throw new Error(`No ${provider.toUpperCase()} API key configured. Please add your API key in Settings.`);
    }

    const endpoint = provider === "nvidia"
      ? "https://integrate.api.nvidia.com/v1"
      : "https://api.groq.com/openai/v1";

    const modelName = settings.selectedModel

    const llm = new ChatOpenAI({
      modelName: modelName,
      temperature: 0,
      apiKey: apiKey,
      configuration: { baseURL: endpoint },
      maxTokens: 4096,
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
