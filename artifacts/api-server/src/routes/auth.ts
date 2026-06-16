import { Router } from "express";
import { google } from "googleapis";
import { db, settingsTable } from "@workspace/db";
import { updateSettings } from "../services/settingsService.js";

const router = Router();

const CALLBACK_URL = "http://localhost:4444/api/auth/google/callback";
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getOAuth2Client(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(clientId, clientSecret, CALLBACK_URL);
}

router.get("/google/url", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    const settings = rows[0];
    if (!settings?.googleClientId || !settings?.googleClientSecret) {
      res.status(400).json({ error: "Google Client ID and Client Secret must be configured in Settings before connecting." });
      return;
    }
    const oauth2Client = getOAuth2Client(settings.googleClientId, settings.googleClientSecret);
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: "Missing authorization code" });
      return;
    }
    const rows = await db.select().from(settingsTable).limit(1);
    const settings = rows[0];
    if (!settings?.googleClientId || !settings?.googleClientSecret) {
      res.status(400).json({ error: "Google credentials not configured" });
      return;
    }
    const oauth2Client = getOAuth2Client(settings.googleClientId, settings.googleClientSecret);
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.status(400).json({ error: "No refresh token received. Try revoking app access in your Google account and reconnecting." });
      return;
    }
    await updateSettings({ googleRefreshToken: tokens.refresh_token });
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Google Calendar connected!</h2>
        <p>You can close this tab and return to JARVIS.</p>
        <script>setTimeout(() => window.close(), 2000)</script>
      </body></html>
    `);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
