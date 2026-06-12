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
  {
    match: (tool, args) =>
      tool === "execute_command" && /rm\s+-rf\s+\//.test(args?.command || ""),
    risk: RiskLevel.CRITICAL,
    reason: "Recursive force delete of root directory",
  },
  {
    match: (tool, args) =>
      tool === "execute_command" && /sudo\s+/.test(args?.command || ""),
    risk: RiskLevel.HIGH,
    reason: "Command requires elevated privileges",
  },
  {
    match: (tool, args) =>
      tool === "write_file" &&
      (args?.path?.startsWith("/etc/") || args?.path?.startsWith("/sys/")),
    risk: RiskLevel.CRITICAL,
    reason: "Writing to system directory",
  },
  {
    match: (tool, args) =>
      tool === "delete_file" || tool === "remove_directory",
    risk: RiskLevel.HIGH,
    reason: "Destructive file operation",
  },
  {
    match: (tool, args) => tool === "http_request" && args?.method !== "GET",
    risk: RiskLevel.MEDIUM,
    reason: "Non‑GET HTTP request (may modify remote data)",
  },
  {
    match: (tool, args) => tool === "send_email",
    risk: RiskLevel.MEDIUM,
    reason: "Sending email could leak information",
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
    "list_tools",
    "read_file",
    "get_weather",
    "calculate",
    "search",
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
