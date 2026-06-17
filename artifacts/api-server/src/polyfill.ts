// Polyfill for DOMMatrix in Node.js environment to prevent pdfjs-dist / pdf-parse from crashing
// @ts-ignore
globalThis.DOMMatrix = globalThis.DOMMatrix || class DOMMatrix {};
