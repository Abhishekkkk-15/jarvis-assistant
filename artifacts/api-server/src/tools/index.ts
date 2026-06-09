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
];
