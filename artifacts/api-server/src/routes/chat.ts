import { Router } from "express";
import { db, settingsTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { SendChatBody } from "@workspace/api-zod";

import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import * as child_process from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

const router = Router();

// ─────────────────────────────────────────────
// Custom OS & Community Tools via LangChain
// ─────────────────────────────────────────────

const tools = [
  new DynamicStructuredTool({
    name: "get_current_datetime",
    description: "Get the current date and time.",
    schema: z.object({}),
    func: async () => {
      const now = new Date();
      return JSON.stringify({
        iso: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
  }),
  new DynamicStructuredTool({
    name: "calculate",
    description: "Evaluate a mathematical expression and return the numeric result.",
    schema: z.object({ expression: z.string() }),
    func: async ({ expression }: { expression: string }) => {
      try {
        const sanitized = expression.replace(/[^0-9+\-*/().\s%^a-zA-Z_.,]/g, "");
        const result = new Function("Math", `"use strict"; return (${sanitized})`)(Math);
        return String(result);
      } catch (err) {
        return `Error: ${err}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "get_weather",
    description: "Get current weather conditions for a city or location.",
    schema: z.object({ location: z.string() }),
    func: async ({ location }: { location: string }) => {
      try {
        const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as any;
        const current = data?.current_condition?.[0];
        return `Temp: ${current.temp_C}C (${current.temp_F}F), ${current.weatherDesc?.[0]?.value}`;
      } catch (err) {
        return `Weather lookup failed: ${err}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "search_web",
    description: "Search the web for factual information or recent events.",
    schema: z.object({ query: z.string() }),
    func: async ({ query }: { query: string }) => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const data = (await resp.json()) as any;
        return data.AbstractText || `No abstract found for ${query}. Try Wikipedia.`;
      } catch (err) {
        return `Web search failed: ${err}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "open_app",
    description: "Opens an application or file on the Windows operating system.",
    schema: z.object({ app_name: z.string() }),
    func: async ({ app_name }: { app_name: string }) => {
      return new Promise((resolve) => {
        child_process.exec(`start "" "${app_name}"`, (err) => {
          if (err) resolve(`Failed to open app: ${err.message}`);
          else resolve(`App ${app_name} opened successfully.`);
        });
      });
    },
  }),
  new DynamicStructuredTool({
    name: "read_file",
    description: "Reads the content of a local file.",
    schema: z.object({ file_path: z.string() }),
    func: async ({ file_path }: { file_path: string }) => {
      try { return await fs.readFile(file_path, "utf-8"); }
      catch (e: any) { return `Error reading file: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "write_file",
    description: "Writes content to a local file.",
    schema: z.object({ file_path: z.string(), content: z.string() }),
    func: async ({ file_path, content }: { file_path: string; content: string }) => {
      try {
        await fs.mkdir(path.dirname(file_path), { recursive: true });
        await fs.writeFile(file_path, content, "utf-8");
        return `File written successfully to ${file_path}.`;
      }
      catch (e: any) { return `Error writing file: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "run_command",
    description: "Executes a shell command on the host OS. Use cautiously.",
    schema: z.object({ command: z.string() }),
    func: async ({ command }: { command: string }) => {
      return new Promise((resolve) => {
        child_process.exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
          let out = stdout ? `STDOUT:\n${stdout}\n` : "";
          let errOut = stderr ? `STDERR:\n${stderr}\n` : "";
          resolve(out + errOut || "Command executed successfully with no output.");
        });
      });
    },
  })
];

// ─────────────────────────────────────────────
// Settings helper
// ─────────────────────────────────────────────

async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

router.post("/chat", async (req, res) => {
  try {
    const parsed = SendChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const settings = await getSettings();
    if (!settings) {
      res.status(500).json({ error: "Settings not configured" });
      return;
    }

    const provider = parsed.data.provider ?? settings.selectedProvider;
    let modelName = parsed.data.model ?? settings.selectedModel;
    const hasImage = !!parsed.data.imageBase64;
    
    // Override model for vision capabilities if needed
    if (provider === "groq" && hasImage) {
      modelName = "llama-3.2-90b-vision-preview";
    } else if (provider === "groq" && (modelName === "llama3-70b-8192" || modelName === "llama3-8b-8192")) {
      modelName = "llama-3.3-70b-versatile";
    }
    
    const apiKey = provider === "nvidia" ? settings.nvidiaApiKey : settings.groqApiKey;

    if (!apiKey) {
      res.status(400).json({
        error: `No API key configured for provider "${provider}". Please add your API key in Settings.`,
      });
      return;
    }

    const endpoint = provider === "nvidia"
      ? "https://integrate.api.nvidia.com/v1"
      : "https://api.groq.com/openai/v1";


    // Setup LangChain Model
    let llm: any;
    if (provider === "groq") {
      llm = new ChatGroq({
        model: modelName,
        apiKey,
        temperature: 0.7,
        maxTokens: 1024,
      });
    } else {
      llm = new ChatOpenAI({
        modelName,
        apiKey,
        configuration: { baseURL: endpoint },
        temperature: 0.7,
        maxTokens: 1024,
      });
    }

    const agent = createReactAgent({ llm, tools });

    const MASTER_PROMPT = `You are JARVIS, an advanced AI assistant with direct access to the user's operating system. 
You are highly intelligent, polite, and efficient — much like Tony Stark's AI. 
You can run shell commands, write files, open applications, and search the web.
Always be concise unless detail is requested. When asked to perform OS actions, do so immediately using your tools.
CRITICAL INSTRUCTION: Once you have successfully called a tool (e.g. open_app) and received a success message, you MUST NOT call that tool again. Immediately generate a final conversational response to the user acknowledging the action is complete.`;

    // Get or create conversation
    let conversationId = parsed.data.conversationId ?? null;
    let conversation;
    if (conversationId) {
      const rows = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, conversationId));
      conversation = rows[0];
    }
    if (!conversation) {
      const title = parsed.data.message.length > 50
        ? parsed.data.message.slice(0, 47) + "..."
        : parsed.data.message;
      const [newConv] = await db.insert(conversationsTable).values({ title }).returning();
      conversation = newConv;
      conversationId = newConv.id;
    }

    // Load recent history (last 20 messages)
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId!))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);

    const historyMessages: any[] = history.reverse().map((m) => {
      if (m.role === "assistant") return new AIMessage(m.content ?? "");
      return new HumanMessage(m.content ?? "");
    });

    // Add system message and current user message
    historyMessages.unshift(new SystemMessage(MASTER_PROMPT));
    
    if (hasImage) {
      historyMessages.push(new HumanMessage({
        content: [
          { type: "text", text: parsed.data.message },
          { type: "image_url", image_url: { url: parsed.data.imageBase64! } }
        ]
      }));
    } else {
      historyMessages.push(new HumanMessage(parsed.data.message));
    }

    // Store user message
    await db.insert(messagesTable).values({
      conversationId: conversationId!,
      role: "user",
      content: parsed.data.message,
    });

    // Run LangGraph Agent
    let agentResponse = "";
    const toolsUsed: string[] = [];
    try {
      const agentResult = await agent.invoke({ messages: historyMessages }, { recursionLimit: 5 });
      const lastMessage = agentResult.messages[agentResult.messages.length - 1];
      agentResponse = String(lastMessage.content);
      
      // Extract tools used
      for (const msg of agentResult.messages) {
        if (msg._getType() === "ai" && (msg as AIMessage).tool_calls?.length) {
          (msg as AIMessage).tool_calls?.forEach((tc: any) => {
            if (tc.name && !toolsUsed.includes(tc.name)) {
              toolsUsed.push(tc.name);
            }
          });
        }
      }
    } catch (err: any) {
      // Fallback if tool execution or LLM fails
      req.log.error({ err }, "Agentic loop failed, falling back to simple LLM call");
      try {
        const fallbackResult = await llm.invoke(historyMessages);
        agentResponse = String(fallbackResult.content);
      } catch (fallbackErr) {
        agentResponse = "I'm sorry, I encountered a service error while processing your request.";
      }
    }

    // Store final assistant reply
    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId: conversationId!,
        role: "assistant",
        content: agentResponse,
        model: modelName,
      })
      .returning();

    // Touch updatedAt
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId!));

    res.json({
      reply: agentResponse,
      conversationId,
      messageId: assistantMsg.id,
      model: modelName,
      tokensUsed: 0,
      toolsUsed,
    });
  } catch (err) {
    req.log.error({ err }, "Chat request failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
