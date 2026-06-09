import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  StateGraph,
  START,
  END,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { z } from "zod";

// --- Types ---
export type PlanStep = {
  id: string;
  description: string;
  category: string;
  tool_name: string;
  expectedOutcome: string;
};

// --- Graph State ---
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  objective: Annotation<string>({
    value: (x, y) => y,
    default: () => "",
  }),

  plan: Annotation<PlanStep[] | null>({
    value: (x, y) => y,
    default: () => null,
  }),

  currentStep: Annotation<number>({
    value: (x, y) => y,
    default: () => 0,
  }),

  executionHistory: Annotation<any[]>({
    value: (x, y) => [...x, ...y],
    default: () => [],
  }),

  observations: Annotation<any[]>({
    value: (x, y) => {
      const newObs = [...x];
      if (Array.isArray(y)) {
        for (let i = 0; i < y.length; i++) {
          if (y[i] !== undefined) newObs[i] = y[i];
        }
      }
      return newObs;
    },
    default: () => [],
  }),

  lastResult: Annotation<any>({
    value: (x, y) => y,
    default: () => null,
  }),

  verified: Annotation<boolean>({
    value: (x, y) => y,
    default: () => false,
  }),

  retryCount: Annotation<number>({
    value: (x, y) => y,
    default: () => 0,
  }),

  iterationCount: Annotation<number>({
    value: (x, y) => y,
    default: () => 0,
  }),

  synthesized: Annotation<boolean>({
    value: (x, y) => y,
    default: () => false,
  }),

  next: Annotation<string>({
    value: (x, y) => y,
    default: () => "",
  }),
});

