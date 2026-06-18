import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

export interface LLMConfig {
  provider: string;
  apiKey: string;
  modelName: string;
  customApiUrl?: string | null;
}

export function createLLM(config: LLMConfig) {
  const { provider, apiKey, modelName, customApiUrl } = config;

  if (provider === "anthropic") {
    // For Anthropic Claude models
    return new ChatAnthropic({
      modelName: modelName || "claude-3-5-sonnet-20241022",
      apiKey: apiKey,
      temperature: 0,
    });
  }

  // All other providers are OpenAI-compatible
  let endpoint = "";
  if (provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1";
  } else if (provider === "nvidia") {
    endpoint = "https://integrate.api.nvidia.com/v1";
  } else if (provider === "openai") {
    endpoint = "https://api.openai.com/v1";
  } else if (provider === "mistral") {
    endpoint = "https://api.mistral.ai/v1";
  } else if (provider === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1";
  } else if (provider === "gemini") {
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai";
  } else if (provider === "custom") {
    endpoint = customApiUrl || "";
  }

  return new ChatOpenAI({
    modelName: modelName,
    apiKey: apiKey,
    configuration: { baseURL: endpoint },
    temperature: 0,
    maxTokens: 4092,
  });
}
