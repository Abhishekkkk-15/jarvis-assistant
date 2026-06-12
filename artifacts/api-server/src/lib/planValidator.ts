// security.ts
export enum RiskLevel {
  NONE = "none",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface SecurityRule {
  match: (toolName: string, args: any) => boolean;
  risk: RiskLevel;
  reason: string;
}

export const securityRules: SecurityRule[] = [
  // Command execution
  {
    match: (tool, args) =>
      ["execute_bash", "execute_powershell", "execute_cmd", "run_command"].includes(tool) &&
      /(rm\s+-rf|del\s+\/f|Format-Volume|Remove-Item\s+-Recurse)/i.test(args?.command || ""),
    risk: RiskLevel.CRITICAL,
    reason: "Destructive command that deletes files or formats drives",
  },
  {
    match: (tool, args) =>
      ["execute_bash", "execute_powershell", "execute_cmd", "run_command"].includes(tool) &&
      /(sudo\s+|runas\s+|Start-Process.*-Verb\s+RunAs)/i.test(args?.command || ""),
    risk: RiskLevel.HIGH,
    reason: "Command requires elevated privileges",
  },
  {
    match: (tool, args) =>
      ["execute_bash", "execute_powershell", "execute_cmd", "run_command"].includes(tool),
    risk: RiskLevel.MEDIUM,
    reason: "Arbitrary command execution",
  },

  // File system modifications
  {
    match: (tool, args) =>
      ["write_file", "edit_file"].includes(tool) &&
      (args?.file_path?.toLowerCase().startsWith("c:\\windows") || args?.path?.startsWith("/etc/") || args?.path?.startsWith("/sys/")),
    risk: RiskLevel.CRITICAL,
    reason: "Writing to system directory",
  },
  {
    match: (tool, args) =>
      ["delete_file", "remove_directory"].includes(tool),
    risk: RiskLevel.HIGH,
    reason: "Destructive file operation",
  },
  {
    match: (tool, args) => ["write_file", "edit_file", "create_directory", "move_rename_file"].includes(tool),
    risk: RiskLevel.LOW,
    reason: "Modifies file system",
  },

  // System control
  {
    match: (tool, args) => tool === "registry_control",
    risk: RiskLevel.CRITICAL,
    reason: "Modifies Windows Registry",
  },
  {
    match: (tool, args) => tool === "power_management",
    risk: RiskLevel.HIGH,
    reason: "System power state modification",
  },
  {
    match: (tool, args) => tool === "process_management" && args?.action === "kill",
    risk: RiskLevel.HIGH,
    reason: "Killing system processes",
  },

  // UI/Input Automation
  {
    match: (tool, args) => ["mouse_control", "keyboard_control", "uia_click_element", "uia_set_text"].includes(tool),
    risk: RiskLevel.LOW,
    reason: "Automated UI interaction",
  },

  // Network
  {
    match: (tool, args) => tool === "http_request" && args?.method !== "GET",
    risk: RiskLevel.MEDIUM,
    reason: "Non‑GET HTTP request (may modify remote data)",
  },
  {
    match: (tool, args) => tool === "send_email",
    risk: RiskLevel.HIGH,
    reason: "Sending email on behalf of user",
  },
];

export function assessRisk(
  toolName: string,
  args: any,
): { risk: RiskLevel; reason: string } {
  for (const rule of securityRules) {
    if (rule.match(toolName, args)) {
      return { risk: rule.risk, reason: rule.reason };
    }
  }
  const safeTools = [
    "listTools",
    "askQuestion",
    "requestApproval",
    "notify_user",
    "read_file",
    "get_weather",
    "calculate",
    "search_web",
    "news_search",
    "search_everything",
    "get_cursor_position",
    "get_current_datetime",
    "list_memories",
    "search_local_files",
    "notion_search",
    "notion_read_page",
    "github_search_repositories",
    "github_read_file",
    "github_list_issues",
    "web_browser_page_reader",
    "youtube_transcript_extractor",
    "rss_feed_reader",
    "list_scheduled_tasks",
    "media_control",
    "display_brightness",
    "website_screenshot_capture",
    "read_recent_emails"
  ];
  if (safeTools.includes(toolName)) {
    return { risk: RiskLevel.NONE, reason: "" };
  }
  return {
    risk: RiskLevel.LOW,
    reason: "Unreviewed tool – may require approval",
  };
}

export function fuzzyMatchTool(
  input: string,
  candidates: string[],
): string | null {
  const lowerInput = input.toLowerCase();
  const exact = candidates.find((c) => c.toLowerCase() === lowerInput);
  if (exact) return exact;

  const contains = candidates.find(
    (c) =>
      c.toLowerCase().includes(lowerInput) ||
      lowerInput.includes(c.toLowerCase()),
  );
  if (contains) return contains;

  return null;
}
