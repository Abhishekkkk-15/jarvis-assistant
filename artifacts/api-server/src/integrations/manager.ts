import { db, settingsTable } from '@workspace/db';
import { TelegramIntegration } from './telegram.js';
import { broadcast } from "../lib/wsManager.js";

class IntegrationsManager {
  private telegram: TelegramIntegration | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {}

  async start() {
    console.log('[Integrations] Starting manager...');
    this.checkSettings();
    // Re-check settings every 60 seconds to pick up new API keys
    this.checkInterval = setInterval(() => this.checkSettings(), 60000);
  }

  async checkSettings() {
    try {
      const rows = await db.select().from(settingsTable).limit(1);
      if (rows.length === 0) return;
      
      const settings = rows[0];

      // Handle Telegram
      if (settings.telegramBotToken) {
        if (!this.telegram) {
          this.telegram = new TelegramIntegration(settings.telegramBotToken, this.handleNotification);
          this.telegram.start();
        }
      } else {
        if (this.telegram) {
          this.telegram.stop();
          this.telegram = null;
        }
      }

      // Handle Discord (placeholder for now)
      // if (settings.discordBotToken) { ... }

    } catch (e) {
      console.error('[Integrations] Failed to check settings:', e);
    }
  }

  // Reload immediately when settings change via API
  public async reload() {
    await this.checkSettings();
  }

  private handleNotification = (msg: { title: string; message: string }) => {
    broadcast({ type: 'system_notification', ...msg });
  }
}

export const integrationsManager = new IntegrationsManager();
