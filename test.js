const { db, settingsTable } = require('./artifacts/db/dist/index.js');
async function run() {
  const settings = await db.select().from(settingsTable);
  const key = settings[0].groqApiKey;
  const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json();
  console.log(data.data.map(m => m.id).filter(id => id.includes('vision')));
  process.exit(0);
}
run();
