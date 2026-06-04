import cron from "node-cron";
import { db } from "@workspace/db";
import { scheduledTasksTable } from "@workspace/db/schema";
import { HumanMessage } from "@langchain/core/messages";
import { createJarvisGraph } from "./multiagent.js";
import { allTools } from "../tools/index.js";
import { ChatOpenAI } from "@langchain/openai";
import { getWss } from "../index.js";
import WebSocket from "ws";

// In-memory task registry
const activeTasks = new Map<number, cron.ScheduledTask>();

export function scheduleTaskInMemory(id: number, cronExpression: string, taskDescription: string) {
  if (activeTasks.has(id)) {
    activeTasks.get(id)?.stop();
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Cron] Triggering task ${id}: ${taskDescription}`);
    
    // Set up the LLM & Graph
    const llm = new ChatOpenAI({
      modelName: process.env.SELECTED_MODEL || "llama-3.3-70b-versatile",
      temperature: 0,
      openAIApiKey: process.env.GROQ_API_KEY || "",
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
      maxTokens: 1024,
    });
    
    const agent = createJarvisGraph(llm as any, allTools);
    
    // Invoke graph with a synthetic system/human message
    const messages = [
      new HumanMessage({
        content: `[Scheduled Background Task Triggered]: ${taskDescription}`,
        name: "System"
      })
    ];
    
    try {
      const agentResult = await agent.invoke({ messages, next: "Orchestrator" }, { recursionLimit: 25 });
      const lastMessage = agentResult.messages[agentResult.messages.length - 1];
      let agentResponse = String(lastMessage.content);
      
      agentResponse = agentResponse.replace(/\[Orchestrator\]:/g, '').trim();

      // Send the response to the frontend via WebSocket
      const wss = getWss();
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "message",
              sender: "jarvis",
              content: agentResponse,
            }));
          }
        });
      }
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
