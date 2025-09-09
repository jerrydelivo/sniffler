const { Client } = require("pg");

async function testDirectConnection() {
  console.log("🔌 Testing direct database connections...");

  // Try different potential database configurations
  const configs = [
    {
      host: "localhost",
      port: 5432,
      user: "testuser",
      password: "testpass",
      database: "testdb",
      name: "Docker Test DB",
    },
    {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "password",
      database: "test",
      name: "Local Postgres",
    },
    {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres",
      name: "Default Postgres",
    },
  ];

  for (const config of configs) {
    console.log(`\n🔍 Trying ${config.name}...`);
    const client = new Client(config);

    try {
      await client.connect();
      console.log(`✅ Connected to ${config.name} successfully!`);

      const result = await client.query("SELECT 1 as test_column");
      console.log(`📋 Query result for ${config.name}:`, result.rows);

      await client.end();
      console.log(`🔌 Disconnected from ${config.name}`);

      return config; // Return the working config
    } catch (error) {
      console.log(`❌ Failed to connect to ${config.name}: ${error.message}`);
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  console.log("\n❌ No working database connection found");
  return null;
}

// Run the test
testDirectConnection().catch(console.error);
