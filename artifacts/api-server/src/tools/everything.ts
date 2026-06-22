import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// ─────────────────────────────────────────────────────────────────
// Helper: run a PowerShell snippet
// ─────────────────────────────────────────────────────────────────
function runPS(script: string, timeout = 30000): Promise<string> {
  return new Promise((resolve) => {
    // PowerShell expects UTF-16LE encoding for -EncodedCommand
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    child_process.exec(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { timeout },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`Error: ${(stderr || "").trim() || err.message}`);
        } else {
          resolve(stdout.trim() || "OK");
        }
      }
    );
  });
}

export async function ensureSDK(): Promise<string> {
  // Use a reliable project root relative path for the bin directory
  const binDir = path.resolve(__dirname, "../../bin");
  const dllPath = path.join(binDir, "Everything64.dll");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  if (fs.existsSync(dllPath)) {
    return dllPath;
  }

  // Download and extract Voidtools Everything SDK x64 DLL
  const zipUrl = "https://www.voidtools.com/Everything-SDK.zip";
  const zipDest = path.join(binDir, "sdk.zip");

  const psScript = `
    $ErrorActionPreference = 'Stop'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri "${zipUrl}" -OutFile "${zipDest}"
    Expand-Archive -Path "${zipDest}" -DestinationPath "${binDir}" -Force
    $srcDll = Join-Path "${binDir}" "dll/Everything64.dll"
    if (Test-Path $srcDll) {
      Move-Item -Path $srcDll -Destination "${dllPath}" -Force
    }
    Remove-Item -Path "${zipDest}" -Force
    $dllDir = Join-Path "${binDir}" "dll"
    if (Test-Path $dllDir) {
      Remove-Item -Path $dllDir -Recurse -Force
    }
  `;
  const result = await runPS(psScript);

  if (!fs.existsSync(dllPath)) {
    throw new Error(`Failed to download or extract Everything64.dll. PowerShell Output: ${result}`);
  }
  return dllPath;
}

