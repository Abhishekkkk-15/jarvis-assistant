# JARVIS Assistant Companion

JARVIS is an intelligent, autonomous desktop AI companion built with Electron, React, Node.js, and LangChain. More than just a chatbot, JARVIS lives on your screen as a fully interactive desktop pet with his own physics, moods, and biological needs. He can actively see what you're doing, proactively talk to you, and execute complex tools on your Windows machine.

## ✨ Core Features

*   **Autonomous Desktop Pet (Mini Mode):** JARVIS roams your screen autonomously. The physics engine allows you to drag, throw, and pet him.
*   **Mood & Relationship Engine:** He reacts to how you treat him. If neglected, he becomes sluggish with heavy gravity. If you interact often, he becomes energetic and bouncy.
*   **True Visual Awareness:** JARVIS periodically takes a screenshot of your active window and uses a Multimodal LLM to autonomously comment on your code, videos, or activities.
*   **Audio Reactivity:** JARVIS listens to your environment. If you play music, he will automatically start dancing.
*   **Extensive Tool Use (Agentic AI):** Powered by LangGraph, JARVIS can chain multiple tools together to accomplish complex requests. Available tools include:
    *   **Local System:** Run PowerShell/CMD scripts, manage files, and automate Windows UI elements.
    *   **Instant File Search:** Uses Voidtools Everything (`es.exe`) for instantaneous local file searches across NTFS drives.
    *   **Web Surfing:** Puppeteer-powered web scraping, screenshot capture, and YouTube transcript extraction.
    *   **Integrations:** GitHub, Notion, and Spotify integrations to manage your digital life.
*   **Stop/Pause Execution:** Instantly abort long-running AI tool executions if he goes down the wrong path.
*   **Voice Interaction:** Includes wake word detection, speech-to-text, and Text-to-Speech so you can talk to him hands-free.

---

## 🏗️ Architecture

The monorepo is divided into several packages and applications managed by `pnpm`:

*   **`artifacts/jarvis`**: The React frontend (Vite) and Electron Main/Renderer processes. Handles the UI, Desktop Pet overlay, physics engine, and audio processing.
*   **`artifacts/api-server`**: The Node.js Express backend. Houses the LangGraph Orchestrator, tool definitions, and LLM integrations (supports Groq, Nvidia, Minimax, and local OSS models).
*   **`packages/db`**: The SQLite database schema using Drizzle ORM for persisting settings, memory, and chat history.
*   **`lib/api-spec`**: The single source of truth for the API contract (`openapi.yaml`).
*   **`lib/api-client-react`**: Auto-generated React Query fetching hooks (via Orval) used by the frontend.
*   **`lib/api-zod`**: Auto-generated Zod validation schemas used by the backend.

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js:** v20.x or higher
*   **pnpm:** v9.x or higher
*   **OS:** Windows 10/11 is heavily recommended to support full UI Automation, PowerShell execution, and Voidtools Everything features.

### Installation

1. Clone the repository and navigate to the project root.
2. Install dependencies across the monorepo:
   ```bash
   pnpm install
   ```

### Running the App

To start both the Node.js API server and the Electron desktop app simultaneously:

```bash
pnpm run dev:desktop
```

*Note: The first time you run this, it will automatically setup the SQLite database and download `es.exe` if required for the Everything search tool.*

---

## 🔧 Workflow & Development

This project relies heavily on OpenAPI generation. If you modify the backend API routes or need to add new endpoints:

1. Update the schema in `lib/api-spec/openapi.yaml`.
2. Run the code generator to update the TypeScript types, Zod schemas, and React hooks:
   ```bash
   cd lib/api-spec
   pnpm run codegen
   ```
3. Implement the logic in `artifacts/api-server` and consume the hooks in `artifacts/jarvis`.

---

## 💡 Pro Tips

*   **Petting JARVIS:** Hover your mouse over JARVIS in Mini Mode and shake your mouse rapidly to pet him! This boosts his affection score.
*   **Testing Physics:** You can test the "Neglected" heavy physics by opening the Developer Console (Ctrl+Shift+I) and running `window.testNeglect()`.
*   **Force Wander:** Force JARVIS to wander off-screen by running `window.testWander()`.