import { db } from './src/db.js';
import { sql } from 'drizzle-orm';
const run = async () => {
    try { await db.run(sql`ALTER TABLE settings ADD COLUMN telegram_chat_id TEXT;`); } catch(e){}
    try { await db.run(sql`ALTER TABLE settings ADD COLUMN startup_notification_enabled INTEGER NOT NULL DEFAULT 0;`); } catch(e){}
    try { await db.run(sql`ALTER TABLE settings ADD COLUMN startup_notification_prompt TEXT NOT NULL DEFAULT 'The system has just booted. Please provide a brief morning greeting and summarize the current weather or time.';`); } catch(e){}
    console.log('Migration complete');
};
run();
