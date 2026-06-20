const Database = require('better-sqlite3');
const db = new Database('../../sqlite.db');
try {
  db.exec('ALTER TABLE messages ADD COLUMN thinking_metadata TEXT;');
  console.log('Added thinking_metadata column to messages table');
} catch (e) {
  console.log(e.message);
}
db.close();
