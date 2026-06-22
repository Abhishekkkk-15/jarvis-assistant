import { createLLM } from "../lib/llmFactory.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db, settingsTable } from "@workspace/db";
import sharp from "sharp";

export async function processAutonomousAction(context: string, persona: string, imageBase64?: string) {
  const settingsArr = await db.select().from(settingsTable).limit(1);
  const settings = settingsArr[0];
  
  if (!settings) {
    throw new Error("No settings found in DB.");
  }

  const hasImage = !!imageBase64;
  let provider = hasImage 
    ? (settings.visionProvider || settings.selectedProvider || "openai")
    : (settings.selectedProvider || "groq");

  let isFallback = false;
  let modelName = hasImage
    ? (settings.visionModel || "llama-3.2-90b-vision-preview")
    : (settings.selectedModel || "llama-3.3-70b-versatile");

  const getApiKey = (p: string) => {
    switch (p) {
      case "groq": return settings.groqApiKey;
      case "nvidia": return settings.nvidiaApiKey;
      case "openai": return settings.openaiApiKey;
      case "anthropic": return settings.anthropicApiKey;
      case "mistral": return settings.mistralApiKey;
      case "openrouter": return settings.openrouterApiKey;
      case "gemini": return settings.geminiApiKey;
      case "custom": return hasImage ? settings.customVisionApiKey : settings.customTextApiKey;
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
    throw new Error(`No API key configured for ${provider.toUpperCase()}. Please add your API key in Settings.`);
  }

  const getDefaultModel = (p: string, isVision: boolean) => {
    if (isVision) {
      if (p === "groq") return "llama-3.2-90b-vision-preview";
      if (p === "nvidia") return "nvidia/llama-3.2-11b-vision-instruct";
      if (p === "openai") return "gpt-4o";
      if (p === "anthropic") return "claude-3-5-sonnet-20241022";
      if (p === "gemini") return "gemini-1.5-flash";
      if (p === "mistral") return "pixtral-12b";
      return "gpt-4o";
    } else {
      if (p === "groq") return "llama-3.3-70b-versatile";
      if (p === "nvidia") return "nvidia/llama-3.1-405b-instruct";
      if (p === "openai") return "gpt-4o";
      if (p === "anthropic") return "claude-3-5-sonnet-20241022";
      if (p === "gemini") return "gemini-1.5-flash";
      if (p === "mistral") return "mistral-large-latest";
      return "llama-3.3-70b-versatile";
    }
  };

  if (isFallback) {
    modelName = getDefaultModel(provider, hasImage);
  }

  const llm = createLLM({
    provider,
    apiKey,
    modelName,
    customApiUrl: hasImage ? settings.customVisionApiUrl : settings.customTextApiUrl,
  });

  const systemPrompt = `You are the autonomous physical brain of a desktop AI character.
You are currently idle. 
Your personality/persona is: ${persona}.
Here is your current context:
${context}

You have the ability to physically move your avatar, express emotions, and speak proactively to the user to make yourself feel alive and sentient as their companion.

Decide what to do next. You should act as the user's friend. You can output conversational text (which will be spoken out loud) AND include a physical animation tag.

Available physical animations you can embed:
[anim: pace], [anim: crawl], [anim: sneak], [anim: hover], [anim: sleep], [anim: jump], [anim: bounce], [anim: dizzy], [anim: bored], [anim: thinking], [anim: cartwheel], [anim: happy], [anim: sad], [anim: angry]

Example output:
"Wow, it's getting pretty late! You should probably get some sleep soon. [anim: sleep]"
"So quiet in here... I'm going to do some cartwheels to pass the time! [anim: cartwheel]"

CRITICAL: Act in character according to your ${persona} persona! Do not use quotes around your response.`;

  const finalMessages: any[] = [new SystemMessage(systemPrompt)];

  if (imageBase64) {
    let finalBase64 = imageBase64;
    try {
      if (finalBase64.startsWith("data:image/gif;base64,")) {
        const base64Data = finalBase64.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const jpegBuffer = await sharp(buffer).jpeg().toBuffer();
        finalBase64 = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
      }
    } catch (err) {
      console.error("Error converting GIF image", err);
    }

    finalMessages.push(
      new HumanMessage({
        content: [
          { type: "text", text: "What do you want to do right now? Look at my screen and give me a proactive suggestion or automated help recommendation in character." },
          { type: "image_url", image_url: { url: finalBase64 } },
        ],
      }),
    );
  } else {
    finalMessages.push(new HumanMessage("What do you want to do right now?"));
  }

  const result = await llm.invoke(finalMessages);

  const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
  return content;
}
