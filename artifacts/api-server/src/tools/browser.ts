import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { Browser, Page, Frame } from "puppeteer";
import * as os from "os";
import * as path from "path";

// document/window/navigator only exist inside page.evaluate()/evaluateOnNewDocument()
// callbacks, which run in the browser, not this Node process. The tsconfig "lib" has no
// "dom", so these ambient shims let TypeScript accept the identifiers in those callbacks.
declare const document: any;
declare const window: any;
declare const navigator: any;
declare const Event: any;

async function getPuppeteer() {
  const mod = await new Function('return import("puppeteer")')();
  return mod.default || mod;
}

let browserInstance: Browser | null = null;
let activePage: Page | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function preparePage(page: Page) {
  // Registered per-Page, this re-runs in every frame's document on every navigation
  // (including iframes), so the deep-query helper is always available everywhere.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // querySelector/querySelectorAll never pierce shadow DOM boundaries by design, so a
    // plain selector can't see inside a <my-widget> web component's shadow root. This walks
    // the light DOM and recurses into every *open* shadow root it finds along the way.
    // (Closed shadow roots have no JS-level escape hatch at all — that's intentional.)
    window.__jarvisDeepQuery = function (selector: string, first: boolean) {
      const results: any[] = [];
      const stack: any[] = [document];
      while (stack.length) {
        const root = stack.pop();
        const all = root.querySelectorAll("*");
        for (const el of all) {
          if (el.matches(selector)) {
            results.push(el);
            if (first) return el;
          }
          if (el.shadowRoot) stack.push(el.shadowRoot);
        }
      }
      return first ? null : results;
    };
  });
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(15000);
}

async function getBrowser(): Promise<{ browser: Browser; page: Page }> {
  if (!browserInstance || !browserInstance.connected) {
    const puppeteer = await getPuppeteer();
    browserInstance = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    activePage = await browserInstance!.newPage();
    await preparePage(activePage);

    // Auto-follow tabs/popups opened by clicks (e.g. target="_blank" links) so
    // subsequent tool calls automatically act on whatever just opened.
    browserInstance!.on("targetcreated", async (target: any) => {
      try {
        if (target.type() !== "page") return;
        const newPage = await target.page();
        if (!newPage) return;
        await preparePage(newPage);
        activePage = newPage;
        await newPage.bringToFront().catch(() => {});
      } catch {
        // best-effort tab tracking
      }
    });
  }
  if (!activePage || activePage.isClosed()) {
    const pages = await browserInstance!.pages();
    activePage = pages[pages.length - 1] || (await browserInstance!.newPage());
  }
  return { browser: browserInstance!, page: activePage };
}

// Puppeteer talks to every frame (including cross-origin ones) directly over CDP, so
// Frame.evaluate()/$()/$$eval() work the same as Page's even inside <iframe> documents
// that JS in the parent page could never reach due to the same-origin policy.
function getFrames(page: Page) {
  return page.frames().filter((f) => !f.detached);
}

async function findInFrames<T>(
  page: Page,
  fn: (frame: Frame) => Promise<T | null | undefined>,
): Promise<{ result: T; frame: Frame } | null> {
  for (const frame of getFrames(page)) {
    try {
      const result = await fn(frame);
      if (result) return { result, frame };
    } catch {
      // cross-origin frame not yet navigated, detached mid-call, etc. — skip it
    }
  }
  return null;
}

async function extractFromFrames(page: Page, selector: string, attribute: string | undefined) {
  for (const frame of getFrames(page)) {
    try {
      const values: any[] = await frame.evaluate(
        (sel: string, attr: string | undefined) => {
          const els = window.__jarvisDeepQuery(sel, false);
          return els.map((el: any) =>
            attr === "value" ? el.value : attr ? el.getAttribute(attr) : (el.innerText || el.textContent || "").trim(),
          );
        },
        selector,
        attribute,
      );
      if (values.length > 0) return values;
    } catch {
      // selector not present in this frame's context
    }
  }
  return [];
}

