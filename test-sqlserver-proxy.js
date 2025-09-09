// Test SQL Server proxy interception and mock/request saving
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");
const sql = require("mssql");

async function testSqlServerProxy() {
  const interceptor = new DatabaseProxyInterceptor();

  console.log("🚀 Starting SQL Server proxy test...");

  // Create SQL Server proxy
  const proxyConfig = {
    port: 1445, // Test proxy port
    targetHost: "localhost",
    targetPort: 1433, // SQL Server 2022 container
    protocol: "sqlserver",
    name: "SQL Server Test Proxy",
  };

  try {
    // Create and start the proxy
    console.log("📡 Creating SQL Server proxy on port 1445...");
    await interceptor.createDatabaseProxy(proxyConfig);
    await interceptor.startDatabaseProxy(1445);

    console.log("✅ SQL Server proxy started successfully");

    // Set up event listeners to track what happens
    let queryIntercepted = false;
    let requestSaved = false;
    let mockCreated = false;

    interceptor.on("database-query", (query) => {
      console.log("🔍 Query intercepted:", {
        id: query.id,
        sql: query.query,
        protocol: query.protocol,
        proxyPort: query.proxyPort,
      });
      queryIntercepted = true;
    });

    interceptor.on("database-query-response", (query) => {
      console.log("📥 Query response received:", {
        id: query.id,
        status: query.status,
        duration: query.duration,
        hasResponse: !!query.response,
      });
      if (query.status === "success") {
        requestSaved = true;
      }
    });

    interceptor.on("database-mock-auto-created", (event) => {
      console.log("🎭 Mock auto-created:", {
        queryId: event.query.id,
        mockId: event.mock.id,
      });
      mockCreated = true;
    });

    // Wait a moment for proxy to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect to the proxy and execute a query
    console.log("🔌 Connecting to SQL Server through proxy...");

    const config = {
      server: "localhost",
      port: 1445, // Connect through proxy
      user: "sa",
      password: "TestPass123!",
      database: "testdb",
      options: {
        encrypt: false, // Disable encryption to see raw SQL queries
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
      requestTimeout: 10000,
    };

    const pool = await sql.connect(config);
    console.log("✅ Connected to SQL Server through proxy");

    // Execute a test query
    console.log("📤 Executing test query: SELECT 1 AS test_value");
    const result = await pool.request().query("SELECT 1 AS test_value");

    console.log("📥 Query result:", result.recordset);

    // Close the connection
    await pool.close();

    // Wait a bit for events to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check results
    console.log("\n📊 Test Results:");
    console.log("- Query intercepted:", queryIntercepted ? "✅" : "❌");
    console.log("- Request saved:", requestSaved ? "✅" : "❌");
    console.log("- Mock auto-created:", mockCreated ? "✅" : "❌");

    // Get intercepted queries
    const queries = interceptor.getInterceptedQueries();
    console.log("- Total intercepted queries:", queries.length);

    // Get mocks
    const mocks = interceptor.getDatabaseMocks();
    console.log("- Total mocks:", mocks.length);

    if (queries.length > 0) {
      console.log("\n📝 Sample intercepted query:");
      console.log(JSON.stringify(queries[0], null, 2));
    }

    if (mocks.length > 0) {
      console.log("\n🎭 Sample mock:");
      console.log(JSON.stringify(mocks[0], null, 2));
    }

    // Clean up
    await interceptor.stopDatabaseProxy(1445);
    console.log("🛑 SQL Server proxy stopped");

    // Summary
    const success = queryIntercepted && requestSaved;
    console.log(
      `\n${success ? "✅ TEST PASSED" : "❌ TEST FAILED"}: SQL Server proxy ${
        success ? "successfully" : "failed to"
      } intercept and save requests`
    );

    if (!success) {
      console.log("\n🔍 Debugging info:");
      console.log("- Proxy configurations:", interceptor.getDatabaseProxies());
      console.log("- Settings:", interceptor.getSettings());
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);

    try {
      await interceptor.stopDatabaseProxy(1445);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run the test
testSqlServerProxy().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
