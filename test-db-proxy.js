const { Client } = require("pg");

async function testDatabaseProxy() {
  console.log("Testing database proxy connection...");

  // Create a PostgreSQL client connecting to the proxy port 4445
  const client = new Client({
    host: "localhost",
    port: 4445, // This should be the proxy port
    database: "test",
    user: "postgres",
    password: "password",
    // Connection timeout
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log("Connecting to database proxy on port 4445...");
    await client.connect();
    console.log("✅ Connected to database proxy successfully!");

    console.log("Executing test query...");
    const result = await client.query(
      "SELECT 1 as test_query, NOW() as current_time"
    );
    console.log("✅ Query executed successfully:", result.rows);

    // Execute another query
    console.log("Executing another test query...");
    const result2 = await client.query("SELECT * FROM users LIMIT 5");
    console.log("✅ Second query executed successfully:", result2.rows);
  } catch (error) {
    console.error("❌ Database proxy test failed:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
  } finally {
    try {
      await client.end();
      console.log("Connection closed");
    } catch (closeError) {
      console.error("Error closing connection:", closeError.message);
    }
  }
}

testDatabaseProxy();
