import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db, settingsTable } from "@workspace/db";
import { Octokit } from "octokit";

async function getOctokit() {
  const rows = await db.select().from(settingsTable).limit(1);
  const settings = rows[0] ?? null;
  if (!settings || !settings.githubPat) {
    throw new Error("GitHub PAT is not configured. Please add it in Settings.");
  }
  return new Octokit({ auth: settings.githubPat });
}

export const githubTools = [
  new DynamicStructuredTool({
    name: "github_search_repositories",
    description: "Search for GitHub repositories using a query.",
    schema: z.object({
      query: z.string().describe("Search query (e.g., 'tetris language:assembly')"),
      limit: z.number().optional().describe("Number of results to return (default: 5)"),
    }),
    func: async ({ query, limit = 5 }) => {
      try {
        const octokit = await getOctokit();
        const response = await octokit.rest.search.repos({
          q: query,
          per_page: limit,
        });
        
        return JSON.stringify(
          response.data.items.map((repo: any) => ({
            name: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            stars: repo.stargazers_count,
          })),
          null,
          2
        );
      } catch (err: any) {
        return `Failed to search GitHub repositories: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "github_read_file",
    description: "Read the contents of a file from a GitHub repository.",
    schema: z.object({
      owner: z.string().describe("The account owner of the repository."),
      repo: z.string().describe("The name of the repository."),
      path: z.string().describe("The file path inside the repository."),
      ref: z.string().optional().describe("The name of the commit/branch/tag. Default: the repository's default branch."),
    }),
    func: async ({ owner, repo, path, ref }) => {
      try {
        const octokit = await getOctokit();
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });

        const data: any = response.data;
        if (data.type === "file" && data.encoding === "base64") {
          const decoded = Buffer.from(data.content, "base64").toString("utf8");
          return decoded;
        } else {
          return `Path is not a valid text file or is a directory. Type: ${data.type}`;
        }
      } catch (err: any) {
        return `Failed to read file from GitHub: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "github_list_issues",
    description: "List open issues for a specific GitHub repository.",
    schema: z.object({
      owner: z.string().describe("The account owner of the repository."),
      repo: z.string().describe("The name of the repository."),
      state: z.enum(["open", "closed", "all"]).optional().describe("State of the issues to return. Default: 'open'."),
      limit: z.number().optional().describe("Number of issues to return (default: 10)"),
    }),
    func: async ({ owner, repo, state = "open", limit = 10 }) => {
      try {
        const octokit = await getOctokit();
        const response = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: limit,
        });

        return JSON.stringify(
          response.data.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            author: issue.user?.login,
          })),
          null,
          2
        );
      } catch (err: any) {
        return `Failed to list issues from GitHub: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "github_create_pull_request",
    description: "Create a new pull request in a GitHub repository.",
    schema: z.object({
      owner: z.string().describe("The account owner of the repository."),
      repo: z.string().describe("The name of the repository."),
      title: z.string().describe("The title of the pull request."),
      head: z.string().describe("The name of the branch where your changes are implemented (e.g. 'feature/foo', or 'username:feature/foo' for a fork)."),
      base: z.string().describe("The name of the branch you want the changes pulled into (e.g. 'main')."),
      body: z.string().optional().describe("The body/description of the pull request."),
    }),
    func: async ({ owner, repo, title, head, base, body }) => {
      try {
        const octokit = await getOctokit();
        const response = await octokit.rest.pulls.create({ owner, repo, title, head, base, body });
        return `Successfully created pull request #${response.data.number}: ${response.data.html_url}`;
      } catch (err: any) {
        return `Failed to create pull request on GitHub: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "github_create_issue",
    description: "Create a new issue in a specific GitHub repository.",
    schema: z.object({
      owner: z.string().describe("The account owner of the repository."),
      repo: z.string().describe("The name of the repository."),
      title: z.string().describe("The title of the issue."),
      body: z.string().optional().describe("The body/description of the issue."),
    }),
    func: async ({ owner, repo, title, body }) => {
      try {
        const octokit = await getOctokit();
        const response = await octokit.rest.issues.create({
          owner,
          repo,
          title,
          body,
        });

        return `Successfully created issue #${response.data.number}: ${response.data.html_url}`;
      } catch (err: any) {
        return `Failed to create issue on GitHub: ${err.message}`;
      }
    },
  }),
];
