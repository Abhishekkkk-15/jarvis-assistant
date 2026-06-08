import { Router } from "express";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { context, persona = "Friendly" } = req.body;
    
    if (!context) {
      return res.status(400).json({ error: "Context is required" });
    }

    const settingsArr = await db.select().from(settingsTable).limit(1);
    const settings = settingsArr[0];
    
    if (!settings || !settings.nvidiaApiKey) {
      return res.status(400).json({ error: "API Key not configured in Settings" });
    }

    const llm = new ChatOpenAI({
      modelName: "minimaxai/minimax-m2.7", // Using the same default as chat.ts
      apiKey: settings.nvidiaApiKey,
      configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
      temperature: 0.8, 
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

    const result = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage("What do you want to do right now?")
    ]);

    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    res.json({ message: content });
  } catch (error) {
    console.error("Autonomous loop error:", error);
    res.status(500).json({ error: "Failed to generate autonomous action" });
  }
});

export { router as autonomousRouter };
