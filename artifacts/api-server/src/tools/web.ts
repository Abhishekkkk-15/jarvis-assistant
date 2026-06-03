import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import puppeteer from "puppeteer";
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { YoutubeTranscript } from "youtube-transcript";
import Parser from "rss-parser";

export const webTools = [
  new DynamicStructuredTool({
    name: "web_browser_page_reader",
    description: "Read the text content of a webpage.",
    schema: z.object({ url: z.string() }),
    func: async ({ url }) => {
      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        // @ts-expect-error: document is evaluated in the browser context, not in Node
        const text = await page.evaluate(() => document.body.innerText);
        await browser.close();
        return text.substring(0, 8000); // Limit output length
      } catch (e: any) { return `Error reading webpage: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "website_screenshot_capture",
    description: "Capture a screenshot of a website. Returns base64 or saves to a path.",
    schema: z.object({ url: z.string(), path: z.string().optional() }),
    func: async ({ url, path }) => {
      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        const screenshot = await page.screenshot({ path, encoding: path ? 'binary' : 'base64' });
        await browser.close();
        return path ? `Screenshot saved to ${path}` : `Base64 string created (length: ${screenshot.length})`;
      } catch (e: any) { return `Error capturing screenshot: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "pdf_reader",
    description: "Read text from a local PDF file.",
    schema: z.object({ file_path: z.string() }),
    func: async ({ file_path }) => {
      try {
        const dataBuffer = await fs.readFile(file_path);
        const data = await pdfParse(dataBuffer);
        return data.text.substring(0, 8000);
      } catch (e: any) { return `Error reading PDF: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "youtube_transcript_extractor",
    description: "Extract transcript from a YouTube video URL.",
    schema: z.object({ url: z.string() }),
    func: async ({ url }) => {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        const text = transcript.map(t => t.text).join(' ');
        return text.substring(0, 8000);
      } catch (e: any) { return `Error extracting transcript: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "rss_feed_reader",
    description: "Read latest items from an RSS feed URL.",
    schema: z.object({ url: z.string() }),
    func: async ({ url }) => {
      try {
        const parser = new Parser();
        const feed = await parser.parseURL(url);
        return feed.items.map((i: any) => `${i.title} - ${i.link}`).join('\n');
      } catch (e: any) { return `Error reading RSS: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "news_search",
    description: "Search for latest news using a web query (simulated/basic).",
    schema: z.object({ query: z.string() }),
    func: async ({ query }) => {
      // In a full implementation, you'd call a news API like NewsAPI or Serper
      return `[Mock] Found 3 news articles for: ${query}. (1) Example News 1 (2) Example News 2`;
    },
  })
];
