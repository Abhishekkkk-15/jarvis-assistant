import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { Browser, Page } from "puppeteer";

async function getPuppeteer() {
  const mod = await new Function('return import("puppeteer")')();
  return mod.default || mod;
}

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

async function getBrowser() {
  if (!globalBrowser) {
    const puppeteer = await getPuppeteer();
    globalBrowser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    globalPage = await globalBrowser.newPage();
  }
  return { browser: globalBrowser, page: globalPage! };
}

export const browserTools = [
  new DynamicStructuredTool({
    name: "browser_navigate",
    description: "Navigate the web browser to a specific URL.",
    schema: z.object({
      url: z.string().describe("The full URL to navigate to (e.g. https://www.google.com)"),
    }),
    func: async ({ url }) => {
      try {
        const { page } = await getBrowser();
        await page.goto(url, { waitUntil: "networkidle2" });
        return `Successfully navigated to ${url}`;
      } catch (err: any) {
        return `Failed to navigate: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "browser_click",
    description: "Click an element on the current web page using a CSS selector or text.",
    schema: z.object({
      selector: z.string().describe("CSS selector of the element to click"),
    }),
    func: async ({ selector }) => {
      try {
        const { page } = await getBrowser();
        await page.click(selector);
        // Wait a bit for navigation or JS execution
        await new Promise(resolve => setTimeout(resolve, 1500));
        return `Successfully clicked element matching ${selector}`;
      } catch (err: any) {
        return `Failed to click ${selector}: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "browser_type",
    description: "Type text into an input field on the current web page.",
    schema: z.object({
      selector: z.string().describe("CSS selector of the input field"),
      text: z.string().describe("The text to type"),
      pressEnter: z.boolean().optional().describe("Whether to press Enter after typing"),
    }),
    func: async ({ selector, text, pressEnter }) => {
      try {
        const { page } = await getBrowser();
        await page.type(selector, text, { delay: 50 });
        if (pressEnter) {
          await page.keyboard.press("Enter");
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        return `Successfully typed "${text}" into ${selector}`;
      } catch (err: any) {
        return `Failed to type: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "browser_extract",
    description: "Extract the inner text from elements on the page matching a CSS selector.",
    schema: z.object({
      selector: z.string().describe("CSS selector of the elements to extract text from"),
    }),
    func: async ({ selector }) => {
      try {
        const { page } = await getBrowser();
        const texts = await page.$$eval(selector, (elements) => elements.map(el => el.textContent?.trim() || ""));
        if (texts.length === 0) return `No elements found matching ${selector}`;
        return `Extracted ${texts.length} elements. First few results: \n${texts.slice(0, 10).join('\n')}`;
      } catch (err: any) {
        return `Failed to extract: ${err.message}`;
      }
    },
  }),
  new DynamicStructuredTool({
    name: "browser_close",
    description: "Close the web browser session.",
    schema: z.object({}),
    func: async () => {
      try {
        if (globalBrowser) {
          await globalBrowser.close();
          globalBrowser = null;
          globalPage = null;
          return "Browser successfully closed.";
        }
        return "No browser session was open.";
      } catch (err: any) {
        return `Failed to close browser: ${err.message}`;
      }
    },
  }),
];
