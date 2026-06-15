import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import { ensureSettings } from "../services/settingsService.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import mime from "mime-types";
import path from "path";

export const describeImageTool = new DynamicStructuredTool({
  name: "describe_image",
  description: "Describes an image from a local file path or URL using a Vision LLM. Useful when you need to 'see' a screenshot or image.",
  schema: z.object({
    image_path_or_url: z.string().describe("Absolute local file path or HTTP(s) URL to an image."),
    prompt: z.string().optional().describe("Optional prompt or question about the image. Defaults to asking for a detailed description."),
  }),
  func: async ({ image_path_or_url, prompt }) => {
    try {
      let finalBase64 = "";

      if (image_path_or_url.startsWith("http://") || image_path_or_url.startsWith("https://")) {
        // Fetch from URL
        const resp = await fetch(image_path_or_url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = resp.headers.get("content-type") || "image/jpeg";
        finalBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
      } else {
        // Read local file
        const buffer = await fs.readFile(image_path_or_url);
        let contentType = mime.lookup(path.extname(image_path_or_url)) || "image/jpeg";
        finalBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
      }

      const settings = await ensureSettings();
      let provider = settings.visionProvider || "groq";
      let modelName = settings.visionModel || "llama-3.2-90b-vision-preview";

      // Fallback logic for API keys
      if (provider === "groq" && !settings.groqApiKey && settings.nvidiaApiKey) {
        provider = "nvidia";
      } else if (provider === "nvidia" && !settings.nvidiaApiKey && settings.groqApiKey) {
        provider = "groq";
      }

      const apiKey = provider === "nvidia" ? settings.nvidiaApiKey : settings.groqApiKey;
      if (!apiKey) {
        return `Error: No ${provider.toUpperCase()} API key configured.`;
      }

      const endpoint = provider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1"
        : "https://api.groq.com/openai/v1";

      const llm = new ChatOpenAI({
        modelName,
        apiKey,
        configuration: { baseURL: endpoint },
        temperature: 0,
        maxTokens: 4092,
      });

      const messageContent = [
        { type: "text", text: prompt || "Please describe this image in detail." },
        { type: "image_url", image_url: { url: finalBase64 } },
      ];

      const result = await llm.invoke([new HumanMessage({ content: messageContent })]);
      return String(result.content);
    } catch (err: any) {
      return `Error analyzing image: ${err.message}`;
    }
  },
});

export const visionTools = [describeImageTool];
