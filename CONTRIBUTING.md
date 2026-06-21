# Contributing to JARVIS Assistant

Thank you for your interest in contributing to JARVIS Assistant! This document provides instructions for setting up the project, understanding the architecture, and contributing changes.

---

## 🏗️ Project Architecture

This project is organized as a monorepo using **pnpm workspaces** and managed with **Turborepo**. 

### Monorepo Structure

* **`artifacts/`**
  * **[jarvis](file:///e:/Jarvis-Assistant-Companionzip/artifacts/jarvis)**: The Electron desktop companion application built with React, TypeScript, and Vite.
  * **[api-server](file:///e:/Jarvis-Assistant-Companionzip/artifacts/api-server)**: The Node.js / Express backend API server that manages integration tooling, background tasks, and active LLM agent processes.
  * **[jarvis-website](file:///e:/Jarvis-Assistant-Companionzip/artifacts/jarvis-website)**: The landing page / website for JARVIS.

* **`lib/`** (Shared workspaces)
  * **[api-spec](file:///e:/Jarvis-Assistant-Companionzip/lib/api-spec)**: Holds the OpenAPI definition (`openapi.yaml`) and Orval codegen configuration.
  * **[api-client-react](file:///e:/Jarvis-Assistant-Companionzip/lib/api-client-react)**: Auto-generated React Query hooks and client generated from the OpenAPI spec.
  * **[api-zod](file:///e:/Jarvis-Assistant-Companionzip/lib/api-zod)**: Auto-generated Zod validation schemas and TypeScript types.
  * **[db](file:///e:/Jarvis-Assistant-Companionzip/lib/db)**: The database integration library utilizing SQLite and Drizzle ORM.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [pnpm](https://pnpm.io/) (used to manage workspaces and dependencies)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abhishekkkk-15/jarvis-assistant.git
   cd jarvis-assistant
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Rebuild native modules** (if required on your platform, particularly for `better-sqlite3`):
   ```bash
   pnpm run rebuild:dev
   ```

4. **Install Python dependencies** (required for screen capture, OCR-based clicking, and Windows UI Automation tools):
   ```bash
   pip install -r artifacts/api-server/requirements.txt
   ```

---

## 🛠️ Development Scripts

Run the following scripts from the root directory:

| Command | Description |
| :--- | :--- |
| `pnpm run dev` | Runs the turbo-managed development servers. |
| `pnpm run dev:desktop` | Concurrently starts the backend Express server and the Electron application in dev mode. |
| `pnpm run typecheck` | Builds shared libraries and runs typechecks across all projects. |
| `pnpm run build` | Compiles and builds all workspace packages. |
| `pnpm run lint` | Lints the monorepo workspace. |
| `pnpm run clean` | Cleans up cache and build artifacts. |

---

## 📡 API Specification & Code Generation

All communications between the Electron client and the API server are typed via OpenAPI specs. If you need to add, modify, or delete endpoints:

1. Edit the OpenAPI definition at [openapi.yaml](file:///e:/Jarvis-Assistant-Companionzip/lib/api-spec/openapi.yaml).
2. Run the codegen script to regenerate the React Query hooks and Zod schemas:
   ```bash
   pnpm --filter @workspace/api-spec codegen
   ```
3. Typecheck the libraries:
   ```bash
   pnpm run typecheck:libs
   ```

---

## 🗄️ Database Management

The database is built on top of SQLite and managed using **Drizzle ORM**.
* The schema definition is located at [lib/db/src/schema](file:///e:/Jarvis-Assistant-Companionzip/lib/db/src/schema).
* Database setup, auto-migrations, and initialization occur automatically when starting the backend server.
* The local SQLite file defaults to `sqlite.db` in the project root (or matches the OS user data directory in production builds).

---

## 🤝 Contribution Workflow

1. Create a descriptive branch from `main`:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```
2. Make your modifications.
3. Validate your code formatting and types:
   ```bash
   pnpm run typecheck
   ```
4. Commit your changes with clear messages following conventional commit guidelines:
   ```bash
   git commit -m "feat: your descriptive message"
   ```
5. Push to your branch and open a Pull Request!
