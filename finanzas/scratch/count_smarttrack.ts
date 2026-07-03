import mariadb from 'mariadb';

async function main() {
  console.log("Connecting to source database smarttrack on TiDB Cloud...");
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '3EsKTcwyvZVUqyr.root',
      password: 'WE3G5c7BSjmO8y7M',
      database: 'smarttrack',
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log("Connected to smarttrack!");
    const tables = await conn.query("SHOW TABLES");
    console.log("Tables in smarttrack:");
    console.log(tables);

    for (const row of tables) {
      const tableName = Object.values(row)[0] as string;
      const countResult = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      console.log(`- ${tableName}: ${countResult[0].count} rows`);
    }

  } catch (err) {
    console.error("Failed to read smarttrack:", err);
  } finally {
    if (conn) conn.end();
  }
}

main();
