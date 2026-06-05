import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { broadcast } from "../lib/wsManager.js";

export const notifyTools = [
    new DynamicStructuredTool({
        name: "notify_user",
        description: "CRITICAL: USE THIS TOOL for ALL reminders, notifications, pop-ups, and alerts. DO NOT use PowerShell, bash, or run_command for notifications or reminders. Send a notification to the user through the desktop character (Courier). You can optionally set a delay in seconds to remind the user of something later. Note: Scheduling a notification successfully fulfills the objective immediately.",
        schema: z.object({
            message: z.string().describe("The message to show to the user."),
            delaySeconds: z.number().optional().describe("Number of seconds to wait before showing the notification. Use this for short reminders (e.g. 2 seconds). Leave empty for instant notifications."),
        }),
        func: async ({ message, delaySeconds }) => {
            const ms = (delaySeconds || 0) * 1000;

            const payload = {
                type: "system_notification",
                title: "JARVIS Reminder",
                message: message,
            };

            if (ms > 0) {
                // Schedule it in the background
                setTimeout(() => {
                    broadcast(payload);
                }, ms);
                return `Notification scheduled to appear in ${delaySeconds} seconds.`;
            } else {
                // Broadcast instantly
                broadcast(payload);
                return `Notification sent to the user instantly.`;
            }
        },
    })
];
