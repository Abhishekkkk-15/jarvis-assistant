import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { z } from "zod";

export function createJarvisGraph(
  llm: ChatOpenAI,
  allTools: DynamicStructuredTool[],
) {
  // Partition tools by domain
  const osTools = [
    "run_command",
    "read_file",
    "write_file",
    "list_dir",
    "create_directory",
    "delete_file",
    "delete_directory",
  ];
  const computerTools = [
    "get_screen_size",
    "get_cursor_position",
    "mouse_control",
    "keyboard_control",
    "screen_capture",
    "window_management",
    "clipboard",
    "open_app",
    "open_website",
    "find_and_click_text",
  ];
  const browserToolsList = [
    "browser_navigate",
    "browser_click",
    "browser_type",
    "browser_extract",
    "browser_close",
  ];

  const terminalToolsList = allTools.filter((t) => osTools.includes(t.name));
  const computerToolsList = allTools.filter((t) =>
    computerTools.includes(t.name),
  );
  const webAgentToolsList = allTools.filter((t) =>
    browserToolsList.includes(t.name),
  );
  // Orchestrator keeps the rest (memory, search, weather, etc.)
  const orchestratorToolsList = allTools.filter(
    (t) =>
      !osTools.includes(t.name) &&
      !computerTools.includes(t.name) &&
      !browserToolsList.includes(t.name),
  );

  const members = [
    "Planner",
    "TerminalAgent",
    "ComputerAgent",
    "WebAgent",
  ] as const;

  // --- Graph State ---
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => [],
    }),

    objective: Annotation<string>(),
    plan: Annotation<string[]>(),
    currentStep: Annotation<number>(),
    lastResult: Annotation<any>(),
    verified: Annotation<boolean>(),
    next: Annotation<string>(),
  });

  // --- Supervisor (Orchestrator) ---
  const supervisorPrompt = `You are JARVIS, an Advanced Autonomous AI Orchestrator with a team of specialized sub-agents.
Your goal is to complete tasks requested by the user.

Your team:
- Planner: Generates step-by-step plans for complex coding or reasoning tasks.
- TerminalAgent: Executes CLI shell commands, reads, and writes files in the OS.
- ComputerAgent: Physically controls the mouse, keyboard, reads the screen, and manages UI windows.
- WebAgent: Controls a visible Chromium browser to navigate the internet, scrape data, and fill forms.

You have your own tools for memory, web search, weather, etc. Use them if needed.

INSTRUCTIONS:
1. Analyze the user request.
2. If it requires file/terminal access, route to TerminalAgent.
3. If it requires physical OS clicking/typing on screen, route to ComputerAgent.
4. If it requires navigating websites or scraping, route to WebAgent.
5. If it's a massive coding task, route to Planner first.
6. If you can handle it directly (e.g. conversational, memory retrieval, simple questions), do so.
7. When the sub-agents finish, review their work. If the user's task is fully complete, output FINISH to end the loop and give your final answer.
8. You control your physical avatar via animation tags: [anim: <animation>] (e.g. [anim: excited] Hello!).
9. DRAWING: If the user asks you to "draw" something on their screen, output a standard SVG path string inside a draw tag: [draw: <svg_path>].
   Example: [draw: M 100 100 L 200 200 C 250 150 300 200 200 300 Z]
   Keep the paths within a reasonable coordinate space (e.g. 0 to 500). The avatar will physically move along this path and draw it!
`;

  // The Orchestrator is a React Agent that has a "route" tool to decide who acts next.
  // We don't want it to run indefinitely, so we constrain it to just outputting the next agent or FINISH.
  const routeTool = new DynamicStructuredTool({
    name: "route_action",
    description:
      "Decide whether to delegate to a sub-agent or FINISH if the user's request is completely fulfilled.",
    schema: z.object({
      next: z.enum([
        "FINISH",
        "Planner",
        "TerminalAgent",
        "ComputerAgent",
        "WebAgent",
      ]),
      instructions: z
        .string()
        .describe(
          "Clear instructions or summary for the next agent or the final answer if FINISH.",
        ),
    }),
    func: async () => "routed", // We will extract the args instead of executing
  });

  const orchestratorAgent = createReactAgent({
    llm,
    tools: [...orchestratorToolsList, routeTool],
    messageModifier: supervisorPrompt,
  });

  const supervisorNode = async (state: typeof GraphState.State) => {
    if (state.plan.length == 0) {
      return {
        next: "Planner",
      };
    }
    if (state.currentStep >= state.plan.length) {
      return {
        next: "FINISH",
      };
    }
    if (state.lastResult && !state.verified) {
      return {
        next: "Verifier",
      };
    }
    if (state.verified) {
      return {
        currentStep: state.currentStep + 1,
        verified: false,
        lastResult: null,
        next: "Executor",
      };
    }
    return {
      next: "Executor",
    };
  };

  // --- Sub-Agents ---
  const plannerPrompt = `You are the JARVIS Planner Agent.
Break down the complex request into a clear, step-by-step markdown plan for the other agents.
Output the plan clearly and concisely, then stop.`;

  const terminalPrompt = `You are the JARVIS Terminal Agent.
You are an expert at CLI commands and file system management.
Use your provided tools to execute the requested actions.
When finished, summarize what you executed and the results.`;

  const computerPrompt = `You are the JARVIS Computer Control Agent.
You have REAL tools for controlling a Windows computer.
- Always call \`get_screen_size\` and \`get_cursor_position\` first.
- Use \`window_management\` to list/focus windows.
- Use \`mouse_control\` and \`keyboard_control\` to interact.
- Use \`find_and_click_text\` to click on UI text via OCR.
- Use \`screen_capture\` to see what's on screen.
Execute your physical actions autonomously and summarize your results.`;

  const webPrompt = `You are the JARVIS Web Browsing Agent.
You have tools to control a visible Puppeteer Chromium browser.
- \`browser_navigate\` to open URLs.
- \`browser_extract\` to read page content.
- \`browser_click\` and \`browser_type\` to interact with forms.
Execute your browsing actions autonomously and summarize your results.`;

  const plannerAgent = createReactAgent({
    llm,
    tools: [],
    messageModifier: plannerPrompt,
  });
  const terminalAgent = createReactAgent({
    llm,
    tools: terminalToolsList,
    messageModifier: terminalPrompt,
  });
  const computerAgent = createReactAgent({
    llm,
    tools: computerToolsList,
    messageModifier: computerPrompt,
  });
  const webAgent = createReactAgent({
    llm,
    tools: webAgentToolsList,
    messageModifier: webPrompt,
  });

  const createNode = (agentObj: any, name: string, prompt: string) => {
    return async (state: typeof GraphState.State) => {
      const messages = state.messages;
      const result = await agentObj.invoke({ messages });
      const lastMessage = result.messages[result.messages.length - 1];

      return {
        messages: [
          new AIMessage({ content: `[${name}]: ${lastMessage.content}`, name }),
        ],
        next: "Orchestrator",
      };
    };
  };

  const plannerNode = createNode(plannerAgent, "Planner", plannerPrompt);
  const terminalNode = createNode(
    terminalAgent,
    "TerminalAgent",
    terminalPrompt,
  );
  const computerNode = createNode(
    computerAgent,
    "ComputerAgent",
    computerPrompt,
  );
  const webNode = createNode(webAgent, "WebAgent", webPrompt);

  // --- Edge Router ---
  const router = (state: typeof GraphState.State) => state.next;

  // --- Build Graph ---
  const workflow = new StateGraph(GraphState)
    .addNode("Orchestrator", supervisorNode)
    .addNode("Planner", plannerNode)
    .addNode("TerminalAgent", terminalNode)
    .addNode("ComputerAgent", computerNode)
    .addNode("WebAgent", webNode)

    // Start at Orchestrator
    .addEdge(START, "Orchestrator")

    // Orchestrator routes conditionally
    .addConditionalEdges("Orchestrator", router, {
      Planner: "Planner",
      TerminalAgent: "TerminalAgent",
      ComputerAgent: "ComputerAgent",
      WebAgent: "WebAgent",
      [END]: END,
    })

    // Workers always report back to Orchestrator when they finish their turn
    .addEdge("Planner", "Orchestrator")
    .addEdge("TerminalAgent", "Orchestrator")
    .addEdge("ComputerAgent", "Orchestrator")
    .addEdge("WebAgent", "Orchestrator");

  return workflow.compile();
}
