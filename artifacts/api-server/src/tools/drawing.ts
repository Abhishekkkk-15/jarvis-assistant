import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { db, settingsTable } from "@workspace/db";
import { broadcast } from "../lib/wsManager.js";

export const drawingTools = [
  new DynamicStructuredTool({
    name: "generate_high_quality_drawing",
    description: "Generate a highly detailed, complex SVG drawing of an object. Use this when the user asks you to draw something complex or high quality.",
    schema: z.object({
      prompt: z.string().describe("What to draw. E.g. 'a majestic dragon', 'a highly detailed tree', 'a realistic portrait'"),
    }),
    func: async ({ prompt }) => {
      try {
        // Search Iconify for the prompt
        const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(prompt)}&limit=10`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.icons || searchData.icons.length === 0) {
          return `Could not find any drawings for '${prompt}'. Try a different search term.`;
        }

        // Prefer detailed icons like 'game-icons' if available, otherwise just use the first one
        let selectedIcon = searchData.icons[0];
        for (const icon of searchData.icons) {
          if (icon.startsWith('game-icons:') || icon.startsWith('fluent-emoji')) {
            selectedIcon = icon;
            break;
          }
        }

        const [prefix, name] = selectedIcon.split(':');
        const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg`;
        const svgRes = await fetch(svgUrl);
        const svgText = await svgRes.text();

        // Extract all 'd' attributes from <path> tags
        const pathRegex = /d="([^"]+)"/g;
        let match;
        const paths = [];
        while ((match = pathRegex.exec(svgText)) !== null) {
          paths.push(match[1]);
        }

        if (paths.length === 0) {
          return `Found an icon for '${prompt}' but it didn't contain any valid paths to draw.`;
        }

        // Combine multiple paths into a single continuous path string and sanitize whitespace
        const combinedPath = paths.join(" ").replace(/\s+/g, ' ').trim();

        // Broadcast directly to the frontend
        broadcast({ type: "jarvis-action", detail: { action: "draw", path: combinedPath } });

        return `Drawing successfully found and sent to the user's screen. The objective is complete!`;
      } catch (error: any) {
        return `Failed to find drawing: ${error.message}`;
      }
    },
  })
];
