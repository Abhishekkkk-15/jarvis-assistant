import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  await db.update(settingsTable).set({ selectedModel: "llama-3.3-70b-versatile" }).where(eq(settingsTable.selectedModel, "llama3-70b-8192"));
  console.log("Updated settings model to llama-3.3-70b-versatile");
  process.exit(0);
}

main().catch(console.error);
