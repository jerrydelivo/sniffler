const { Client } = require("pg");

async function testDatabaseProxy() {
  console.log("🔌 Connecting to database proxy on port 4445...");

  // Connect to the database proxy instead of the real database
  const client = new Client({
    host: "localhost",
    port: 4445, // Proxy port
    user: "postgres",
    password: "postgres",
    database: "postgres",
  });

  try {
    await client.connect();
    console.log("✅ Connected to database proxy successfully!");

    // Run a simple query
    console.log("🔍 Executing test query...");
    const result = await client.query(
      "SELECT NOW() as current_time, 'Hello from proxy!' as message"
    );

    console.log("📋 Query result:", result.rows);

    // Run another query
    console.log("🔍 Executing another query...");
    const result2 = await client.query(
      "SELECT 1 + 1 as sum, 'Testing real-time updates' as note"
    );

    console.log("📋 Second query result:", result2.rows);
  } catch (error) {
    console.error("❌ Database query failed:", error.message);
  } finally {
    await client.end();
    console.log("🔌 Disconnected from database proxy");
  }
}

// Run the test
testDatabaseProxy().catch(console.error);
