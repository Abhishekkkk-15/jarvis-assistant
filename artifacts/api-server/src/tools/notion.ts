import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Client } from "@notionhq/client";

import { db, settingsTable } from "@workspace/db";

async function getNotionClient() {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0];
  const apiKey = settings?.notionApiKey || process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY is not configured in Settings.");
  }
  return new Client({ auth: apiKey });
}

export const notionSearch = new DynamicStructuredTool({
  name: "notion_search",
  description: "Search the user's Notion workspace for pages, databases, and blocks by title or content.",
  schema: z.object({
    query: z.string().describe("The search query to match against page titles or text."),
  }),
  func: async ({ query }: { query: string }) => {
    try {
      const notion = await getNotionClient();
      const response = await notion.search({
        query: query,
        page_size: 5,
        sort: { direction: "descending", timestamp: "last_edited_time" }
      });
      
      if (response.results.length === 0) {
        return `No results found in Notion for query: "${query}"`;
      }
      
      const resultsSummary = response.results.map((r: any) => {
        let title = "Untitled";
        if (r.object === "page" && r.properties) {
          const titleProp = Object.values(r.properties).find((p: any) => p.type === "title") as any;
          if (titleProp && titleProp.title.length > 0) {
            title = titleProp.title.map((t: any) => t.plain_text).join("");
          }
        } else if (r.object === "database" && r.title) {
          title = r.title.map((t: any) => t.plain_text).join("");
        }
        return `- [${r.object}] ${title} (ID: ${r.id})`;
      }).join("\n");

      return `Notion search results for "${query}":\n${resultsSummary}`;
    } catch (e: any) {
      return `Error searching Notion: ${e.message}`;
    }
  },
});

export const notionReadPage = new DynamicStructuredTool({
  name: "notion_read_page",
  description: "Read the content of a specific Notion page or database using its ID.",
  schema: z.object({
    id: z.string().describe("The Notion page or block ID."),
  }),
  func: async ({ id }: { id: string }) => {
    try {
      const notion = await getNotionClient();
      const response = await notion.blocks.children.list({ block_id: id });
      
      const textContent = response.results.map((b: any) => {
        const type = b.type;
        if (b[type] && b[type].rich_text) {
          return b[type].rich_text.map((t: any) => t.plain_text).join("");
        }
        return `[${type}]`;
      }).join("\n");
      
      return `Notion page content:\n${textContent}`;
    } catch (e: any) {
      return `Error reading Notion page: ${e.message}`;
    }
  },
});

export const notionCreatePage = new DynamicStructuredTool({
  name: "notion_create_page",
  description: "Create a new page in the user's Notion workspace under a parent page, with a title and optional text content.",
  schema: z.object({
    parentPageId: z.string().describe("The Notion page ID to create the new page under."),
    title: z.string().describe("The title of the new page."),
    content: z.string().optional().describe("Plain text content to add as the page body."),
  }),
  func: async ({ parentPageId, title, content }: { parentPageId: string; title: string; content?: string }) => {
    try {
      const notion = await getNotionClient();
      const response = await notion.pages.create({
        parent: { page_id: parentPageId },
        properties: {
          title: { title: [{ text: { content: title } }] },
        },
        children: content
          ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } }]
          : undefined,
      } as any);
      return `Successfully created Notion page "${title}" (ID: ${response.id}).`;
    } catch (e: any) {
      return `Error creating Notion page: ${e.message}`;
    }
  },
});

export const notionAppendText = new DynamicStructuredTool({
  name: "notion_append_text",
  description: "Append a block of text to an existing Notion page or block.",
  schema: z.object({
    id: z.string().describe("The Notion page or block ID to append content to."),
    content: z.string().describe("The plain text content to append as a new paragraph."),
  }),
  func: async ({ id, content }: { id: string; content: string }) => {
    try {
      const notion = await getNotionClient();
      await notion.blocks.children.append({
        block_id: id,
        children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } }],
      } as any);
      return `Successfully appended content to Notion page/block ${id}.`;
    } catch (e: any) {
      return `Error appending to Notion page: ${e.message}`;
    }
  },
});

export const notionTools = [notionSearch, notionReadPage, notionCreatePage, notionAppendText];
