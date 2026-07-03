import mariadb from 'mariadb';

async function testCreateDB() {
  console.log("Checking if we can create a new database on server.001webhospedaje.com...");
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: 'server.001webhospedaje.com',
      user: 'hedkzmww_admin',
      password: 'sgsGRrR$o2',
      connectTimeout: 10000
    });
    console.log("CONNECTED!");
    await conn.query("CREATE DATABASE IF NOT EXISTS hedkzmww_smarttrack");
    console.log("SUCCESSFULLY CREATED DATABASE hedkzmww_smarttrack!");
    const databases = await conn.query("SHOW DATABASES");
    console.log("Databases now available:", databases);
  } catch (err) {
    console.error("Failed to create database:", err);
  } finally {
    if (conn) conn.end();
  }
}

testCreateDB();
