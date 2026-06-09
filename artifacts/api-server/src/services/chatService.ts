import {
  db,
  settingsTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { SendChatBody } from "@workspace/api-zod";

import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import * as child_process from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { allTools } from "../tools/index.js";
import { searchMemory } from "../lib/memory.js";
import { createJarvisGraph } from "../lib/multiagent.js";
import { logger } from "../config/logger.js";

// ─────────────────────────────────────────────
// Custom OS & Community Tools via LangChain
// ─────────────────────────────────────────────

export const tools = [
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
    description:
      "Evaluate a mathematical expression and return the numeric result.",
    schema: z.object({ expression: z.string() }),
    func: async ({ expression }: { expression: string }) => {
      try {
        const sanitized = expression.replace(
          /[^0-9+\-*/().\s%^a-zA-Z_.,]/g,
          "",
        );
        const result = new Function(
          "Math",
          `"use strict"; return (${sanitized})`,
        )(Math);
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
        return (
          data.AbstractText || `No abstract found for ${query}. Try Wikipedia.`
        );
      } catch (err) {
        return `Web search failed: ${err}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "open_app",
    description:
      "Opens an application on Windows. IMPORTANT: You must use the executable name for common apps. For example, for VS Code use 'code', for Chrome use 'chrome', for Edge use 'msedge', for Word use 'winword', for Excel use 'excel'.",
    schema: z.object({ app_name: z.string() }),
    func: async ({ app_name }: { app_name: string }) => {
      const aliasMap: Record<string, string> = {
        vscode: "code",
        "vs code": "code",
        "visual studio code": "code",
        "google chrome": "chrome",
        edge: "msedge",
        "microsoft edge": "msedge",
        word: "winword",
        "microsoft word": "winword",
        excel: "excel",
        "microsoft excel": "excel",
        powerpoint: "powerpnt",
      };
      const normalized = app_name.toLowerCase().trim();
      const target = aliasMap[normalized] || app_name;

      return new Promise((resolve) => {
        const child = child_process.spawn("cmd.exe", ["/c", "start", "", target], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        resolve(`App ${target} open command issued successfully.`);
      });
    },
  }),
  new DynamicStructuredTool({
    name: "open_website",
    description: "Opens a website URL in the user's default web browser.",
    schema: z.object({ url: z.string() }),
    func: async ({ url }: { url: string }) => {
      let finalUrl = url.trim();
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = "https://" + finalUrl;
      }
      return new Promise((resolve) => {
        const child = child_process.spawn("cmd.exe", ["/c", "start", "", finalUrl], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        resolve(`Website ${finalUrl} open command issued successfully.`);
      });
    },
  }),
  new DynamicStructuredTool({
    name: "read_file",
    description: "Reads the content of a local file.",
    schema: z.object({ file_path: z.string() }),
    func: async ({ file_path }: { file_path: string }) => {
      try {
        return await fs.readFile(file_path, "utf-8");
      } catch (e: any) {
        return `Error reading file: ${e.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "write_file",
    description: "Writes content to a local file.",
    schema: z.object({ file_path: z.string(), content: z.string() }),
    func: async ({
      file_path,
      content,
    }: {
      file_path: string;
      content: string;
    }) => {
      try {
        await fs.mkdir(path.dirname(file_path), { recursive: true });
        await fs.writeFile(file_path, content, "utf-8");
        return `File written successfully to ${file_path}.`;
      } catch (e: any) {
        return `Error writing file: ${e.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "run_command",
    description: "Executes a shell command on the host OS. Use cautiously.",
    schema: z.object({ command: z.string() }),
    func: async ({ command }: { command: string }) => {
      return new Promise((resolve) => {
        child_process.exec(
          command,
          { timeout: 10000 },
          (err, stdout, stderr) => {
            let out = stdout ? `STDOUT:\n${stdout}\n` : "";
            let errOut = stderr ? `STDERR:\n${stderr}\n` : "";
            resolve(
              out + errOut || "Command executed successfully with no output.",
            );
          },
        );
      });
    },
  }),
  ...allTools,
];

// ─────────────────────────────────────────────
// Settings helper
// ─────────────────────────────────────────────

async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────
// Service Logic
// ─────────────────────────────────────────────

export async function processChatRequest(parsedData: any) {
  const settings = await getSettings();
  if (!settings) {
    throw new Error("Settings not configured");
  }

  const hasImage = !!parsedData.imageBase64;

  let provider = parsedData.provider || settings.selectedProvider || "groq";
  let isFallback = false;
  let modelName = hasImage ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" : "openai/gpt-oss-120b";

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

  const apiKey = settings.nvidiaApiKey;
  if (!apiKey) {
    throw new Error(`No ${provider.toUpperCase()} API key configured. Please add your API key in Settings.`);
  }

  const endpoint = "https://integrate.api.nvidia.com/v1";

  const llm = new ChatOpenAI({
    modelName,
    apiKey,
    configuration: { baseURL: endpoint },
    temperature: 0.7,
    maxTokens: 4096,
  });

  const agent = createJarvisGraph(llm as any, tools);

  let conversationId = parsedData.conversationId ?? null;
  let conversation;
  if (conversationId) {
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));
    conversation = rows[0];
  }
  if (!conversation) {
    const title =
      parsedData.message.length > 50
        ? parsedData.message.slice(0, 47) + "..."
        : parsedData.message;
    const [newConv] = await db
      .insert(conversationsTable)
      .values({ title })
      .returning();
    conversation = newConv;
    conversationId = newConv.id;
  }

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId!))
    .orderBy(desc(messagesTable.createdAt))
    .limit(20);

  let transcript = "";
  if (history.length > 0) {
    transcript =
      "\n\n=== PAST CONVERSATION HISTORY ===\n(These actions are already completed. Do NOT execute any tools for these past requests.)\n";
    history.reverse().forEach((m: any) => {
      const role = m.role === "assistant" ? "JARVIS" : "User";
      transcript += `${role}: ${m.content}\n`;
    });
    transcript += "=================================\n";
  }

  let memoryContext = "";
  try {
    const relevantMemories = await searchMemory(parsedData.message, 5);
    const filtered = relevantMemories.filter((m) => m.distance < 0.75);
    if (filtered.length > 0) {
      memoryContext =
        "\n\n=== YOUR LONG-TERM MEMORY (Auto-recalled) ===\n(These are relevant facts you've saved about this user. Use them naturally.)\n";
      filtered.forEach((m) => {
        memoryContext += `- [${m.metadata}] ${m.text_content}\n`;
      });
      memoryContext += "=============================================\n";
    }
  } catch { }

  const finalMessages: any[] = [];
  if (memoryContext || transcript) {
    finalMessages.push(
      new HumanMessage((memoryContext || "") + (transcript || "")),
    );
  }

  if (hasImage) {
    finalMessages.push(
      new HumanMessage({
        content: [
          { type: "text", text: parsedData.message },
          { type: "image_url", image_url: { url: parsedData.imageBase64! } },
        ],
      }),
    );
  } else {
    finalMessages.push(new HumanMessage(parsedData.message));
  }

  await db.insert(messagesTable).values({
    conversationId: conversationId!,
    role: "user",
    content: parsedData.message,
  });

  let agentResponse = "";
  const toolsUsed: string[] = [];
  try {
    const agentResult = await agent.invoke(
      { messages: finalMessages, next: "Orchestrator" },
      { recursionLimit: 200 },
    );
    const lastMessage = agentResult.messages[agentResult.messages.length - 1];
    agentResponse = String(lastMessage.content);

    for (const msg of agentResult.messages) {
      if (msg._getType() === "ai" && (msg as AIMessage).tool_calls?.length) {
        (msg as AIMessage).tool_calls?.forEach((tc: any) => {
          if (tc.name && !toolsUsed.includes(tc.name)) {
            toolsUsed.push(tc.name);
          }
        });
      }
    }

    agentResponse = agentResponse.replace(/\[Orchestrator\]:/g, "").trim();

    if (!toolsUsed.length) {
      const jsonMatch = agentResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsedJson = JSON.parse(jsonMatch[0]);
          let toolName =
            parsedJson.function || parsedJson.tool || parsedJson.name;
          let toolArgs = parsedJson.arguments || parsedJson;

          if (
            !toolName &&
            parsedJson.tool_calls &&
            Array.isArray(parsedJson.tool_calls) &&
            parsedJson.tool_calls.length > 0
          ) {
            toolName =
              parsedJson.tool_calls[0].function?.name ||
              parsedJson.tool_calls[0].name;
            toolArgs =
              parsedJson.tool_calls[0].function?.arguments ||
              parsedJson.tool_calls[0].arguments;
            if (typeof toolArgs === "string") {
              try {
                toolArgs = JSON.parse(toolArgs);
              } catch (e) { }
            }
          }

          if (toolName && typeof toolName === "string") {
            const tool = tools.find((t) => t.name === toolName);
            if (tool) {
              toolsUsed.push(toolName);
              if (toolArgs.function) delete toolArgs.function;
              if (toolArgs.tool) delete toolArgs.tool;
              if (toolArgs.name) delete toolArgs.name;

              const result = await (tool as any).invoke(toolArgs as any);

              finalMessages.push(new AIMessage(agentResponse));
              finalMessages.push(
                new HumanMessage(
                  `Tool ${toolName} returned:\n${result}\nNow provide the final conversational answer.`,
                ),
              );
              const finalResult = await llm.invoke(finalMessages);
              agentResponse = String(finalResult.content);
            }
          }
        } catch (e) { }
      }
    }
    if (!toolsUsed.length) {
      const useToolMatch = agentResponse.match(
        /<use_tool>\s*([\s\S]*?)\s*<\/use_tool>/i,
      );
      if (useToolMatch) {
        try {
          const parsed = JSON.parse(useToolMatch[1]);
          const toolName = parsed.name || parsed.tool;
          const toolArgs =
            parsed.parameters || parsed.arguments || parsed.params || {};
          const tool = tools.find((t) => t.name === toolName);
          if (tool && toolName) {
            toolsUsed.push(toolName);
            const result = await (tool as any).invoke(toolArgs);
            const cleanedResponse = agentResponse
              .replace(/<use_tool>[\s\S]*?<\/use_tool>/gi, "")
              .trim();
            finalMessages.push(
              new AIMessage(cleanedResponse || `Executed tool ${toolName}.`),
            );
            finalMessages.push(
              new HumanMessage(
                `Tool "${toolName}" returned:\n${result}\n\nNow give the user a clean, conversational final answer based on this result. Do not output any tool blocks.`,
              ),
            );
            const finalResult = await llm.invoke(finalMessages);
            agentResponse = String(finalResult.content);
          }
        } catch (e) { }
      }
    }
  } catch (err: any) {
    logger.error(
      { err },
      "Agentic loop failed, falling back to simple LLM call",
    );
    try {
      let handledTool = false;

      const errString =
        typeof err?.error?.error?.failed_generation === "string"
          ? err.error.error.failed_generation
          : JSON.stringify(err, Object.getOwnPropertyNames(err));

      const functionMatch = errString.match(
        /<function=(\w+)\s+(.*?)\s*<\/function>/,
      );

      if (functionMatch) {
        const toolName = functionMatch[1];
        let toolArgsStr = functionMatch[2];
        if (toolArgsStr.includes('\\"')) {
          toolArgsStr = toolArgsStr.replace(/\\"/g, '"');
        }

        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolArgsStr);
        } catch (e) { }

        const tool = tools.find((t) => t.name === toolName);
        if (tool) {
          toolsUsed.push(toolName);
          const result = await (tool as any).invoke(toolArgs as any);
          finalMessages.push(
            new AIMessage(
              `Used tool ${toolName} with args: ${JSON.stringify(toolArgs)}`,
            ),
          );
          finalMessages.push(
            new HumanMessage(
              `Tool ${toolName} returned:\n${result}\nNow provide the final conversational answer.`,
            ),
          );

          const finalResult = await llm.invoke(finalMessages);
          agentResponse = String(finalResult.content);
          handledTool = true;
        }
      }

      if (!handledTool) {
        const fallbackResult = await llm.invoke(finalMessages);
        agentResponse = String(fallbackResult.content);
      }
    } catch (fallbackErr) {
      agentResponse =
        "I'm sorry, I encountered a service error while processing your request.";
    }
  }

  const [assistantMsg] = await db
    .insert(messagesTable)
    .values({
      conversationId: conversationId!,
      role: "assistant",
      content: agentResponse,
      model: modelName,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId!));

  return {
    reply: agentResponse,
    conversationId,
    messageId: assistantMsg.id,
    model: modelName,
    tokensUsed: 0,
    toolsUsed,
  };
}
