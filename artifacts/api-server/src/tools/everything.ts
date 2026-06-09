import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";

// ─────────────────────────────────────────────────────────────────
// Helper: run a PowerShell snippet
// ─────────────────────────────────────────────────────────────────
function runPS(script: string, timeout = 30000): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
      { timeout },
      (err, stdout, stderr) => {
        if (err) resolve(`Error: ${stderr || err.message}`);
        else resolve(stdout.trim() || "OK");
      }
    );
  });
}

async function ensureES(): Promise<string> {
  // Use a reliable project root relative path for the bin directory
  const binDir = path.resolve(__dirname, "../../bin");
  const esPath = path.join(binDir, "es.exe");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  
  if (fs.existsSync(esPath)) {
    return esPath;
  }

  // Download and extract Voidtools Everything CLI (es.exe) x64
  // We use the x64 version of ES since almost all modern Windows are x64
  const zipUrl = "https://www.voidtools.com/ES-1.1.0.28.x64.zip";
  const zipDest = path.join(binDir, "es.zip");
  
  const psScript = `
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "${zipUrl}" -OutFile "${zipDest}"
    Expand-Archive -Path "${zipDest}" -DestinationPath "${binDir}" -Force
    Remove-Item -Path "${zipDest}" -Force
  `;
  await runPS(psScript);
  
  if (!fs.existsSync(esPath)) {
    throw new Error("Failed to download or extract es.exe");
  }
  return esPath;
}

export const everythingTools = [
  new DynamicStructuredTool({
    name: "search_everything",
    description: "Instantly search the entire Windows NTFS file system for files or folders using Voidtools Everything. Returns a list of absolute file paths.",
    schema: z.object({
      query: z.string().describe("The search query (supports wildcards like *.pdf, or simple text like 'tax receipt')"),
      maxResults: z.number().default(20).describe("Maximum number of results to return"),
    }),
    func: async ({ query, maxResults }) => {
      try {
        const esPath = await ensureES();
        
        return new Promise((resolve) => {
            // Using maxResults to limit the output to avoid overwhelming the context
            const escapedQuery = query.replace(/"/g, '\\"');
            child_process.exec(`"${esPath}" -max-results ${maxResults} "${escapedQuery}"`, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
                // es.exe exits with code > 0 if nothing found or if error
                if (err && stdout.trim() === "") {
                    resolve(`Everything Search returned no results or an error: ${stderr || err.message}`);
                } else {
                    const results = stdout.trim();
                    if (!results) resolve(`No results found for "${query}"`);
                    else resolve(results);
                }
            });
        });
      } catch (err: any) {
        return `Error in search_everything: ${err.message}`;
      }
    },
  })
];
