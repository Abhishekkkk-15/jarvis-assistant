import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import { ensureSettings } from "../services/settingsService.js";
import { createLLM } from "../lib/llmFactory.js";
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
      let isFallback = false;

      const getApiKey = (p: string) => {
        switch (p) {
          case "groq": return settings.groqApiKey;
          case "nvidia": return settings.nvidiaApiKey;
          case "openai": return settings.openaiApiKey;
          case "anthropic": return settings.anthropicApiKey;
          case "mistral": return settings.mistralApiKey;
          case "openrouter": return settings.openrouterApiKey;
          case "gemini": return settings.geminiApiKey;
          case "custom": return settings.customVisionApiKey;
          default: return null;
        }
      };

      let apiKey = getApiKey(provider);
      if (!apiKey) {
        const providersList = ["groq", "nvidia", "openai", "anthropic", "mistral", "openrouter", "gemini", "custom"];
        for (const p of providersList) {
          const key = getApiKey(p);
          if (key) {
            provider = p;
            apiKey = key;
            isFallback = true;
            break;
          }
        }
      }

      if (!apiKey) {
        return `Error: No API key configured for ${provider.toUpperCase()}.`;
      }

      const getDefaultModel = (p: string) => {
        if (p === "groq") return "llama-3.2-90b-vision-preview";
        if (p === "nvidia") return "nvidia/llama-3.2-11b-vision-instruct";
        if (p === "openai") return "gpt-4o";
        if (p === "anthropic") return "claude-3-5-sonnet-20241022";
        if (p === "gemini") return "gemini-1.5-flash";
        if (p === "mistral") return "pixtral-12b";
        return "gpt-4o";
      };

      if (isFallback) {
        modelName = getDefaultModel(provider);
      }

      const llm = createLLM({
        provider,
        apiKey,
        modelName,
        customApiUrl: settings.customVisionApiUrl,
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
