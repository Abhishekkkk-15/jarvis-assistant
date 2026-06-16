import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { db, settingsTable } from "@workspace/db";

async function getCalendarClient() {
  const rows = await db.select().from(settingsTable).limit(1);
  const s = rows[0];
  if (!s?.googleClientId || !s?.googleClientSecret) {
    throw new Error("Google Client ID and Client Secret are not configured. Add them in Settings and click Connect Google Calendar.");
  }
  if (!s?.googleRefreshToken) {
    throw new Error("Google Calendar not connected. Go to Settings and click 'Connect Google Calendar' to authorize access.");
  }
  const oauth2Client = new google.auth.OAuth2(s.googleClientId, s.googleClientSecret);
  oauth2Client.setCredentials({ refresh_token: s.googleRefreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

function formatEvent(event: any): string {
  const start = event.start?.dateTime || event.start?.date || "unknown";
  const end = event.end?.dateTime || event.end?.date || "unknown";
  const attendees = event.attendees?.map((a: any) => a.email).join(", ") || "none";
  return `ID: ${event.id}\nTitle: ${event.summary || "(no title)"}\nStart: ${start}\nEnd: ${end}\nDescription: ${event.description || "none"}\nAttendees: ${attendees}\nLocation: ${event.location || "none"}`;
}

export const calendarTools = [
  new DynamicStructuredTool({
    name: "calendar_list_events",
    description: "List events from the user's Google Calendar. Defaults to today's events. Provide startDate/endDate in ISO format to specify a range.",
    schema: z.object({
      startDate: z.string().optional().describe("ISO date string for range start (e.g. 2024-01-15T00:00:00Z). Defaults to start of today."),
      endDate: z.string().optional().describe("ISO date string for range end (e.g. 2024-01-15T23:59:59Z). Defaults to end of today."),
      maxResults: z.number().default(10).describe("Maximum number of events to return"),
    }),
    func: async ({ startDate, endDate, maxResults }) => {
      try {
        const calendar = await getCalendarClient();
        const now = new Date();
        const timeMin = startDate || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const timeMax = endDate || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
        const resp = await calendar.events.list({
          calendarId: "primary",
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = resp.data.items || [];
        if (events.length === 0) return "No events found in the specified time range.";
        return `Found ${events.length} event(s):\n\n${events.map(formatEvent).join("\n\n---\n\n")}`;
      } catch (err: any) {
        return `Error listing calendar events: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "calendar_create_event",
    description: "Create a new event in the user's Google Calendar.",
    schema: z.object({
      title: z.string().describe("Event title/summary"),
      startDateTime: z.string().describe("Start date-time in ISO format (e.g. 2024-01-15T14:00:00)"),
      endDateTime: z.string().describe("End date-time in ISO format (e.g. 2024-01-15T15:00:00)"),
      description: z.string().optional().describe("Event description or notes"),
      location: z.string().optional().describe("Event location"),
      attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
      timeZone: z.string().default("UTC").describe("IANA timezone string (e.g. America/New_York)"),
    }),
    func: async ({ title, startDateTime, endDateTime, description, location, attendees, timeZone }) => {
      try {
        const calendar = await getCalendarClient();
        const event: any = {
          summary: title,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
        };
        if (description) event.description = description;
        if (location) event.location = location;
        if (attendees?.length) event.attendees = attendees.map(email => ({ email }));
        const resp = await calendar.events.insert({ calendarId: "primary", requestBody: event });
        return `Event created successfully!\nID: ${resp.data.id}\nTitle: ${resp.data.summary}\nLink: ${resp.data.htmlLink}`;
      } catch (err: any) {
        return `Error creating calendar event: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "calendar_delete_event",
    description: "Delete an event from the user's Google Calendar by its event ID.",
    schema: z.object({
      eventId: z.string().describe("The Google Calendar event ID (from calendar_list_events or calendar_search_events)"),
    }),
    func: async ({ eventId }) => {
      try {
        const calendar = await getCalendarClient();
        await calendar.events.delete({ calendarId: "primary", eventId });
        return `Event ${eventId} deleted successfully.`;
      } catch (err: any) {
        return `Error deleting calendar event: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "calendar_search_events",
    description: "Search the user's Google Calendar for events matching a keyword query.",
    schema: z.object({
      query: z.string().describe("Text to search for in event titles, descriptions, and locations"),
      maxResults: z.number().default(10).describe("Maximum number of results to return"),
    }),
    func: async ({ query, maxResults }) => {
      try {
        const calendar = await getCalendarClient();
        const resp = await calendar.events.list({
          calendarId: "primary",
          q: query,
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
          timeMin: new Date(0).toISOString(),
        });
        const events = resp.data.items || [];
        if (events.length === 0) return `No events found matching "${query}".`;
        return `Found ${events.length} event(s) matching "${query}":\n\n${events.map(formatEvent).join("\n\n---\n\n")}`;
      } catch (err: any) {
        return `Error searching calendar events: ${err.message}`;
      }
    },
  }),

  new DynamicStructuredTool({
    name: "calendar_get_event",
    description: "Get full details of a specific Google Calendar event by its ID.",
    schema: z.object({
      eventId: z.string().describe("The Google Calendar event ID"),
    }),
    func: async ({ eventId }) => {
      try {
        const calendar = await getCalendarClient();
        const resp = await calendar.events.get({ calendarId: "primary", eventId });
        return formatEvent(resp.data);
      } catch (err: any) {
        return `Error fetching calendar event: ${err.message}`;
      }
    },
  }),
];
