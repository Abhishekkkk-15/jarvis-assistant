import { WebSocket } from "ws";
import fs from "fs/promises";

const DISCORD_API = "https://discord.com/api/v10";
const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Privileged intents: GUILDS | GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT
// MESSAGE_CONTENT (1<<15) must be enabled in the Discord Developer Portal under Bot → Privileged Gateway Intents
const INTENTS = (1 << 0) | (1 << 9) | (1 << 12) | (1 << 15);

export type DiscordMessage = {
  channelId: string;
  guildId?: string;
  authorId: string;
  authorName: string;
  message: string;
  imageBase64?: string;
};

export class DiscordIntegration {
  private token: string;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private botUserId: string | null = null;
  private isRunning = false;
  private onMessage: (msg: DiscordMessage) => void;

  constructor(token: string, onMessage: (msg: DiscordMessage) => void) {
    this.token = token;
    this.onMessage = onMessage;
  }

  async start() {
    this.isRunning = true;
    this.connect(GATEWAY_URL);
    console.log("[Discord] Connecting to Gateway...");
  }

  stop() {
    this.isRunning = false;
    this.clearHeartbeat();
    this.ws?.close(1000, "Stopped");
    this.ws = null;
    console.log("[Discord] Stopped");
  }

  private connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("[Discord] WebSocket connected");
    });

    this.ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.s !== null && payload.s !== undefined) this.sequence = payload.s;
        this.handlePayload(payload);
      } catch (e) {
        console.error("[Discord] Failed to parse payload:", e);
      }
    });

    this.ws.on("close", (code) => {
      console.warn(`[Discord] WebSocket closed (code ${code})`);
      this.clearHeartbeat();
      if (!this.isRunning) return;

      // Codes that allow resume; everything else re-identifies
      const canResume = ![4004, 4010, 4011, 4012, 4013, 4014].includes(code);
      const reconnectUrl = canResume && this.resumeUrl ? this.resumeUrl : GATEWAY_URL;
      if (!canResume) { this.sessionId = null; this.sequence = null; }

      setTimeout(() => this.connect(reconnectUrl), 5000);
    });

    this.ws.on("error", (err) => {
      console.error("[Discord] WebSocket error:", err.message);
    });
  }

  private handlePayload(payload: any) {
    switch (payload.op) {
      case 10: { // HELLO
        const interval = payload.d.heartbeat_interval;
        // Jitter: send first heartbeat at a random fraction of the interval
        setTimeout(() => {
          this.sendHeartbeat();
          this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), interval);
        }, Math.random() * interval);

        if (this.sessionId && this.sequence !== null) {
          this.resume();
        } else {
          this.identify();
        }
        break;
      }
      case 1: { // Server requests immediate heartbeat
        this.sendHeartbeat();
        break;
      }
      case 7: { // Reconnect
        this.ws?.close(4000, "Reconnect requested");
        break;
      }
      case 9: { // Invalid Session
        const resumable = payload.d;
        if (!resumable) { this.sessionId = null; this.sequence = null; }
        setTimeout(() => this.identify(), 1000 + Math.random() * 4000);
        break;
      }
      case 0: { // Dispatch
        this.handleEvent(payload.t, payload.d);
        break;
      }
    }
  }

  private identify() {
    this.send({
      op: 2,
      d: {
        token: this.token,
        intents: INTENTS,
        properties: { os: "windows", browser: "jarvis", device: "jarvis" },
      },
    });
  }

  private resume() {
    this.send({
      op: 6,
      d: { token: this.token, session_id: this.sessionId, seq: this.sequence },
    });
  }

  private sendHeartbeat() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ op: 1, d: this.sequence });
    }
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handleEvent(type: string, data: any) {
    if (type === "READY") {
      this.botUserId = data.user.id;
      this.sessionId = data.session_id;
      this.resumeUrl = data.resume_gateway_url + "?v=10&encoding=json";
      console.log(`[Discord] Ready as ${data.user.username}#${data.user.discriminator}`);
      return;
    }

    if (type !== "MESSAGE_CREATE") return;
    if (!data) return;

    // Ignore messages from bots (including self)
    if (data.author?.bot) return;

    const isDM = !data.guild_id;
    const content: string = data.content || "";

    // For guild messages: only respond if bot is @mentioned
    if (!isDM && this.botUserId && !content.includes(`<@${this.botUserId}>`)) return;

    // Strip the bot mention from guild messages
    const cleanContent = content
      .replace(new RegExp(`<@!?${this.botUserId}>`, "g"), "")
      .trim();

    // Download any image attachment
    let imageBase64: string | undefined;
    const attachments: any[] = data.attachments ?? [];
    const imgAttachment = attachments.find((a: any) => a.content_type?.startsWith("image/"));
    if (imgAttachment) {
      try {
        const res = await fetch(imgAttachment.url);
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = imgAttachment.content_type ?? "image/jpeg";
        imageBase64 = `data:${mime};base64,${buf.toString("base64")}`;
      } catch (e) {
        console.error("[Discord] Failed to download image attachment:", e);
      }
    }

    this.onMessage({
      channelId: data.channel_id,
      guildId: data.guild_id,
      authorId: data.author.id,
      authorName: data.author.global_name ?? data.author.username,
      message: cleanContent,
      imageBase64,
    });
  }

  // ── REST helpers ──────────────────────────────────────────────────────────

  async sendMessage(channelId: string, content: string): Promise<void> {
    try {
      await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
    } catch (e: any) {
      console.error("[Discord] sendMessage failed:", e.message);
    }
  }

  async sendPhoto(channelId: string, buffer: Buffer, caption?: string): Promise<void> {
    try {
      const form = new FormData();
      if (caption) form.append("content", caption);
      form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/png" }), "image.png");

      await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${this.token}` },
        body: form,
      });
    } catch (e: any) {
      console.error("[Discord] sendPhoto failed:", e.message);
    }
  }

  async sendFile(channelId: string, filePath: string, caption?: string): Promise<void> {
    try {
      const buffer = await fs.readFile(filePath);
      await this.sendPhoto(channelId, buffer, caption);
    } catch (e: any) {
      console.error("[Discord] sendFile failed:", e.message);
    }
  }
}
