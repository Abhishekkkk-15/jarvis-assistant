import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { integrationsManager } from "../integrations/manager.js";

export const sendDiscordMessageTool = new DynamicStructuredTool({
  name: "send_discord_message",
  description: "Send a message or image to the active Discord channel. Use this to proactively send notifications, answers, or files to the user on Discord.",
  schema: z.object({
    message: z.string().optional().describe("The text message to send (max 2000 chars per chunk)."),
    image_path: z.string().optional().describe("Absolute path to an image file on disk to send as an attachment."),
  }),
  func: async ({ message, image_path }) => {
    const discord = integrationsManager.getDiscord();
    if (!discord) {
      return "Discord integration is not configured or not running.";
    }

    const channelId = integrationsManager.getActiveDiscordChannelId();
    if (!channelId) {
      return "Cannot send to Discord: No active Discord channel session. The user must send a message to the bot first.";
    }

    try {
      if (image_path) {
        await discord.sendFile(channelId, image_path, message);
        return `File successfully sent to Discord channel ${channelId}.`;
      } else if (message) {
        // Split long messages at 2000-char boundary
        for (let i = 0; i < message.length; i += 2000) {
          await discord.sendMessage(channelId, message.slice(i, i + 2000));
        }
        return `Message successfully sent to Discord channel ${channelId}.`;
      }
      return "No message or image path provided.";
    } catch (e: any) {
      return `Failed to send Discord message: ${e.message}`;
    }
  },
});
