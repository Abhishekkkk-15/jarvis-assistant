import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

async function ensureSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(settingsTable).values({}).returning();
    return row;
  }
  return rows[0]!;
}

function toResponse(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    groqApiKeySet: !!s.groqApiKey,
    nvidiaApiKeySet: !!s.nvidiaApiKey,
    selectedModel: s.selectedModel,
    selectedProvider: s.selectedProvider,
    wakeWord: s.wakeWord,
    voiceEnabled: s.voiceEnabled,
    selectedCharacterId: s.selectedCharacterId,
    miniModeEnabled: s.miniModeEnabled,
  };
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json(toResponse(settings));
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const settings = await ensureSettings();
    const updates: Partial<typeof settingsTable.$inferInsert> = {};

    const d = parsed.data;
    if (d.groqApiKey != null) updates.groqApiKey = d.groqApiKey;
    if (d.nvidiaApiKey != null) updates.nvidiaApiKey = d.nvidiaApiKey;
    if (d.selectedModel != null) updates.selectedModel = d.selectedModel;
    if (d.selectedProvider != null) updates.selectedProvider = d.selectedProvider;
    if (d.wakeWord != null) updates.wakeWord = d.wakeWord;
    if (d.voiceEnabled != null) updates.voiceEnabled = d.voiceEnabled;
    if (d.selectedCharacterId != null) updates.selectedCharacterId = d.selectedCharacterId;
    if (d.miniModeEnabled != null) updates.miniModeEnabled = d.miniModeEnabled;


    const [updated] = await db
      .update(settingsTable)
      .set(updates)
      .where(eq(settingsTable.id, settings.id))
      .returning();

    res.json(toResponse(updated!));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
