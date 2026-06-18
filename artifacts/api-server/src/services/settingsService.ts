import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { integrationsManager } from "../integrations/manager.js";

export async function ensureSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(settingsTable).values({}).returning();
    return row;
  }
  return rows[0]!;
}

export function toResponse(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    groqApiKeySet: !!s.groqApiKey,
    nvidiaApiKeySet: !!s.nvidiaApiKey,
    openaiApiKeySet: !!s.openaiApiKey,
    anthropicApiKeySet: !!s.anthropicApiKey,
    mistralApiKeySet: !!s.mistralApiKey,
    openrouterApiKeySet: !!s.openrouterApiKey,
    geminiApiKeySet: !!s.geminiApiKey,
    customTextApiUrl: s.customTextApiUrl,
    customTextApiKeySet: !!s.customTextApiKey,
    customVisionApiUrl: s.customVisionApiUrl,
    customVisionApiKeySet: !!s.customVisionApiKey,
    selectedModel: s.selectedModel,
    selectedProvider: s.selectedProvider,
    visionModel: s.visionModel,
    visionProvider: s.visionProvider,
    wakeWord: s.wakeWord,
    voiceEnabled: s.voiceEnabled,
    selectedCharacterId: s.selectedCharacterId,
    miniModeEnabled: s.miniModeEnabled,
    telegramBotToken: s.telegramBotToken,
    discordBotToken: s.discordBotToken,
    notionApiKey: s.notionApiKey,
    spotifyClientId: s.spotifyClientId,
    spotifyClientSecret: s.spotifyClientSecret,
    githubPatSet: !!s.githubPat,
    emailAddress: s.emailAddress,
    emailProvider: s.emailProvider,
    emailPasswordSet: !!s.emailPassword,
    googleClientIdSet: !!s.googleClientId,
    googleClientSecretSet: !!s.googleClientSecret,
    googleRefreshTokenSet: !!s.googleRefreshToken,
  };
}

export async function getSettingsResponse() {
  const settings = await ensureSettings();
  return toResponse(settings);
}

export async function updateSettings(parsedData: any) {
  const settings = await ensureSettings();
  const updates: Partial<typeof settingsTable.$inferInsert> = {};

  const d = parsedData;
  if (d.groqApiKey != null) updates.groqApiKey = d.groqApiKey;
  if (d.nvidiaApiKey != null) updates.nvidiaApiKey = d.nvidiaApiKey;
  if (d.openaiApiKey != null) updates.openaiApiKey = d.openaiApiKey;
  if (d.anthropicApiKey != null) updates.anthropicApiKey = d.anthropicApiKey;
  if (d.mistralApiKey != null) updates.mistralApiKey = d.mistralApiKey;
  if (d.openrouterApiKey != null) updates.openrouterApiKey = d.openrouterApiKey;
  if (d.geminiApiKey != null) updates.geminiApiKey = d.geminiApiKey;
  if (d.customTextApiUrl !== undefined) updates.customTextApiUrl = d.customTextApiUrl;
  if (d.customTextApiKey !== undefined) updates.customTextApiKey = d.customTextApiKey;
  if (d.customVisionApiUrl !== undefined) updates.customVisionApiUrl = d.customVisionApiUrl;
  if (d.customVisionApiKey !== undefined) updates.customVisionApiKey = d.customVisionApiKey;
  if (d.selectedModel != null) updates.selectedModel = d.selectedModel;
  if (d.selectedProvider != null) updates.selectedProvider = d.selectedProvider;
  if (d.visionModel != null) updates.visionModel = d.visionModel;
  if (d.visionProvider != null) updates.visionProvider = d.visionProvider;
  if (d.wakeWord != null) updates.wakeWord = d.wakeWord;
  if (d.voiceEnabled != null) updates.voiceEnabled = d.voiceEnabled;
  if (d.selectedCharacterId != null) updates.selectedCharacterId = d.selectedCharacterId;
  if (d.miniModeEnabled != null) updates.miniModeEnabled = d.miniModeEnabled;
  if (d.telegramBotToken !== undefined) updates.telegramBotToken = d.telegramBotToken;
  if (d.discordBotToken !== undefined) updates.discordBotToken = d.discordBotToken;
  if (d.notionApiKey !== undefined) updates.notionApiKey = d.notionApiKey;
  if (d.spotifyClientId !== undefined) updates.spotifyClientId = d.spotifyClientId;
  if (d.spotifyClientSecret !== undefined) updates.spotifyClientSecret = d.spotifyClientSecret;
  if (d.githubPat !== undefined) updates.githubPat = d.githubPat;
  if (d.emailAddress !== undefined) updates.emailAddress = d.emailAddress;
  if (d.emailPassword !== undefined) updates.emailPassword = d.emailPassword;
  if (d.emailProvider !== undefined) updates.emailProvider = d.emailProvider;
  if (d.googleClientId !== undefined) updates.googleClientId = d.googleClientId;
  if (d.googleClientSecret !== undefined) updates.googleClientSecret = d.googleClientSecret;
  if (d.googleRefreshToken !== undefined) updates.googleRefreshToken = d.googleRefreshToken;

  const [updated] = await db
    .update(settingsTable)
    .set(updates)
    .where(eq(settingsTable.id, settings.id))
    .returning();

  integrationsManager.reload();

  return toResponse(updated!);
}
