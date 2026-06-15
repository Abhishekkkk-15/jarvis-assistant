import { browserTools } from "./browser.js";
import { computerTools } from "./computer.js";
import { fsTools } from "./fs.js";
import { memoryTools } from "./memory.js";
import { shellTools } from "./shell.js";
import { systemTools } from "./system.js";
import { webTools } from "./web.js";
import { cronTools } from "./cron.js";
import { drawingTools } from "./drawing.js";
import { notifyTools } from "./notify.js";
import { notionTools } from "./notion.js";
import { spotifyTools } from "./spotify.js";
import { uiaTools } from "./uiautomation.js";
import { windowsSystemTools } from "./windowsSystem.js";
import { everythingTools } from "./everything.js";
import { cdpBrowserTools } from "./cdpBrowser.js";
import { githubTools } from "./github.js";
import { emailTools } from "./email.js";
import { read_jarvis_manual } from "./jarvis_manual.js";
import { settingsTools } from "./settings.js";
import { sendTelegramMessageTool } from "./telegram.js";
import { sendDiscordMessageTool } from "./discord.js";
import { antigravityTools } from "./antigravity.js";
import { claudeTools } from "./claude_cli.js";
import { visionTools } from "./vision.js";

export const allTools = [
  ...browserTools,
  ...computerTools,
  ...fsTools,
  ...memoryTools,
  ...shellTools,
  ...systemTools,
  ...webTools,
  ...cronTools,
  ...drawingTools,
  ...notifyTools,
  ...notionTools,
  ...spotifyTools,
  ...uiaTools,
  ...windowsSystemTools,
  ...everythingTools,
  ...cdpBrowserTools,
  ...githubTools,
  ...emailTools,
  ...settingsTools,
  ...antigravityTools,
  ...claudeTools,
  ...visionTools,
  sendTelegramMessageTool,
  sendDiscordMessageTool,
  read_jarvis_manual,
];
