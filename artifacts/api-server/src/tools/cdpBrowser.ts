import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import puppeteer from "puppeteer-core";

let browserInstance: any = null;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  try {
    browserInstance = await puppeteer.connect({
      browserURL: "http://localhost:9222",
      defaultViewport: null,
    });
    return browserInstance;
  } catch (err: any) {
    throw new Error(`Failed to connect to active browser. Make sure Chrome/Edge is running with --remote-debugging-port=9222. Error: ${err.message}`);
  }
}

export const cdpBrowserTools = [
  new DynamicStructuredTool({
    name: "cdp_list_tabs",
    description: "List all open tabs in the active browser to see what the user is currently looking at.",
    schema: z.object({}),
    func: async () => {
      try {
        const browser = await getBrowser();
        const pages = await browser.pages();
        const tabList = await Promise.all(pages.map(async (p: any, i: number) => {
          try {
            const title = await p.title();
            const url = p.url();
            return `[Tab ${i}] Title: "${title}", URL: ${url}`;
          } catch { 
            return `[Tab ${i}] (Unavailable)`; 
          }
        }));
        return `Open Tabs:\n${tabList.join('\n')}`;
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "cdp_read_tab",
    description: "Extract the textual content of a specific tab index.",
    schema: z.object({
      tabIndex: z.number().describe("The index of the tab to read (from cdp_list_tabs)"),
    }),
    func: async ({ tabIndex }) => {
      try {
        const browser = await getBrowser();
        const pages = await browser.pages();
        if (tabIndex < 0 || tabIndex >= pages.length) return `Error: Invalid tab index ${tabIndex}`;
        const page = pages[tabIndex];
        const text = await page.evaluate(() => document.body.innerText);
        return `Content of ${page.url()}:\n${text.substring(0, 10000)}${text.length > 10000 ? "..." : ""}`;
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "cdp_navigate",
    description: "Navigate a specific tab to a new URL, or open a new tab if tabIndex is -1.",
    schema: z.object({
      tabIndex: z.number().describe("The index of the tab to navigate, or -1 to open a new tab"),
      url: z.string().describe("The URL to navigate to"),
    }),
    func: async ({ tabIndex, url }) => {
      try {
        const browser = await getBrowser();
        let page;
        if (tabIndex === -1) {
          page = await browser.newPage();
        } else {
          const pages = await browser.pages();
          if (tabIndex < 0 || tabIndex >= pages.length) return `Error: Invalid tab index`;
          page = pages[tabIndex];
        }
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.bringToFront();
        return `Successfully navigated tab to ${url}`;
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  })
];
