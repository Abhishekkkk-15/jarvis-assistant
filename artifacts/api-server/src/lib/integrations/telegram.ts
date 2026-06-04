export class TelegramIntegration {
  private token: string;
  private lastUpdateId: number = 0;
  private isRunning: boolean = false;
  private onMessage: (msg: { title: string; message: string }) => void;

  constructor(token: string, onMessage: (msg: { title: string; message: string }) => void) {
      this.token = token;
      this.onMessage = onMessage;
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
                              title: `Telegram: ${sender}`,
                              message: update.message.text
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
