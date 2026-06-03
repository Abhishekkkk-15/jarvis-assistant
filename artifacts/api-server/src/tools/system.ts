import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requestApprovalFromUser, broadcast } from "../lib/wsManager.js";

export const systemTools = [
  new DynamicStructuredTool({
    name: "listTools",
    description: "Returns a list of all tools currently available to the agent.",
    schema: z.object({}),
    func: async () => {
      return "Available tools: web_browser_page_reader, website_screenshot_capture, pdf_reader, youtube_transcript_extractor, rss_feed_reader, news_search, mouse_control, keyboard_control, screen_capture, window_management, read_file, write_file, edit_file, create_directory, delete_file, move_rename_file, search_files, execute_bash, execute_powershell, execute_cmd, process_management, listTools, requestApproval, askQuestion.";
    },
  }),
  new DynamicStructuredTool({
    name: "requestApproval",
    description: "PAUSE execution and request explicit user approval before performing a dangerous or destructive action. The agent will WAIT until the user approves or denies.",
    schema: z.object({ reason: z.string().describe("Clear description of what action needs approval and why it is risky") }),
    func: async ({ reason }) => {
      const requestId = randomUUID();
      console.log(`[requestApproval] Waiting for user approval: ${reason} (ID: ${requestId})`);

      // This blocks the agentic loop until the user responds from the frontend
      const decision = await requestApprovalFromUser(requestId, reason);

      if (decision === "approved") {
        return `User APPROVED: "${reason}". Proceed with the action.`;
      } else {
        return `User DENIED: "${reason}". Do NOT proceed. Inform the user you have cancelled this action.`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "askQuestion",
    description: "Ask the user a clarifying question. The agent will pause and wait for the user's next message.",
    schema: z.object({ question: z.string() }),
    func: async ({ question }) => {
      // Broadcast the question so the frontend can show it prominently
      broadcast({ type: "agent_question", question });
      return `Question sent to user: "${question}". The user will answer in their next message.`;
    },
  })
];

