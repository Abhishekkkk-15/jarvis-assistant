export class TelegramIntegration {
  private token: string;
  private lastUpdateId: number = 0;
  private isRunning: boolean = false;
  private onMessage: (msg: { chatId: number; title: string; message: string; imageBase64?: string }) => void;
  private onCallbackQuery?: (query: { id: string; chatId: number; data: string; messageId: number }) => void;

  constructor(
      token: string, 
      onMessage: (msg: { chatId: number; title: string; message: string; imageBase64?: string }) => void,
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

  async sendPhoto(chatId: number, photoBuffer: Buffer, caption?: string, filename: string = 'image.png') {
      try {
          const formData = new FormData();
          formData.append('chat_id', chatId.toString());
          if (caption) formData.append('caption', caption);
          
          formData.append('photo', new Blob([photoBuffer]), filename);

          await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
              method: 'POST',
              body: formData
          });
      } catch (e) {
          console.error('[Telegram Integration] Failed to send photo:', e);
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

  private async downloadPhotoBase64(fileId: string): Promise<string | undefined> {
      try {
          const fileRes = await fetch(`https://api.telegram.org/bot${this.token}/getFile?file_id=${fileId}`);
          if (!fileRes.ok) return undefined;
          
          const fileData = await fileRes.json() as any;
          if (!fileData.ok || !fileData.result?.file_path) return undefined;

          const filePath = fileData.result.file_path;
          const photoRes = await fetch(`https://api.telegram.org/file/bot${this.token}/${filePath}`);
          if (!photoRes.ok) return undefined;

          const arrayBuffer = await photoRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Determine mime type from extension
          const ext = filePath.split('.').pop()?.toLowerCase();
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          
          return `data:${mime};base64,${buffer.toString('base64')}`;
      } catch (e) {
          console.error('[Telegram Integration] Failed to download photo:', e);
          return undefined;
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
                      
                      if (update.message?.text || update.message?.photo) {
                          const sender = update.message.chat.first_name || update.message.chat.title || 'Telegram';
                          let imageBase64: string | undefined;
                          
                          if (update.message.photo && update.message.photo.length > 0) {
                              // Telegram sends an array of photo sizes. The last one is the largest.
                              const largestPhoto = update.message.photo[update.message.photo.length - 1];
                              imageBase64 = await this.downloadPhotoBase64(largestPhoto.file_id);
                          }

                          const text = update.message.text || update.message.caption || (imageBase64 ? 'I sent you an image.' : '');

                          this.onMessage({
                              chatId: update.message.chat.id,
                              title: `Telegram: ${sender}`,
                              message: text,
                              imageBase64
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
