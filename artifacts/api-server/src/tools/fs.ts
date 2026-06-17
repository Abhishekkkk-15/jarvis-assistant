import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// @ts-ignore
import * as pdf from "pdf-parse";

export const fsTools = [
  new DynamicStructuredTool({
    name: "read_file",
    description: "Read the contents of a file. Automatically parses text from PDF documents if the file ends with .pdf.",
    schema: z.object({ file_path: z.string() }),
    func: async ({ file_path }) => {
      try {
        if (file_path.toLowerCase().endsWith(".pdf")) {
          const buffer = await fs.readFile(file_path);
          // @ts-ignore
          const parsePdf = pdf.default || pdf;
          const data = await parsePdf(buffer);
          return `Content of PDF file ${file_path}:\n${data.text}`;
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
    description: "Append content to a file.",
    schema: z.object({ file_path: z.string(), content: z.string() }),
    func: async ({ file_path, content }) => {
      try {
        await fs.appendFile(file_path, content, "utf-8");
        return `File edited successfully at ${file_path}.`;
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
    description: "Search for files in a directory using a regex pattern on filenames.",
    schema: z.object({ dir_path: z.string(), pattern: z.string() }),
    func: async ({ dir_path, pattern }) => {
      try {
        const regex = new RegExp(pattern, 'i');
        const results: string[] = [];
        
        async function walk(dir: string) {
          const files = await fs.readdir(dir, { withFileTypes: true });
          for (const file of files) {
            const res = path.resolve(dir, file.name);
            if (file.isDirectory()) {
              await walk(res);
            } else {
              if (regex.test(file.name)) results.push(res);
            }
          }
        }
        await walk(dir_path);
        return `Found ${results.length} files matching ${pattern}:\n${results.join('\n')}`;
      } catch (e: any) { return `Error searching files: ${e.message}`; }
    },
  })
];