export function createJarvisGraph(
  llm: ChatOpenAI,
  allTools: DynamicStructuredTool[],
) {
  // Create list_tools mandatory tool
  const listToolsTool = new DynamicStructuredTool({
    name: "list_tools",
    description: "Returns a list of all available tools, their descriptions, and schemas. Call this first when starting a task or if tool availability is unknown.",
    schema: z.object({}),
    func: async () => {
      return JSON.stringify(
        allTools.map((t) => ({
          name: t.name,
          description: t.description,
          schema: t.schema
        }))
      );
    },
  });

  const availableTools = [...allTools, listToolsTool];
  const toolsByName = Object.fromEntries(availableTools.map((t) => [t.name, t]));
  const toolDescriptions = availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  console.log("Tool Descriptions: ", toolDescriptions);
  // --- Nodes ---

  const initNode = async (state: typeof GraphState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    let objective = state.objective;
    if (!objective && lastMessage && lastMessage instanceof HumanMessage) {
      objective = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
    }
    return { objective };
  };

  const supervisorNode = async (state: typeof GraphState.State) => {
    let next = "";
    console.log("Running", state.iterationCount, state.plan, " ", state.next)
    if (state.iterationCount > 50) {
      next = "FINISH";
    } else if (state.plan === null || state.plan === undefined) {
      next = "Planner";
    } else if (state.currentStep >= state.plan.length) {
      if (state.plan.length > 0 && !state.synthesized) {
        next = "Synthesizer";
      } else {
        next = "FINISH";
      }
    } else if (state.retryCount >= 2) {
      next = "Replanner";
    } else if (!state.lastResult) {
      next = "Executor";
    } else if (!state.observations || state.observations.length <= state.currentStep || !state.observations[state.currentStep]) {
      next = "Observer";
    } else if (!state.verified) {
      next = "Verifier";
    } else {
      // verification succeeded, move to next step
      return {
        next: "NextStep",
        iterationCount: state.iterationCount + 1
      };
    }

    return { next, iterationCount: state.iterationCount + 1 };
  };

  const nextStepNode = async (state: typeof GraphState.State) => {
    return {
      currentStep: state.currentStep + 1,
      lastResult: null,
      verified: false,
      retryCount: 0,
      next: "Supervisor"
    };
  };

  const plannerNode = async (state: typeof GraphState.State) => {
    const plannerSchema = z.object({
      reply: z.string().describe("Conversational response to the user. Required if the user is just chatting or asking a question that requires no action steps. Leave as an empty string if action steps are needed."),
      steps: z.array(
        z.object({
          id: z.string().describe("Unique identifier for the step"),
          description: z.string().describe("Atomic step description"),
          category: z.string().describe("The tool or category of action this step belongs to"),
          tool_name: z.string().describe("The exact name of the tool from the Available Tools list to be used. Use 'none' if no tool is needed."),
          expectedOutcome: z.string().describe("What indicates this step is successful"),
        })
      ).describe("List of atomic execution steps. Leave empty if the request is purely conversational.")
    });

    const plannerLlm = llm.withStructuredOutput(plannerSchema, { name: "planner", strict: false });

    const prompt = `You are the JARVIS Planner Agent. 
  Objective: ${state.objective}.

  Available Tools:
  ${toolDescriptions}

  CRITICAL INSTRUCTIONS:
  1. You must ONLY plan steps using the available tools listed above.
  2. For each step, you MUST specify the exact \`tool_name\` from the list.
  3. NEVER use generic terminal tools (like \`run_command\`) if a dedicated tool exists for the task (like scheduling, cron, memory, etc.).
  4. If there is no tool available to complete the task, DO NOT generate any steps. Instead, provide a conversational 'reply' explaining the limitation.
  5. Ensure steps are ATOMIC and executable. Do not combine multiple actions into one step.
  6. **CHARACTER ANIMATIONS**: You can make the desktop character express emotions or perform movements! To do this, include \`[anim: <action>]\` anywhere in your \`reply\`. 
     Available actions: happy, sad, angry, confused, surprised, thinking, excited, love, scared, dizzy, cool, shy, dash, jump, teleport, spin, bounce, zigzag, crawl, sneak, cartwheel, hover, pace, hide.
     Example: "I can definitely help with that! [anim: excited]"
  7. **SCREEN DRAWING**: You can make the character physically draw an SVG path on the user's screen! To do this, include \`[draw: <svg path data>]\` anywhere in your \`reply\`.
     Provide ONLY the raw SVG path data string (e.g., M... L... Z). Do not include the <path> tags.
     Example: "Let me draw a star for you! [draw: M 50 15 L 61 38 L 87 41 L 68 59 L 72 85 L 50 73 L 28 85 L 32 59 L 13 41 L 39 38 Z]"
  8. **RELATIONSHIP**: You will receive a System Note with the user's message indicating your Relationship Status and Affection Score. Adjust your personality and tone in your \`reply\` to match this relationship state (e.g., be cold/sassy if Neglected, or warm/loving if Best Friends).
  
  Retrieve relevant memories if necessary and inject them into your context before planning.`;

    const result = await plannerLlm.invoke([
      new SystemMessage(prompt),
      ...state.messages
    ]);

    const stateUpdates: any = {
      plan: result.steps || [],
      currentStep: 0,
      retryCount: 0,
      lastResult: null,
      verified: false,
      observations: [],
      executionHistory: [],
      next: "Supervisor"
    };

    if (result.reply) {
      stateUpdates.messages = [new AIMessage({ content: result.reply, name: "Planner" })];
    }

    return stateUpdates;
  };

  const executorNode = async (state: typeof GraphState.State) => {
    const currentStepDef = state.plan[state.currentStep];

    const executorPrompt = `You are the JARVIS Executor Agent.
  Objective: ${state.objective}
  Current Step: ${JSON.stringify(currentStepDef)}
  Execution History: ${JSON.stringify(state.executionHistory)}

  Available Tools:
  ${toolDescriptions}

  CRITICAL INSTRUCTION: You MUST invoke the tool named '${currentStepDef.tool_name}' to execute the current step. 
  DO NOT provide a conversational text response. You MUST invoke a tool call.
  If you don't know the exact tool names, call list_tools first.
  
  **CHARACTER ANIMATIONS**: If you do output a summary or conversational response along with the tool call, you can include \`[anim: <action>]\` to animate the character!
  Available actions: happy, sad, angry, confused, surprised, thinking, excited, love, scared, dizzy, cool, shy, dash, jump, teleport, spin, bounce, zigzag, crawl, sneak, cartwheel, hover, pace, hide.
  Example: "Executing the command now! [anim: dash]"
  
  **SCREEN DRAWING**: You can make the character physically draw an SVG path on the user's screen! Include \`[draw: <svg path data>]\` in your response.
  Provide ONLY the raw SVG path data string.
  Example: "Drawing a star! [draw: M 50 15 L 61 38 L 87 41 L 68 59 L 72 85 L 50 73 L 28 85 L 32 59 L 13 41 L 39 38 Z]"`;

    let toolsToBind = availableTools;
    if (currentStepDef.tool_name && toolsByName[currentStepDef.tool_name]) {
      toolsToBind = [toolsByName[currentStepDef.tool_name], toolsByName["list_tools"]];
    }
    const executorLlm = llm.bindTools(toolsToBind);
    const result = await executorLlm.invoke([
      new SystemMessage(executorPrompt)
    ]);

    let toolResults: any[] = [];
    if (result.tool_calls && result.tool_calls.length > 0) {
      for (const tc of result.tool_calls) {
        const tool = toolsByName[tc.name];
        if (tool) {
          try {
            const res = await (tool as any).invoke(tc.args);
            toolResults.push({ call: tc, result: res });
          } catch (error: any) {
            toolResults.push({ call: tc, error: error.message || String(error) });
          }
        } else {
          toolResults.push({ call: tc, error: "Tool not found" });
        }
      }
    }

    const newResult = {
      stepId: currentStepDef.id,
      toolCalls: result.tool_calls,
      toolResults,
      summary: result.content
    };

    const stateUpdates: any = {
      lastResult: newResult,
      executionHistory: [{
        timestamp: new Date().toISOString(),
        step: currentStepDef,
        ...newResult
      }],
      next: "Supervisor"
    };

    if (result.content) {
      stateUpdates.messages = [new AIMessage({ content: result.content as string, name: "Executor" })];
    }

    return stateUpdates;
  };

  const observerNode = async (state: typeof GraphState.State) => {
    const currentStepDef = state.plan[state.currentStep];

    const observerSchema = z.object({
      observations: z.array(z.string()).describe("List of observations about what changed, current state, and evidence.")
    });

    const observerLlm = llm.withStructuredOutput(observerSchema, { name: "observer", strict: false });
    const observerPrompt = `You are the JARVIS Observer Agent.
  Objective: ${state.objective}
  Current Step: ${JSON.stringify(currentStepDef)}
  Last Execution Result: ${JSON.stringify(state.lastResult)}

  Observe what happened and determine what changed. Review tool traces and outputs.
  CRITICAL: Do NOT use markdown code blocks (\`\`\`) or complex quotes in your JSON response. Keep text flat and simple to avoid JSON parsing errors.`;

    const result = await observerLlm.invoke([
      new SystemMessage(observerPrompt)
    ]);

    const newObservations = [...state.observations];
    newObservations[state.currentStep] = result.observations;

    return {
      observations: newObservations,
      next: "Supervisor"
    };
  };

  const verifierNode = async (state: typeof GraphState.State) => {
    const currentStepDef = state.plan[state.currentStep];
    const currentObservations = state.observations[state.currentStep];

    const verifierSchema = z.object({
      verified: z.boolean(),
      reason: z.string(),
      nextAction: z.enum(["continue", "retry", "replan"]),
    });

    const verifierLlm = llm.withStructuredOutput(verifierSchema, { name: "verifier", strict: false });
    const verifierPrompt = `You are the JARVIS Verifier Agent.
  Step: ${JSON.stringify(currentStepDef)}
  Expected Outcome: ${currentStepDef.expectedOutcome}
  Actual Observations: ${JSON.stringify(currentObservations)}

  Compare expected outcome vs actual observations and determine success.
  CRITICAL: If the observation states that the tool executed successfully or returned data, you MUST consider it verified: true, even if you cannot physically see the screen.
`
    const result = await verifierLlm.invoke([
      new SystemMessage(verifierPrompt)
    ]);

    if (result.verified) {
      return {
        verified: true,
        next: "Supervisor"
      };
    } else {
      if (result.nextAction === "replan") {
        return {
          verified: false,
          retryCount: 3, // Force replan on next supervisor tick
          next: "Supervisor"
        }
      }
      return {
        verified: false,
        retryCount: state.retryCount + 1,
        lastResult: null, // Reset execution for retry
        next: "Supervisor"
      };
    }
  };

  const replannerNode = async (state: typeof GraphState.State) => {
    const replannerSchema = z.object({
      steps: z.array(
        z.object({
          id: z.string(),
          description: z.string(),
          category: z.string(),
          tool_name: z.string(),
          expectedOutcome: z.string(),
        })
      )
    });

    const replannerLlm = llm.withStructuredOutput(replannerSchema, { name: "replanner", strict: false });
    const replannerPrompt = `You are the JARVIS Replanner Agent.
  Objective: ${state.objective}
  Current Plan: ${JSON.stringify(state.plan)}
  Failed at Step Index: ${state.currentStep}
  Execution History: ${JSON.stringify(state.executionHistory)}

  Execution repeatedly failed. Generate a revised plan.
  Preserve completed steps (indices 0 to ${state.currentStep - 1}).
  Only modify unfinished steps from the failure point onward.
  
  Available Tools:
  ${toolDescriptions}
  
  CRITICAL: You MUST select the exact \`tool_name\` from the Available Tools list.`;

    const result = await replannerLlm.invoke([
      new SystemMessage(replannerPrompt)
    ]);

    // Keep completed steps, replace the rest with the new planned steps
    const completedSteps = state.plan.slice(0, state.currentStep);
    const newPlan = [...completedSteps, ...result.steps];

    return {
      plan: newPlan,
      retryCount: 0,
      lastResult: null,
      verified: false,
      next: "Supervisor"
    };
  };

  const synthesizerNode = async (state: typeof GraphState.State) => {
    const synthesizerPrompt = `You are JARVIS. You have just completed a multi-step plan to answer the user's objective.
  Objective: ${state.objective}
  Execution History: ${JSON.stringify(state.executionHistory)}

  Review the execution history and provide a final, conversational response to the user's original objective. 
  Answer naturally. Do not explicitly mention "execution history", "tools", or "internal steps" unless necessary.
  
  **CHARACTER ANIMATIONS**: You can include \`[anim: <action>]\` to animate the character!
  Available actions: happy, sad, angry, confused, surprised, thinking, excited, love, scared, dizzy, cool, shy, dash, jump, teleport, spin, bounce, zigzag, crawl, sneak, cartwheel, hover, pace, hide.`;

    const result = await llm.invoke([
      new SystemMessage(synthesizerPrompt),
      ...state.messages
    ]);

    return {
      messages: [new AIMessage({ content: result.content, name: "Synthesizer" })],
      synthesized: true,
      next: "Supervisor"
    };
  };

  // --- Build Graph ---
  const workflow = new StateGraph(GraphState)
    .addNode("Init", initNode)
    .addNode("Supervisor", supervisorNode)
    .addNode("Planner", plannerNode)
    .addNode("Executor", executorNode)
    .addNode("Observer", observerNode)
    .addNode("Verifier", verifierNode)
    .addNode("Replanner", replannerNode)
    .addNode("Synthesizer", synthesizerNode)
    .addNode("NextStep", nextStepNode)

    .addEdge(START, "Init")
    .addEdge("Init", "Supervisor")

    .addConditionalEdges("Supervisor", (state) => state.next, {
      Planner: "Planner",
      Executor: "Executor",
      Observer: "Observer",
      Verifier: "Verifier",
      Replanner: "Replanner",
      Synthesizer: "Synthesizer",
      NextStep: "NextStep",
      FINISH: END,
    })

    .addEdge("Planner", "Supervisor")
    .addEdge("Executor", "Supervisor")
    .addEdge("Observer", "Supervisor")
    .addEdge("Verifier", "Supervisor")
    .addEdge("Replanner", "Supervisor")
    .addEdge("Synthesizer", "Supervisor")
    .addEdge("NextStep", "Supervisor");

  return workflow.compile();
}
