import sqlite3

conn = sqlite3.connect('sqlite.db')
conn.execute("""
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cron_expression TEXT NOT NULL,
    task_description TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
)
""")
conn.commit()
conn.close()
print("Table scheduled_tasks created!")
