import Database from 'better-sqlite3';
const db = new Database('../../sqlite.db');
try {
  db.exec('ALTER TABLE settings ADD COLUMN telegram_bot_token TEXT;');
  console.log('Added telegram_bot_token');
} catch (e) {
  console.log(e.message);
}
try {
  db.exec('ALTER TABLE settings ADD COLUMN discord_bot_token TEXT;');
  console.log('Added discord_bot_token');
} catch (e) {
  console.log(e.message);
}
db.close();
