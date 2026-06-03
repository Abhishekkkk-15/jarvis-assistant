import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const systemTools = [
  new DynamicStructuredTool({
    name: "listTools",
    description: "Returns a list of all tools currently available to the agent.",
    schema: z.object({}),
    func: async () => {
      // In a real scenario, this might need a reference to the tools array. 
      // For now, returning a static or dynamic summary based on context.
      return "Available tools: Web Browser, Screenshot, PDF Reader, YouTube Extractor, RSS, News, Mouse, Keyboard, Screen Capture, Window Management, FS Read/Write/Delete/Search, Bash, PowerShell, CMD, Process Management, listTools, requestApproval, askQuestion.";
    },
  }),
  new DynamicStructuredTool({
    name: "requestApproval",
    description: "Pause execution and request user approval for a high-risk action.",
    schema: z.object({ reason: z.string() }),
    func: async ({ reason }) => {
      return `Approval requested for: ${reason}. Please wait for the user to respond before proceeding.`;
    },
  }),
  new DynamicStructuredTool({
    name: "askQuestion",
    description: "Ask the user a clarifying question about their task.",
    schema: z.object({ question: z.string() }),
    func: async ({ question }) => {
      return `Question asked to user: ${question}. Please wait for the user to respond.`;
    },
  })
];
