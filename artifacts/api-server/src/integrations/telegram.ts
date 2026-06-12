export class TelegramIntegration {
  private token: string;
  private lastUpdateId: number = 0;
  private isRunning: boolean = false;
  private onMessage: (msg: { chatId: number; title: string; message: string }) => void;
  private onCallbackQuery?: (query: { id: string; chatId: number; data: string; messageId: number }) => void;

  constructor(
      token: string, 
      onMessage: (msg: { chatId: number; title: string; message: string }) => void,
      onCallbackQuery?: (query: { id: string; chatId: number; data: string; messageId: number }) => void
  ) {
      this.token = token;
      this.onMessage = onMessage;
      this.onCallbackQuery = onCallbackQuery;
  }

  async sendMessage(chatId: number, text: string, reply_markup?: any) {
      try {
          const body: any = { chat_id: chatId, text };
          if (reply_markup) body.reply_markup = reply_markup;

          await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
      } catch (e) {
          console.error('[Telegram Integration] Failed to send message:', e);
      }
  }

  async sendChatAction(chatId: number, action: string = 'typing') {
      try {
          await fetch(`https://api.telegram.org/bot${this.token}/sendChatAction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, action })
          });
      } catch (e) {
          console.error('[Telegram Integration] Failed to send chat action:', e);
      }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
      try {
          const body: any = { callback_query_id: callbackQueryId };
          if (text) body.text = text;

          await fetch(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
      } catch (e) {
          console.error('[Telegram Integration] Failed to answer callback query:', e);
      }
  }

  async start() {
      this.isRunning = true;
      console.log('[Telegram Integration] Started listening for messages');
      
      while (this.isRunning) {
          try {
              // Long polling
              const res = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`);
              if (!res.ok) {
                  throw new Error(`HTTP ${res.status}: ${await res.text()}`);
              }
              const data = await res.json() as any;
              
              if (data.ok && data.result) {
                  for (const update of data.result) {
                      this.lastUpdateId = update.update_id;
                      
                      if (update.message?.text) {
                          const sender = update.message.chat.first_name || update.message.chat.title || 'Telegram';
                          this.onMessage({
                              chatId: update.message.chat.id,
                              title: `Telegram: ${sender}`,
                              message: update.message.text
                          });
                      } else if (update.callback_query && this.onCallbackQuery) {
                          this.onCallbackQuery({
                              id: update.callback_query.id,
                              chatId: update.callback_query.message.chat.id,
                              data: update.callback_query.data,
                              messageId: update.callback_query.message.message_id
                          });
                      }
                  }
              }
          } catch (e: any) {
              console.error('[Telegram Integration] Polling error:', e.message);
              // Wait before retrying to prevent spamming
              await new Promise(r => setTimeout(r, 5000));
          }
      }
  }
  
  stop() {
      this.isRunning = false;
      console.log('[Telegram Integration] Stopped');
  }
}
