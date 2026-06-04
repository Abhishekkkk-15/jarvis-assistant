const DB = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'sqlite.db');
const db = new DB(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cron_expression TEXT NOT NULL,
    task_description TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  )
`);
console.log('Table created!');
