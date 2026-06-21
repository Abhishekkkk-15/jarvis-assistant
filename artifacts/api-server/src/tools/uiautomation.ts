import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as child_process from "child_process";

// ─────────────────────────────────────────────────────────────────
// Helper: run a python script
// ─────────────────────────────────────────────────────────────────
function runPythonScript(code: string, timeout = 15000): Promise<string> {
  return new Promise((resolve) => {
    // Write code to a temp file to avoid quoting issues
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `uia_script_${Date.now()}.py`);
    fs.writeFileSync(tmpFile, code);
    
    child_process.exec(
      `python "${tmpFile}"`,
      { timeout, maxBuffer: 1024 * 1024 * 5 }, // 5MB buffer for large UI trees
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpFile); } catch (e) {} // cleanup
        if (err) resolve(`Error: ${stderr || err.message}`);
        else resolve(stdout.trim() || "OK");
      }
    );
  });
}

export const uiaTools = [
  new DynamicStructuredTool({
    name: "uia_inspect_window",
    description: "Dumps the semantic accessibility tree of the currently active window or a window matching the title. Useful to find Button names and AutomationIds before interacting.",
    schema: z.object({
      windowTitle: z.string().optional().describe("Substring of the window title to inspect. If omitted, inspects the foreground/active window."),
      depth: z.number().default(5).describe("Max depth to search/dump the UI tree. Keep it small (3-5) unless you can't find what you need."),
    }),
    func: async ({ windowTitle, depth }) => {
      const safeTitle = (windowTitle || "").replace(/'/g, "\\'");
      const code = `
import uiautomation as auto
import json

def get_tree(control, current_depth, max_depth):
    if current_depth > max_depth:
        return None
    node = {
        'ControlType': control.ControlTypeName,
        'Name': control.Name,
        'AutomationId': control.AutomationId,
        'ClassName': control.ClassName
    }
    children = []
    for child in control.GetChildren():
        child_node = get_tree(child, current_depth + 1, max_depth)
        if child_node:
            children.append(child_node)
    if children:
        node['Children'] = children
    return node

try:
    auto.SetGlobalSearchTimeout(2)
    if '${safeTitle}' != '':
        root = auto.WindowControl(searchDepth=1, RegexName='.*${safeTitle}.*')
    else:
        root = auto.GetFocusedControl().GetTopLevelControl()
    
    if not root.Exists(0, 0):
        print("Window not found")
    else:
        tree = get_tree(root, 0, ${depth})
        print(json.dumps(tree, indent=2))
except Exception as e:
    print(f"Error: {e}")
`;
      return await runPythonScript(code);
    },
  }),
  new DynamicStructuredTool({
    name: "uia_click_element",
    description: "Click a native Windows UI element identified by Name, AutomationId, or ClassName.",
    schema: z.object({
      name: z.string().optional().describe("The exact Name of the UI element (from uia_inspect_window)"),
      automationId: z.string().optional().describe("The AutomationId of the UI element"),
      className: z.string().optional().describe("The ClassName of the UI element"),
      action: z.enum(["click", "double_click", "right_click"]).default("click"),
    }),
    func: async ({ name, automationId, className, action }) => {
      if (!name && !automationId && !className) return "Error: Must provide at least one identifier (name, automationId, className)";
      
      let searchParams = [];
      if (name) searchParams.push(`Name='${name.replace(/'/g, "\\'")}'`);
      if (automationId) searchParams.push(`AutomationId='${automationId.replace(/'/g, "\\'")}'`);
      if (className) searchParams.push(`ClassName='${className.replace(/'/g, "\\'")}'`);

      const code = `
import uiautomation as auto

try:
    auto.SetGlobalSearchTimeout(3)
    control = auto.Control(searchDepth=10, ${searchParams.join(', ')})
    if not control.Exists(0, 0):
        print("Control not found")
    else:
        if '${action}' == 'click':
            control.Click(simulateMove=False)
        elif '${action}' == 'double_click':
            control.DoubleClick(simulateMove=False)
        elif '${action}' == 'right_click':
            control.RightClick(simulateMove=False)
        print("Success")
except Exception as e:
    print(f"Error: {e}")
`;
      return await runPythonScript(code);
    },
  }),
  new DynamicStructuredTool({
    name: "uia_set_text",
    description: "Sets the text value of a native Windows text box element.",
    schema: z.object({
      name: z.string().optional(),
      automationId: z.string().optional(),
      className: z.string().optional(),
      text: z.string().describe("The text to type/insert into the field"),
    }),
    func: async ({ name, automationId, className, text }) => {
      if (!name && !automationId && !className) return "Error: Must provide at least one identifier";
      let searchParams = [];
      if (name) searchParams.push(`Name='${name.replace(/'/g, "\\'")}'`);
      if (automationId) searchParams.push(`AutomationId='${automationId.replace(/'/g, "\\'")}'`);
      if (className) searchParams.push(`ClassName='${className.replace(/'/g, "\\'")}'`);

      const code = `
import uiautomation as auto

try:
    auto.SetGlobalSearchTimeout(3)
    control = auto.Control(searchDepth=10, ${searchParams.join(', ')})
    if not control.Exists(0, 0):
        print("Control not found")
    else:
        control.Click(simulateMove=False)
        control.SendKeys('${text.replace(/'/g, "\\'")}')
        print("Success")
except Exception as e:
    print(f"Error: {e}")
`;
      return await runPythonScript(code);
    },
  })
];
