import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db, settingsTable } from "@workspace/db";

export const settingsTools = [
  tool(
    async () => {
      try {
        const rows = await db.select().from(settingsTable).limit(1);
        if (rows.length === 0) return "No settings configured yet.";
        const s = rows[0];

        return JSON.stringify({
          emailConfigured: !!(s.emailAddress && s.emailPassword && s.emailProvider),
          telegramBotConfigured: !!s.telegramBotToken,
          discordBotConfigured: !!s.discordBotToken,
          notionConfigured: !!s.notionApiKey,
          spotifyConfigured: !!(s.spotifyClientId && s.spotifyClientSecret),
          groqApiKeySet: !!s.groqApiKey,
          nvidiaApiKeySet: !!s.nvidiaApiKey,
          voiceEnabled: s.voiceEnabled,
        }, null, 2);
      } catch (err: any) {
        return `Failed to check settings: ${err.message}`;
      }
    },
    {
      name: "check_configured_settings",
      description: "Checks which integrations and credentials the user has configured (e.g. Email, Notion, Spotify, Telegram). Returns boolean statuses indicating if they are setup. Use this to check if a user has configured an integration before trying to use it.",
      schema: z.object({}),
    }
  )
];
