import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { integrationsManager } from "../integrations/manager.js";
import fs from "fs/promises";

export const sendTelegramMessageTool = new DynamicStructuredTool({
  name: "send_telegram_message",
  description: "Send a message or an image to the user's Telegram bot chat. Use this to proactively send notifications, answers, or files/images to the user's phone.",
  schema: z.object({
    message: z.string().optional().describe("The text message to send."),
    image_path: z.string().optional().describe("Absolute path to an image file on disk to send as a photo."),
  }),
  func: async ({ message, image_path }) => {
    const telegram = integrationsManager.getTelegram();
    if (!telegram) {
      return "Telegram integration is not configured or not running.";
    }

    // Try to get the active chat ID, or fallback to the first known one if we have conversation history
    const chatId = integrationsManager.getActiveTelegramChatId();
    if (!chatId) {
      // If we don't have an active chat ID, we might not know who to send it to unless we store it.
      // But for now, if they are not actively chatting via Telegram, we can't send proactively unless we track a default chatId.
      // Let's just return an error and ask them to message the bot first.
      return "Cannot send to Telegram: No active Telegram chat session. The user must send a message to the bot first.";
    }

    try {
      if (image_path) {
        const buffer = await fs.readFile(image_path);
        await telegram.sendPhoto(chatId, buffer, message);
        return `Photo successfully sent to Telegram chat ${chatId}.`;
      } else if (message) {
        await telegram.sendMessage(chatId, message);
        return `Message successfully sent to Telegram chat ${chatId}.`;
      }
      return "No message or image path provided.";
    } catch (e: any) {
      return `Failed to send Telegram message: ${e.message}`;
    }
  },
});
