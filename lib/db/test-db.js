import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: "postgresql://myuser:mypassword@127.0.0.1:5432/mydb" });
client.connect().then(() => {
  console.log("Connected");
  client.end();
}).catch(err => {
  console.error("Connection failed:", err);
});
