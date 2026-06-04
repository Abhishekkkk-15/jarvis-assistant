import { webTools } from "./web.js";
import { computerTools } from "./computer.js";
import { fsTools } from "./fs.js";
import { shellTools } from "./shell.js";
import { systemTools } from "./system.js";
import { memoryTools } from "./memory.js";

export const allTools = [
  ...webTools,
  ...computerTools,
  ...fsTools,
  ...shellTools,
  ...systemTools,
  ...memoryTools
];
