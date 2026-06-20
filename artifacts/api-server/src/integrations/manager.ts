import { db, settingsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { TelegramIntegration } from './telegram.js';
import { DiscordIntegration, type DiscordMessage } from './discord.js';
import { broadcast, addBroadcastListener } from "../lib/wsManager.js";

class IntegrationsManager {
  private telegram: TelegramIntegration | null = null;
  private discord: DiscordIntegration | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private conversationMap = new Map<number, number>();
  private discordConversationMap = new Map<string, number>();
  private activeTelegramChatId: number | null = null;
  private activeDiscordChannelId: string | null = null;

  constructor() {
    addBroadcastListener((event: any) => {
      if (event.type === 'approval_needed') {
        if (this.activeTelegramChatId && this.telegram) {
          this.telegram.sendMessage(this.activeTelegramChatId, `⚠️ **Approval Required**\n\n${event.reason}`, {
            inline_keyboard: [[
              { text: "✅ Approve", callback_data: `approve_${event.requestId}` },
              { text: "❌ Deny", callback_data: `deny_${event.requestId}` }
            ]]
          });
        }
        if (this.activeDiscordChannelId && this.discord) {
          this.discord.sendMessage(
            this.activeDiscordChannelId,
            `⚠️ **Approval Required**\n\n${event.reason}\n\nReply with \`!approve ${event.requestId}\` or \`!deny ${event.requestId}\``
          );
        }
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

      // Handle Discord
      if (settings.discordBotToken) {
        if (!this.discord) {
          this.discord = new DiscordIntegration(settings.discordBotToken, this.handleDiscordMessage);
          this.discord.start();
        }
      } else {
        if (this.discord) {
          this.discord.stop();
          this.discord = null;
        }
      }

    } catch (e) {
      console.error('[Integrations] Failed to check settings:', e);
    }
  }

  public async reload() {
    await this.checkSettings();
  }
  public getTelegram(): TelegramIntegration | null {
    return this.telegram;
  }

  public getDiscord(): DiscordIntegration | null {
    return this.discord;
  }

  public getActiveTelegramChatId(): number | null {
    if (this.activeTelegramChatId) return this.activeTelegramChatId;
    if (this.conversationMap.size > 0) {
      return Array.from(this.conversationMap.keys())[0];
    }
    return null;
  }

  public getActiveDiscordChannelId(): string | null {
    if (this.activeDiscordChannelId) return this.activeDiscordChannelId;
    if (this.discordConversationMap.size > 0) {
      return Array.from(this.discordConversationMap.keys())[0];
    }
    return null;
  }

  private handleTelegramMessage = async (msg: { chatId: number; title: string; message: string; imageBase64?: string }) => {
    // Notify desktop
    broadcast({ type: 'system_notification', title: msg.title, message: msg.message });
    
    if (!this.telegram) return;
    
    this.activeTelegramChatId = msg.chatId;
    const conversationId = this.conversationMap.get(msg.chatId);
    const port = process.env.PORT || 4444;

    // Save chatId to settings if not present
    try {
      const rows = await db.select().from(settingsTable).limit(1);
      if (rows.length > 0 && rows[0].telegramChatId !== String(msg.chatId)) {
        await db.update(settingsTable)
          .set({ telegramChatId: String(msg.chatId) })
          .where(eq(settingsTable.id, rows[0].id));
      }
    } catch (e) {
      console.error('[Integrations] Failed to save telegramChatId:', e);
    }

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
          imageBase64: msg.imageBase64,
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

  private handleDiscordMessage = async (msg: DiscordMessage) => {
    broadcast({ type: 'system_notification', title: `Discord: ${msg.authorName}`, message: msg.message });

    if (!this.discord) return;

    const port = process.env.PORT || 4444;
    this.activeDiscordChannelId = msg.channelId;

    // Handle approval commands
    const approvalMatch = msg.message.match(/^!(approve|deny)\s+(\S+)/i);
    if (approvalMatch) {
      const decision = approvalMatch[1].toLowerCase() === 'approve' ? 'approved' : 'denied';
      const requestId = approvalMatch[2];
      try {
        await fetch(`http://localhost:${port}/api/commands/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, decision })
        });
        await this.discord.sendMessage(msg.channelId, `Action was **${decision}**.`);
      } catch (e: any) {
        await this.discord.sendMessage(msg.channelId, `Failed to send approval: ${e.message}`);
      }
      this.activeDiscordChannelId = null;
      return;
    }

    const conversationId = this.discordConversationMap.get(msg.channelId);

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg.message,
          imageBase64: msg.imageBase64,
          conversationId: conversationId || undefined
        })
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (!res.ok) {
        await this.discord.sendMessage(msg.channelId, `JARVIS Error: ${data.error || res.statusText || 'Unknown server error'}`);
        return;
      }

      if (data.reply) {
        // Discord message limit is 2000 chars; split if needed
        const reply: string = data.reply;
        if (reply.length <= 2000) {
          await this.discord.sendMessage(msg.channelId, reply);
        } else {
          for (let i = 0; i < reply.length; i += 2000) {
            await this.discord.sendMessage(msg.channelId, reply.slice(i, i + 2000));
          }
        }
      }
      if (data.conversationId) {
        this.discordConversationMap.set(msg.channelId, data.conversationId);
      }
    } catch (e: any) {
      console.error('[Integrations] Discord remote control failed:', e);
      await this.discord.sendMessage(msg.channelId, `Error connecting to local JARVIS API: ${e.message}`);
    } finally {
      this.activeDiscordChannelId = null;
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