export async function fallbackSearch(query: string, maxResults: number): Promise<string> {
  const isWindows = process.platform === "win32";
  let wildcardQuery = query;
  if (!wildcardQuery.includes("*")) {
    wildcardQuery = `*${wildcardQuery}*`;
  }

  if (isWindows) {
    // 1. Try Windows Search Indexer (ADODB query on SystemIndex) - Near instant system-wide search
    const escapedSqlLike = query.replace(/'/g, "''");
    const indexerScript = `
      $results = [System.Collections.Generic.List[string]]::new();
      try {
        $conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';");
        $conn.Open();
        # Querying both file and folder items matching the query under file: scheme
        $cmd = New-Object System.Data.OleDb.OleDbCommand("SELECT TOP ${maxResults} System.ItemPathDisplay FROM SystemIndex WHERE Scope='file:' AND (System.ItemName LIKE '%${escapedSqlLike}%' OR System.ItemNameDisplay LIKE '%${escapedSqlLike}%')", $conn);
        $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd);
        $dt = New-Object System.Data.DataTable;
        [void]$adapter.Fill($dt);
        foreach ($row in $dt.Rows) {
          $val = $row.Item(0);
          if ($val) { $results.Add($val); }
        }
        $conn.Close();
      } catch {}
      $results
    `.trim();

    const indexerOutput = await runPS(indexerScript);
    if (indexerOutput && indexerOutput !== "OK" && !indexerOutput.startsWith("Error:")) {
      return indexerOutput;
    }

    // 2. Fall back to optimized local directory search (Home directory & Workspace) skipping AppData, node_modules, etc.
    const homeDir = os.homedir().replace(/\\/g, "/");
    const workspaceDir = process.cwd().replace(/\\/g, "/");
    const walkerScript = `
      function Safe-EnumerateFiles($paths, $filter, $max) {
          $results = [System.Collections.Generic.List[string]]::new();
          $queue = [System.Collections.Generic.Queue[string]]::new();
          foreach ($p in $paths) {
              if (Test-Path $p) { $queue.Enqueue($p); }
          }
          $startTime = [System.Diagnostics.Stopwatch]::StartNew();
          while ($queue.Count -gt 0 -and $results.Count -lt $max) {
              $current = $queue.Dequeue();
              try {
                  # Enumerate matching files
                  foreach ($file in [System.IO.Directory]::EnumerateFiles($current, $filter)) {
                      if ($results.Count -lt $max) {
                          if (-not $results.Contains($file)) {
                              $results.Add($file);
                          }
                      } else {
                          break;
                      }
                  }
                  # Enumerate matching folders/directories
                  foreach ($dir in [System.IO.Directory]::EnumerateDirectories($current, $filter)) {
                      if ($results.Count -lt $max) {
                          if (-not $results.Contains($dir)) {
                              $results.Add($dir);
                          }
                      } else {
                          break;
                      }
                  }
                  # Traverse subdirectories to look deeper
                  foreach ($sub in [System.IO.Directory]::EnumerateDirectories($current)) {
                      $subName = [System.IO.Path]::GetFileName($sub);
                      if ($subName -notmatch '^(AppData|node_modules|\\.git|\\.npm|\\.cargo|\\.vscode|\\.electron|\\.gradle|\\.m2|\\.nuget|LocalStorage|Local Settings|Cookies|NetHood|PrintHood|Recent|SendTo|Start Menu|Templates|Application Data|History|My Documents)$') {
                          $queue.Enqueue($sub);
                      }
                  }
              } catch {}
              if ($startTime.ElapsedMilliseconds -gt 5000) { break; }
          }
          return $results;
      }
      $paths = @('${workspaceDir}', '${homeDir}');
      Safe-EnumerateFiles $paths '${wildcardQuery}' ${maxResults};
    `.trim();

    const walkerOutput = await runPS(walkerScript);
    if (walkerOutput && walkerOutput !== "OK" && !walkerOutput.startsWith("Error:")) {
      return walkerOutput;
    }
    return `No results found for "${query}"`;
  } else {
    // macOS / Linux fallback - Exclude hidden/dot dirs and node_modules, find both files (-type f) and folders (-type d)
    return new Promise((resolve) => {
      const homeDir = os.homedir();
      child_process.exec(
        `find "${homeDir}" -not -path '*/.*' -not -path '*/node_modules/*' -name "${wildcardQuery}" 2>/dev/null | head -n ${maxResults}`,
        (err, stdout) => {
          if (err) resolve(`Fallback search failed: ${err.message}`);
          else resolve(stdout.trim() || `No results found for "${query}"`);
        }
      );
    });
  }
}

export const everythingTools = [
  new DynamicStructuredTool({
    name: "search_everything",
    description: "Instantly search the entire Windows NTFS file system for files or folders using Voidtools Everything (or fallback recursive home directory search). Returns a list of absolute file paths.",
    schema: z.object({
      query: z.string().describe("The search query (supports wildcards like *.pdf, or simple text like 'tax receipt')"),
      maxResults: z.number().default(20).describe("Maximum number of results to return"),
    }),
    func: async ({ query, maxResults }) => {
      try {
        let dllPath;
        try {
          dllPath = await ensureSDK();
        } catch (e) {
          console.warn("Voidtools Everything SDK is not available, using fallback search:", e);
        }

        if (dllPath) {
          const escapedQuery = query.replace(/'/g, "''");
          const sdkScript = `
            $dllPath = '${dllPath.replace(/\\/g, "\\\\")}';
            $signature = @'
            using System;
            using System.Runtime.InteropServices;
            using System.Text;

            public class EverythingSDK {
                [DllImport("kernel32.dll", SetLastError = true)]
                public static extern IntPtr LoadLibrary(string lpFileName);

                [DllImport("Everything64.dll", CharSet = CharSet.Unicode)]
                public static extern void Everything_SetSearchW(string lpSearchString);

                [DllImport("Everything64.dll")]
                public static extern bool Everything_QueryW(bool bWait);

                [DllImport("Everything64.dll")]
                public static extern uint Everything_GetNumResults();

                [DllImport("Everything64.dll", CharSet = CharSet.Unicode)]
                public static extern void Everything_GetResultFullPathNameW(uint nIndex, StringBuilder lpFullPathName, uint nMaxCount);
            }
'@;
            try {
                Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue;
            } catch {}
            $null = [EverythingSDK]::LoadLibrary($dllPath);
            [EverythingSDK]::Everything_SetSearchW('${escapedQuery}');
            $success = [EverythingSDK]::Everything_QueryW($true);
            if ($success) {
                $count = [EverythingSDK]::Everything_GetNumResults();
                $results = [System.Collections.Generic.List[string]]::new();
                $max = [Math]::Min($count, ${maxResults});
                for ($i = 0; $i -lt $max; $i++) {
                    $sb = New-Object System.Text.StringBuilder 260;
                    [void][EverythingSDK]::Everything_GetResultFullPathNameW($i, $sb, 260);
                    $results.Add($sb.ToString());
                }
                $results
            }
          `.trim();

          const results = await runPS(sdkScript);
          if (results && results !== "OK" && !results.startsWith("Error:")) {
            return results;
          }
        }

        // Fallback search in user home directory if Everything fails or returns no results
        return await fallbackSearch(query, maxResults);
      } catch (err: any) {
        return `Error in search_everything: ${err.message}`;
      }
    },
  })
];