async function findHandleInFrames(page: Page, selector: string) {
  return findInFrames(page, async (frame) => {
    const handle = await frame.evaluateHandle((sel: string) => window.__jarvisDeepQuery(sel, true), selector);
    const el = handle.asElement();
    if (!el) {
      await handle.dispose();
      return null;
    }
    return el;
  });
}

async function findByIndex(page: Page, index: number) {
  const match = await findHandleInFrames(page, `[data-jarvis-id="${index}"]`);
  return match ? match.result : null;
}

async function findClickableByText(page: Page, text: string) {
  const match = await findInFrames(page, async (frame) => {
    const handle = await frame.evaluateHandle((searchText: string) => {
      const tags =
        'a, button, input[type="submit"], input[type="button"], [role="button"], ' +
        '[role="link"], [role="menuitem"], [role="tab"], label, summary';
      const candidates = window.__jarvisDeepQuery(tags, false);
      const lower = searchText.toLowerCase();
      const matches = candidates.filter((el: any) => {
        const t = (
          el.innerText ||
          el.textContent ||
          el.getAttribute("aria-label") ||
          el.getAttribute("value") ||
          ""
        )
          .trim()
          .toLowerCase();
        if (!t.includes(lower)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      matches.sort((a: any, b: any) => (a.textContent || "").length - (b.textContent || "").length);
      return matches[0] || null;
    }, text);
    const el = handle.asElement();
    if (!el) {
      await handle.dispose();
      return null;
    }
    return el;
  });
  return match ? match.result : null;
}

async function findInputByLabel(page: Page, text: string) {
  const match = await findInFrames(page, async (frame) => {
    const handle = await frame.evaluateHandle((searchText: string) => {
      const inputs = window.__jarvisDeepQuery('input, textarea, [contenteditable="true"]', false);
      const lower = searchText.toLowerCase();
      const matches = inputs.filter((el: any) => {
        const placeholder = el.getAttribute("placeholder") || "";
        const aria = el.getAttribute("aria-label") || "";
        const name = el.getAttribute("name") || "";
        let labelText = "";
        if (el.id) {
          // A <label for=...> for a field inside a shadow root lives in that same root,
          // not the outer document — getRootNode() resolves to whichever one actually owns it.
          const lbl = el.getRootNode().querySelector(`label[for="${el.id}"]`);
          if (lbl) labelText = lbl.textContent || "";
        }
        const haystack = `${placeholder} ${aria} ${name} ${labelText}`.toLowerCase();
        if (!haystack.includes(lower)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return matches[0] || null;
    }, text);
    const el = handle.asElement();
    if (!el) {
      await handle.dispose();
      return null;
    }
    return el;
  });
  return match ? match.result : null;
}

async function resolveTarget(
  page: Page,
  opts: { selector?: string; index?: number; matchText?: string },
  kind: "click" | "type",
) {
  const { selector, index, matchText } = opts;
  if (index !== undefined) {
    return { el: await findByIndex(page, index), via: `index ${index}` };
  }
  if (selector) {
    const match = await findHandleInFrames(page, selector);
    return { el: match ? match.result : null, via: `selector "${selector}"` };
  }
  if (matchText) {
    const el = kind === "click" ? await findClickableByText(page, matchText) : await findInputByLabel(page, matchText);
    return { el, via: `text "${matchText}"` };
  }
  return { el: null, via: "none" };
}

export const browserTools = [
  new DynamicStructuredTool({
    name: "browser_navigate",
    description:
      "Navigate the web browser to a specific URL. Set newTab to true to open it in a new tab instead of replacing the current one.",
    schema: z.object({
      url: z.string().describe("The full URL to navigate to (e.g. https://www.google.com)"),
      newTab: z.boolean().optional().describe("Open the URL in a new tab instead of the current one."),
    }),
    func: async ({ url, newTab }) => {
      try {
        const { browser, page } = await getBrowser();
        let target = page;
        if (newTab) {
          target = await browser.newPage();
          await preparePage(target);
          activePage = target;
        }
        await target.goto(url, { waitUntil: "networkidle2" });
        await target.bringToFront().catch(() => {});
        return `Successfully navigated to ${url}${newTab ? " in a new tab" : ""}.`;
      } catch (err: any) {
        return `Failed to navigate: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_observe",
    description:
      "Inspect the current web page — including embedded iframes (e.g. payment widgets, login forms) and elements " +
      "inside web components' shadow DOM — and list visible interactive elements (links, buttons, inputs, " +
      "dropdowns) numbered by index, with their label/placeholder/text. Call this whenever you don't know the " +
      "exact CSS selector for something (e.g. a site's search box) — then pass that index to browser_click, " +
      "browser_type, browser_extract, or browser_select_option. Re-run it after navigating, typing, clicking, or " +
      "scrolling, since indices can change.",
    schema: z.object({
      maxElements: z.number().optional().describe("Maximum number of elements to list (default 60)."),
    }),
    func: async ({ maxElements }) => {
      try {
        const { page } = await getBrowser();
        const max = maxElements || 60;
        const mainFrame = page.mainFrame();
        const scanFrame = (frame: Frame, startIndex: number, budget: number) =>
          frame.evaluate(
            (start: number, max: number) => {
              const selector =
                'a[href], button, input, select, textarea, [role="button"], [role="link"], ' +
                '[role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"], ' +
                '[role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"]), [onclick]';
              const nodes = window.__jarvisDeepQuery(selector, false);
              const elements: any[] = [];
              let count = 0;
              for (const el of nodes as any[]) {
                if (count >= max) break;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const visible =
                  rect.width > 0 &&
                  rect.height > 0 &&
                  style.visibility !== "hidden" &&
                  style.display !== "none" &&
                  parseFloat(style.opacity || "1") > 0;
                if (!visible) continue;

                const tag = el.tagName.toLowerCase();
                let label = "";
                if (tag === "input" || tag === "textarea") {
                  label = el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("name") || el.id || "";
                  if (el.value) label += ` (current value: "${String(el.value).substring(0, 40)}")`;
                } else {
                  label = (
                    el.innerText ||
                    el.textContent ||
                    el.getAttribute("aria-label") ||
                    el.getAttribute("title") ||
                    el.getAttribute("alt") ||
                    ""
                  )
                    .trim()
                    .replace(/\s+/g, " ")
                    .substring(0, 100);
                }

                const globalIndex = start + count;
                el.setAttribute("data-jarvis-id", String(globalIndex));
                const rootNode = el.getRootNode();
                elements.push({
                  index: globalIndex,
                  tag,
                  type: el.getAttribute("type") || el.getAttribute("role") || "",
                  label: label || "(no label)",
                  href: tag === "a" ? el.getAttribute("href") : undefined,
                  inViewport: rect.top < window.innerHeight && rect.bottom > 0,
                  inShadowDom: !!(rootNode && rootNode.host),
                });
                count++;
              }
              return {
                elements,
                totalFound: nodes.length,
                url: document.location.href,
                title: document.title,
                scrollY: window.scrollY,
                scrollHeight: document.body.scrollHeight,
                viewportHeight: window.innerHeight,
              };
            },
            startIndex,
            budget,
          );

        let globalIndex = 0;
        let shownCount = 0;
        let unreachedTotal = 0;
        let unreachableFrames = 0;
        const allLines: string[] = [];
        let pageTitle = "";
        let pageUrl = "";
        let scrollLine = "";

        for (const frame of getFrames(page)) {
          if (globalIndex >= max) break;
          let data;
          try {
            data = await scanFrame(frame, globalIndex, max - globalIndex);
          } catch {
            unreachableFrames++;
            continue;
          }
          if (frame === mainFrame) {
            pageTitle = data.title;
            pageUrl = data.url;
            scrollLine = `Scroll position: ${data.scrollY}/${Math.max(0, data.scrollHeight - data.viewportHeight)}`;
          }
          const frameNote = frame === mainFrame ? "" : ` (in iframe: ${frame.url() || "embedded"})`;
          for (const e of data.elements) {
            const shadowNote = e.inShadowDom ? " (in shadow DOM)" : "";
            allLines.push(
              `[${e.index}] <${e.tag}${e.type ? ` ${e.type}` : ""}>${e.inViewport ? "" : " (below fold)"} - ${e.label}${e.href ? ` -> ${e.href}` : ""}${frameNote}${shadowNote}`,
            );
          }
          shownCount += data.elements.length;
          globalIndex += data.elements.length;
          unreachedTotal += Math.max(0, data.totalFound - data.elements.length);
        }

        const more = unreachedTotal > 0
          ? `\n...and ${unreachedTotal} more not shown. Use browser_scroll then browser_observe again to see them.`
          : "";
        const frameNote = unreachableFrames > 0
          ? `\n(${unreachableFrames} embedded frame(s) could not be inspected — likely still loading or cross-origin restricted.)`
          : "";

        return (
          `Page: "${pageTitle}" (${pageUrl})\n` +
          `${scrollLine}\n\n` +
          `${allLines.join("\n") || "(no interactive elements found)"}${more}${frameNote}`
        );
      } catch (err: any) {
        return `Failed to observe page: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_click",
    description:
      "Click an element on the current page. Provide exactly one of: index (from browser_observe — most reliable), " +
      'selector (CSS selector), or text (visible text/label to search for, e.g. "Add to Cart"). If the click opens ' +
      "a new tab, that tab automatically becomes the active one.",
    schema: z.object({
      index: z.number().optional().describe("Element index from browser_observe."),
      selector: z.string().optional().describe("CSS selector of the element to click."),
      text: z.string().optional().describe("Visible text of the element to click, e.g. 'Add to Cart' or 'Sign in'."),
    }),
    func: async ({ index, selector, text }) => {
      try {
        if (index === undefined && !selector && !text) {
          return "Error: provide one of index, selector, or text.";
        }
        const { browser, page } = await getBrowser();
        const { el, via } = await resolveTarget(page, { selector, index, matchText: text }, "click");
        if (!el) {
          return `Failed to click: no element found via ${via}. Try browser_observe to find the right index.`;
        }
        const pagesBefore = (await browser.pages()).length;
        await el.evaluate((node: any) => node.scrollIntoView({ block: "center" })).catch(() => {});
        await el.click();
        await delay(800);
        const pagesAfter = (await browser.pages()).length;
        const tabNote = pagesAfter > pagesBefore ? " A new tab opened and is now active." : "";
        return `Successfully clicked element (via ${via}).${tabNote}`;
      } catch (err: any) {
        return `Failed to click: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_type",
    description:
      "Type text into an input field, textarea, or contenteditable element. Provide exactly one of: index (from " +
      "browser_observe), selector (CSS selector), or field (matches the target's placeholder, label, or name — " +
      "e.g. 'Search'). Set pressEnter to true to submit after typing, or clear to true to wipe existing content first.",
    schema: z.object({
      index: z.number().optional().describe("Element index from browser_observe."),
      selector: z.string().optional().describe("CSS selector of the input field."),
      field: z.string().optional().describe("Label/placeholder/name identifying the field, e.g. 'Search'."),
      value: z.string().describe("The text to type into the field."),
      pressEnter: z.boolean().optional().describe("Whether to press Enter after typing."),
      clear: z.boolean().optional().describe("Whether to clear the field's existing content first."),
    }),
    func: async ({ index, selector, field, value, pressEnter, clear }) => {
      try {
        if (index === undefined && !selector && !field) {
          return "Error: provide one of index, selector, or field.";
        }
        const { page } = await getBrowser();
        const { el, via } = await resolveTarget(page, { selector, index, matchText: field }, "type");
        if (!el) {
          return `Failed to type: no input field found via ${via}. Try browser_observe to find the right index.`;
        }
        await el.evaluate((node: any) => node.scrollIntoView({ block: "center" })).catch(() => {});
        await el.click();
        if (clear) {
          await el.evaluate((node: any) => {
            if ("value" in node) node.value = "";
            else node.textContent = "";
          });
        }
        await el.type(value, { delay: 40 });
        if (pressEnter) {
          await page.keyboard.press("Enter");
          await delay(1500);
        }
        return `Successfully typed "${value}" into the field (via ${via}).${pressEnter ? " Pressed Enter." : ""}`;
      } catch (err: any) {
        return `Failed to type: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_extract",
    description:
      "Extract text (or an HTML attribute) from the current page. Provide index to read a single element found " +
      "via browser_observe, selector to extract from every matching element, or neither to get the visible text " +
      "of the whole page.",
    schema: z.object({
      index: z.number().optional().describe("Element index from browser_observe to extract from."),
      selector: z.string().optional().describe("CSS selector of the elements to extract from."),
      attribute: z.string().optional().describe("HTML attribute to read instead of text, e.g. 'href' or 'src'."),
      limit: z.number().optional().describe("Maximum number of results to return (default 15)."),
    }),
    func: async ({ index, selector, attribute, limit }) => {
      try {
        const { page } = await getBrowser();
        const max = limit || 15;

        if (index !== undefined) {
          const el = await findByIndex(page, index);
          if (!el) return `Error: no element with index ${index}. Run browser_observe again.`;
          const value = attribute
            ? await el.evaluate((node: any, attr: string) => (attr === "value" ? node.value : node.getAttribute(attr)), attribute)
            : await el.evaluate((node: any) => (node.innerText || node.textContent || "").trim());
          return value ? `Extracted: ${value}` : "Element found but has no content/attribute value.";
        }

        if (selector) {
          const values = await extractFromFrames(page, selector, attribute);
          const filtered = values.filter((v) => v !== null && v !== "");
          if (filtered.length === 0) return `No elements found matching ${selector}`;
          return `Extracted ${filtered.length} elements. First ${Math.min(max, filtered.length)} results:\n${filtered.slice(0, max).join("\n")}`;
        }

        const sections: string[] = [];
        for (const frame of getFrames(page)) {
          try {
            const text: string = await frame.evaluate(() => document.body.innerText);
            if (text && text.trim()) {
              sections.push(frame === page.mainFrame() ? text.trim() : `[iframe: ${frame.url()}]\n${text.trim()}`);
            }
          } catch {
            // cross-origin/unreachable frame — skip
          }
        }
        const bodyText = sections.join("\n\n");
        return bodyText.substring(0, 4000) + (bodyText.length > 4000 ? "\n...(truncated)" : "");
      } catch (err: any) {
        return `Failed to extract: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_scroll",
    description:
      "Scroll the current page up, down, to the top, to the bottom, or bring a specific browser_observe index into view.",
    schema: z.object({
      direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Direction to scroll. Ignored if index is provided."),
      amount: z.number().optional().describe("Pixels to scroll (default ~800)."),
      index: z.number().optional().describe("Element index from browser_observe to scroll into view instead."),
    }),
    func: async ({ direction, amount, index }) => {
      try {
        const { page } = await getBrowser();
        if (index !== undefined) {
          const el = await findByIndex(page, index);
          if (!el) return `Error: no element with index ${index}. Run browser_observe again.`;
          await el.evaluate((node: any) => node.scrollIntoView({ block: "center" }));
          return `Scrolled element [${index}] into view.`;
        }
        const px = amount || 800;
        await page.evaluate(
          (dir: string, amt: number) => {
            if (dir === "top") window.scrollTo(0, 0);
            else if (dir === "bottom") window.scrollTo(0, document.body.scrollHeight);
            else if (dir === "up") window.scrollBy(0, -amt);
            else window.scrollBy(0, amt);
          },
          direction || "down",
          px,
        );
        await delay(300);
        return `Scrolled ${direction || "down"}${index === undefined ? ` by ${px}px` : ""}.`;
      } catch (err: any) {
        return `Failed to scroll: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_press_key",
    description:
      "Press a single keyboard key on the current page, e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown', 'PageDown'. " +
      "Useful for closing modals, navigating dropdowns/suggestions, or submitting forms without a known selector.",
    schema: z.object({
      key: z.string().describe("Key name, e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown', 'PageDown'."),
    }),
    func: async ({ key }) => {
      try {
        const { page } = await getBrowser();
        await page.keyboard.press(key as any);
        await delay(300);
        return `Pressed key: ${key}`;
      } catch (err: any) {
        return `Failed to press key: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_wait",
    description:
      "Wait for something to happen on the page before continuing — useful for dynamic sites where content loads " +
      "after a delay. type='selector': wait for a CSS selector to appear (use value). type='text': wait for the " +
      "page text to contain a string (use value). type='navigation': wait for the page to finish navigating. " +
      "type='timeout': just wait timeoutMs milliseconds.",
    schema: z.object({
      type: z.enum(["selector", "text", "navigation", "timeout"]),
      value: z.string().optional().describe("CSS selector or text to wait for (required for type='selector'/'text')."),
      timeoutMs: z.number().optional().describe("Timeout in milliseconds (default 10000)."),
    }),
    func: async ({ type, value, timeoutMs }) => {
      try {
        const { page } = await getBrowser();
        const timeout = timeoutMs || 10000;
        if (type === "selector") {
          if (!value) return "Error: value (selector) is required for type='selector'.";
          await page.waitForSelector(value, { timeout });
          return `Selector "${value}" appeared.`;
        }
        if (type === "navigation") {
          await page.waitForNavigation({ timeout, waitUntil: "networkidle2" });
          return `Navigation complete. Now at ${page.url()}`;
        }
        if (type === "text") {
          if (!value) return "Error: value (text) is required for type='text'.";
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const found: boolean = await page.evaluate((needle: string) => document.body.innerText.includes(needle), value);
            if (found) return `Found text "${value}" on the page.`;
            await delay(500);
          }
          return `Timed out waiting for text "${value}".`;
        }
        await delay(timeout);
        return `Waited ${timeout}ms.`;
      } catch (err: any) {
        return `Wait failed: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_select_option",
    description:
      "Select an option in a <select> dropdown. Provide index (from browser_observe) or selector to identify the " +
      "dropdown, and either value (the option's value attribute) or label (the option's visible text).",
    schema: z.object({
      index: z.number().optional().describe("Element index from browser_observe."),
      selector: z.string().optional().describe("CSS selector of the <select> element."),
      value: z.string().optional().describe("The option's value attribute to select."),
      label: z.string().optional().describe("The option's visible text to select (used if value is not provided)."),
    }),
    func: async ({ index, selector, value, label }) => {
      try {
        const cssSelector = index !== undefined ? `[data-jarvis-id="${index}"]` : selector;
        if (!cssSelector) return "Error: provide either index or selector.";
        const { page } = await getBrowser();
        const match = await findHandleInFrames(page, cssSelector);
        if (!match) return `Error: no <select> element found via ${index !== undefined ? `index ${index}` : `selector "${selector}"`}.`;
        const { result: el } = match;

        let optionValue = value;
        if (!optionValue && label) {
          optionValue = await el.evaluate((node: any, text: string) => {
            const opt = Array.from(node.options as any[]).find(
              (o: any) => o.textContent.trim().toLowerCase() === text.trim().toLowerCase(),
            );
            return opt ? (opt as any).value : null;
          }, label);
          if (!optionValue) return `Error: no option with label "${label}" found.`;
        }
        if (!optionValue) return "Error: provide either value or label.";

        // Set directly on the resolved handle (rather than Frame.select, which re-queries via
        // a plain selector and would miss an element living inside a shadow root) and fire the
        // same events frameworks listen for to pick up the change.
        await el.evaluate((node: any, val: string) => {
          node.value = val;
          node.dispatchEvent(new Event("input", { bubbles: true }));
          node.dispatchEvent(new Event("change", { bubbles: true }));
        }, optionValue);
        return `Selected option "${value || label}" in the dropdown.`;
      } catch (err: any) {
        return `Failed to select option: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_screenshot",
    description:
      "Take a screenshot of the current page (what the agent's browser session currently looks like) and save it " +
      "to a file. Combine with describe_image to visually inspect content that's hard to parse from the DOM " +
      "(e.g. canvas content or a CAPTCHA).",
    schema: z.object({
      fullPage: z.boolean().optional().describe("Capture the full scrollable page instead of just the viewport."),
      save_path: z.string().optional().describe("Where to save the screenshot. Defaults to a temp file."),
    }),
    func: async ({ fullPage, save_path }) => {
      try {
        const { page } = await getBrowser();
        const outPath = save_path || path.join(os.tmpdir(), `jarvis_browser_${Date.now()}.png`);
        await page.screenshot({ path: outPath, fullPage: !!fullPage });
        return `Screenshot saved to: ${outPath}`;
      } catch (err: any) {
        return `Failed to capture screenshot: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_history",
    description: "Go back, go forward, or reload the current page in the browser's history.",
    schema: z.object({
      action: z.enum(["back", "forward", "reload"]),
    }),
    func: async ({ action }) => {
      try {
        const { page } = await getBrowser();
        if (action === "back") await page.goBack({ waitUntil: "networkidle2" });
        else if (action === "forward") await page.goForward({ waitUntil: "networkidle2" });
        else await page.reload({ waitUntil: "networkidle2" });
        return `${action} successful. Now at ${page.url()}`;
      } catch (err: any) {
        return `Failed to ${action}: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_tabs",
    description:
      "List, switch to, or close tabs in the agent's browser session. Use action='list' to see open tabs, " +
      "action='switch' with an index to make that tab active, or action='close' with an index to close it.",
    schema: z.object({
      action: z.enum(["list", "switch", "close"]),
      index: z.number().optional().describe("Tab index (from action='list') — required for switch/close."),
    }),
    func: async ({ action, index }) => {
      try {
        const { browser, page } = await getBrowser();
        const pages = await browser.pages();

        if (action === "list") {
          const list = await Promise.all(
            pages.map(async (p, i) => {
              const active = p === page ? " (active)" : "";
              try {
                return `[${i}] "${await p.title()}" - ${p.url()}${active}`;
              } catch {
                return `[${i}] (unavailable)${active}`;
              }
            }),
          );
          return `Open tabs:\n${list.join("\n")}`;
        }

        if (index === undefined || index < 0 || index >= pages.length) {
          return "Error: invalid tab index. Use action='list' first.";
        }

        if (action === "switch") {
          activePage = pages[index];
          await activePage.bringToFront();
          return `Switched to tab [${index}]: ${activePage.url()}`;
        }

        // close
        const wasActive = pages[index] === page;
        await pages[index].close();
        if (wasActive) {
          const remaining = await browser.pages();
          activePage = remaining[remaining.length - 1] || null;
        }
        return `Closed tab [${index}].`;
      } catch (err: any) {
        return `Failed to ${action} tab: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "browser_close",
    description: "Close the entire browser session (all tabs).",
    schema: z.object({}),
    func: async () => {
      try {
        if (browserInstance) {
          await browserInstance.close();
          browserInstance = null;
          activePage = null;
          return "Browser successfully closed.";
        }
        return "No browser session was open.";
      } catch (err: any) {
        return `Failed to close browser: ${err.message}`;
      }
    },
  }),
];
