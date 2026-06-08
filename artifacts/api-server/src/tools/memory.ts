import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { saveMemory, searchMemory, listAllMemories, forgetMemory } from "../lib/memory.js";
import * as fs from "fs/promises";
import * as path from "path";

async function walkDir(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath, extensions)));
    } else {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

export const memoryTools = [
  new DynamicStructuredTool({
    name: "remember_fact",
    description: "Save an important fact, user preference, or piece of context into your long-term memory. Use this proactively whenever the user tells you something meaningful you should remember for future conversations — their name, preferences, projects, goals, etc.",
    schema: z.object({
      fact: z.string().describe("The specific fact or piece of information to remember. Be detailed and self-contained."),
      category: z.string().optional().describe("Optional category tag (e.g., 'preference', 'personal_info', 'project', 'task', 'goal')")
    }),
    func: async ({ fact, category }) => {
      try {
        const id = await saveMemory(fact, category || "general");
        return `✅ Saved to long-term memory (ID: ${id}): "${fact}"`;
      } catch (err: any) {
        return `Failed to save memory: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "recall_memory",
    description: "Search your long-term memory for relevant facts, preferences, or context. Use this at the start of conversations or whenever the user refers to something they told you before.",
    schema: z.object({
      query: z.string().describe("A natural language search query to find relevant memories (e.g., 'user favorite color', 'project they are building', 'their name')")
    }),
    func: async ({ query }) => {
      try {
        const results = await searchMemory(query, 5);
        if (results.length === 0) {
          return `No relevant memories found for: "${query}"`;
        }

        let output = `Found ${results.length} relevant memories:\n`;
        for (const res of results) {
          const similarity = ((1 - res.distance) * 100).toFixed(1);
          output += `- [${similarity}% match | ${res.metadata}] ${res.text_content}\n`;
        }
        return output;
      } catch (err: any) {
        return `Failed to recall memory: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "list_memories",
    description: "List all facts stored in your long-term memory. Use this when the user asks what you remember about them.",
    schema: z.object({}),
    func: async () => {
      try {
        const memories = await listAllMemories();
        if (memories.length === 0) {
          return "Your long-term memory is empty. I haven't saved anything yet.";
        }

        let output = `I have ${memories.length} memories stored:\n`;
        for (const m of memories) {
          output += `- [ID:${m.id} | ${m.metadata}] ${m.text_content}\n`;
        }
        return output;
      } catch (err: any) {
        return `Failed to list memories: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "forget_memory",
    description: "Delete a specific memory by its ID. Use this when the user asks you to forget something.",
    schema: z.object({
      memory_id: z.number().describe("The ID of the memory to delete (obtained from list_memories or recall_memory)")
    }),
    func: async ({ memory_id }) => {
      try {
        await forgetMemory(memory_id);
        return `✅ Memory ID ${memory_id} has been deleted.`;
      } catch (err: any) {
        return `Failed to forget memory: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "index_local_directory",
    description: "Recursively walks a local directory and indexes all text/code files into the vector database (Second Brain). Use this to 'learn' a codebase or project.",
    schema: z.object({
      directory_path: z.string().describe("Absolute path to the directory to index."),
      extensions: z.array(z.string()).describe("List of file extensions to include (e.g. ['.ts', '.js', '.md', '.txt']).")
    }),
    func: async ({ directory_path, extensions }) => {
      try {
        const files = await walkDir(directory_path, extensions);
        if (files.length === 0) return "No matching files found in directory.";
        
        let indexedCount = 0;
        // Limit to 50 files per call to prevent timeout/rate limits
        const targetFiles = files.slice(0, 50);
        
        for (const file of targetFiles) {
          const content = await fs.readFile(file, "utf-8");
          // Chunking (naive 4000 char chunks)
          const chunkSize = 4000;
          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.slice(i, i + chunkSize);
            await saveMemory(chunk, `file_path: ${file}`);
            indexedCount++;
          }
        }
        
        const warning = files.length > 50 ? ` (Capped at 50 files. Call again or use smaller subdirectories)` : "";
        return `✅ Successfully indexed ${targetFiles.length} files into ${indexedCount} chunks${warning}.`;
      } catch (err: any) {
        return `Failed to index directory: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "search_local_files",
    description: "Semantic search across all previously indexed local files in your 'Second Brain'. Use this to quickly find code snippets or documents.",
    schema: z.object({
      query: z.string().describe("Search query (e.g. 'function that saves memory to database', 'login component')")
    }),
    func: async ({ query }) => {
      try {
        const results = await searchMemory(query, 5);
        if (results.length === 0) {
          return `No relevant files found for: "${query}". You may need to index the directory first using 'index_local_directory'.`;
        }

        let output = `Found ${results.length} relevant file chunks:\n`;
        for (const res of results) {
          const similarity = ((1 - res.distance) * 100).toFixed(1);
          output += `\n--- [${similarity}% match | ${res.metadata}] ---\n${res.text_content}\n`;
        }
        return output;
      } catch (err: any) {
        return `Failed to search local files: ${err.message}`;
      }
    },
  }),
];
