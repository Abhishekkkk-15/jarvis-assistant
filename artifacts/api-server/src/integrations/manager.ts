import { db, settingsTable } from '@workspace/db';
import { TelegramIntegration } from './telegram.js';
import { broadcast, addBroadcastListener } from "../lib/wsManager.js";

class IntegrationsManager {
  private telegram: TelegramIntegration | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private conversationMap = new Map<number, number>();
  private activeTelegramChatId: number | null = null;

  constructor() {
    addBroadcastListener((event: any) => {
      if (event.type === 'approval_needed' && this.activeTelegramChatId && this.telegram) {
        // Send approval request to the active remote Telegram chat
        this.telegram.sendMessage(this.activeTelegramChatId, `⚠️ **Approval Required**\n\n${event.reason}`, {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `approve_${event.requestId}` },
            { text: "❌ Deny", callback_data: `deny_${event.requestId}` }
          ]]
        });
      }
    });
  }

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
          this.telegram = new TelegramIntegration(
            settings.telegramBotToken, 
            this.handleTelegramMessage,
            this.handleTelegramCallback
          );
          this.telegram.start();
        }
      } else {
        if (this.telegram) {
          this.telegram.stop();
          this.telegram = null;
        }
      }

    } catch (e) {
      console.error('[Integrations] Failed to check settings:', e);
    }
  }

  public async reload() {
    await this.checkSettings();
  }

  private handleTelegramMessage = async (msg: { chatId: number; title: string; message: string }) => {
    // Notify desktop
    broadcast({ type: 'system_notification', title: msg.title, message: msg.message });
    
    if (!this.telegram) return;
    
    this.activeTelegramChatId = msg.chatId;
    const conversationId = this.conversationMap.get(msg.chatId);
    const port = process.env.PORT || 4444;

    // Show 'typing...' indicator immediately and refresh it every 4 seconds
    this.telegram.sendChatAction(msg.chatId, 'typing');
    const typingInterval = setInterval(() => {
      this.telegram?.sendChatAction(msg.chatId, 'typing');
    }, 4000);

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg.message,
          conversationId: conversationId || undefined
        })
      });
      
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (!res.ok) {
        this.telegram.sendMessage(msg.chatId, `JARVIS Error: ${data.error || res.statusText || 'Unknown server error'}`);
        return;
      }

      if (data.reply) {
        this.telegram.sendMessage(msg.chatId, data.reply);
      }
      if (data.conversationId) {
        this.conversationMap.set(msg.chatId, data.conversationId);
      }
    } catch (e: any) {
      console.error('[Integrations] Telegram remote control failed:', e);
      this.telegram.sendMessage(msg.chatId, `Error connecting to local JARVIS API: ${e.message}`);
    } finally {
      clearInterval(typingInterval);
      this.activeTelegramChatId = null;
    }
  }

  private handleTelegramCallback = async (query: { id: string; chatId: number; data: string; messageId: number }) => {
    if (!this.telegram) return;
    
    if (query.data.startsWith('approve_') || query.data.startsWith('deny_')) {
      const parts = query.data.split('_');
      const decision = parts[0] === 'approve' ? 'approved' : 'denied';
      const requestId = parts[1];
      const port = process.env.PORT || 4444;

      try {
        await fetch(`http://localhost:${port}/api/commands/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, decision })
        });
        await this.telegram.answerCallbackQuery(query.id, `Action ${decision}!`);
        await this.telegram.sendMessage(query.chatId, `Action was **${decision}**.`);
      } catch (e) {
        await this.telegram.answerCallbackQuery(query.id, 'Failed to send approval.');
      }
    }
  }
}

export const integrationsManager = new IntegrationsManager();
