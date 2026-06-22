import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

export const fsTools = [
  new DynamicStructuredTool({
    name: "read_file",
    description: "Read the contents of a file. Automatically parses text from PDF, Word (.docx), and Excel (.xlsx/.xls) documents based on the file extension.",
    schema: z.object({ file_path: z.string() }),
    func: async ({ file_path }) => {
      try {
        const ext = path.extname(file_path).toLowerCase();

        if (ext === ".pdf") {
          const buffer = await fs.readFile(file_path);
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = (pdfParseModule as any).default || pdfParseModule;
          const data = await pdfParse(buffer);
          return `Content of PDF file ${file_path}:\n${data.text}`;
        }

        if (ext === ".docx") {
          const buffer = await fs.readFile(file_path);
          const mammothModule = await import("mammoth");
          const mammoth = (mammothModule as any).default || mammothModule;
          const result = await mammoth.extractRawText({ buffer });
          return `Content of Word document ${file_path}:\n${result.value}`;
        }

        if (ext === ".xlsx" || ext === ".xls") {
          const buffer = await fs.readFile(file_path);
          const xlsxModule = await import("xlsx");
          const XLSX = (xlsxModule as any).default || xlsxModule;
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheets = workbook.SheetNames.map((name: string) => {
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
            return `--- Sheet: ${name} ---\n${csv}`;
          });
          return `Content of Excel file ${file_path}:\n${sheets.join("\n\n")}`;
        }

        const content = await fs.readFile(file_path, "utf-8");
        return `Content of ${file_path}:\n${content}`;
      } catch (e: any) { return `Error reading file: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "write_file",
    description: "Write content to a file, overwriting if it exists.",
    schema: z.object({ file_path: z.string(), content: z.string() }),
    func: async ({ file_path, content }) => {
      try {
        await fs.mkdir(path.dirname(file_path), { recursive: true });
        await fs.writeFile(file_path, content, "utf-8");
        return `File written successfully to ${file_path}.`;
      } catch (e: any) { return `Error writing file: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "edit_file",
    description: "Edit a file by replacing an exact piece of text with new text. If 'find' is omitted, 'content' is appended to the end of the file instead.",
    schema: z.object({
      file_path: z.string(),
      find: z.string().optional().describe("Exact text to find and replace. Omit to append 'content' to the file instead."),
      content: z.string().describe("The replacement text (when 'find' is given) or the text to append (when it isn't)."),
      replaceAll: z.boolean().optional().describe("Replace every occurrence of 'find' instead of just the first."),
    }),
    func: async ({ file_path, find, content, replaceAll }) => {
      try {
        if (!find) {
          await fs.appendFile(file_path, content, "utf-8");
          return `Appended content to ${file_path}.`;
        }
        const original = await fs.readFile(file_path, "utf-8");
        if (!original.includes(find)) {
          return `Error: could not find the exact text to replace in ${file_path}. No changes made.`;
        }
        const occurrences = original.split(find).length - 1;
        const updated = replaceAll ? original.split(find).join(content) : original.replace(find, content);
        await fs.writeFile(file_path, updated, "utf-8");
        return `Replaced ${replaceAll ? occurrences : 1} occurrence(s) of the text in ${file_path}.`;
      } catch (e: any) { return `Error editing file: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "create_directory",
    description: "Create a new directory.",
    schema: z.object({ dir_path: z.string() }),
    func: async ({ dir_path }) => {
      try {
        await fs.mkdir(dir_path, { recursive: true });
        return `Directory created successfully at ${dir_path}.`;
      } catch (e: any) { return `Error creating directory: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "delete_file",
    description: "Delete a file or directory.",
    schema: z.object({ target_path: z.string() }),
    func: async ({ target_path }) => {
      try {
        await fs.rm(target_path, { recursive: true, force: true });
        return `Deleted successfully: ${target_path}.`;
      } catch (e: any) { return `Error deleting: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "move_rename_file",
    description: "Move or rename a file or directory.",
    schema: z.object({ source_path: z.string(), destination_path: z.string() }),
    func: async ({ source_path, destination_path }) => {
      try {
        await fs.rename(source_path, destination_path);
        return `Moved/Renamed successfully from ${source_path} to ${destination_path}.`;
      } catch (e: any) { return `Error moving/renaming: ${e.message}`; }
    },
  }),
  new DynamicStructuredTool({
    name: "search_files",
    description: "Search for files and folders/directories in a directory using a regex pattern on names. Excludes common development, dependency, and system directories by default to ensure fast response times.",
    schema: z.object({
      dir_path: z.string(),
      pattern: z.string().describe("Regex or query pattern to match in the name"),
    }),
    func: async ({ dir_path, pattern }) => {
      try {
        const regex = new RegExp(pattern, 'i');
        const results: string[] = [];
        let dirsVisited = 0;
        const maxDirs = 2000;
        const maxMatches = 250;

        const EXCLUDED_DIRS = new Set([
          'node_modules', '.git', '.github', '.vscode', '.idea',
          'dist', 'build', '.next', 'out', 'temp', 'tmp',
          'venv', '.venv', 'bower_components', 'obj', 'bin'
        ]);

        async function walk(dir: string) {
          if (dirsVisited >= maxDirs || results.length >= maxMatches) return;

          let files;
          try {
            files = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return; // Ignore directories we can't read
          }

          dirsVisited++;

          for (const file of files) {
            if (results.length >= maxMatches) break;
            const res = path.resolve(dir, file.name);

            if (file.isDirectory()) {
              if (EXCLUDED_DIRS.has(file.name.toLowerCase()) || file.name.startsWith('.')) {
                continue; // Skip excluded and hidden directories
              }
              if (regex.test(file.name)) {
                results.push(res);
              }
              await walk(res);
            } else {
              if (regex.test(file.name)) {
                results.push(res);
              }
            }
          }
        }
        await walk(dir_path);

        let prefix = `Found ${results.length} files/folders matching ${pattern}`;
        if (dirsVisited >= maxDirs) {
          prefix += ` (reached maximum scan limit of ${maxDirs} directories)`;
        }
        return `${prefix}:\n${results.join('\n')}`;
      } catch (e: any) { return `Error searching files: ${e.message}`; }
    },
  })
];
