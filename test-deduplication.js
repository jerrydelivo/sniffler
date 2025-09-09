/**
 * Test script to verify database query deduplication is working
 */
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");

async function testDeduplication() {
  console.log("🧪 Testing Database Query Deduplication...");

  // Create interceptor with deduplication enabled
  const interceptor = new DatabaseProxyInterceptor({
    maxRequestHistory: 100,
  });

  // Enable deduplication with a 500ms window
  interceptor.updateSettings({
    enableDeduplication: true,
    deduplicationWindow: 500,
  });

  // Create a mock proxy configuration
  const proxyConfig = {
    id: "test-proxy",
    port: 5432,
    targetHost: "localhost",
    targetPort: 5433,
    protocol: "postgresql",
    name: "Test Deduplication Proxy",
    stats: {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      activeConnections: 0,
      mocksServed: 0,
    },
  };

  interceptor.proxyServers.set(5432, proxyConfig);

  const testQuery = {
    type: "SELECT",
    sql: "SELECT * FROM users WHERE id = 1",
    isQuery: true,
  };

  console.log("\n📝 Testing duplicate query detection...");

  // Process the same query multiple times quickly
  const connectionId1 = "conn-1";
  const connectionId2 = "conn-2";
  const connectionId3 = "conn-3";

  // First query should be processed normally
  console.log("1️⃣ Processing first query...");
  const query1 = interceptor.processQuery(
    connectionId1,
    testQuery,
    proxyConfig
  );
  console.log(
    `   Result: ${query1 ? "Created new query" : "Null"} - ID: ${query1?.id}`
  );

  // Second query (duplicate) should be deduplicated
  console.log("2️⃣ Processing duplicate query (should be deduplicated)...");
  const query2 = interceptor.processQuery(
    connectionId2,
    testQuery,
    proxyConfig
  );
  console.log(
    `   Result: ${
      query2?.id === query1?.id
        ? "Deduplicated (returned existing)"
        : "Created new query"
    } - ID: ${query2?.id}`
  );

  // Third query (another duplicate) should also be deduplicated
  console.log("3️⃣ Processing another duplicate query...");
  const query3 = interceptor.processQuery(
    connectionId3,
    testQuery,
    proxyConfig
  );
  console.log(
    `   Result: ${
      query3?.id === query1?.id
        ? "Deduplicated (returned existing)"
        : "Created new query"
    } - ID: ${query3?.id}`
  );

  // Wait for deduplication window to expire
  console.log("\n⏰ Waiting for deduplication window to expire...");
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Fourth query should be processed as new (window expired)
  console.log(
    "4️⃣ Processing query after window expiration (should create new)..."
  );
  const query4 = interceptor.processQuery("conn-4", testQuery, proxyConfig);
  console.log(
    `   Result: ${
      query4?.id !== query1?.id
        ? "Created new query (window expired)"
        : "Still deduplicated"
    } - ID: ${query4?.id}`
  );

  // Check final state
  console.log("\n📊 Final Results:");
  console.log(
    `   Total intercepted queries: ${interceptor.interceptedQueries.length}`
  );
  console.log(`   Expected: 2 (original + after window expiration)`);
  console.log(
    `   Deduplication ${
      interceptor.interceptedQueries.length === 2
        ? "✅ WORKING"
        : "❌ NOT WORKING"
    }`
  );

  // Test with different queries
  console.log("\n🔄 Testing different queries (should not be deduplicated)...");
  const differentQuery = {
    type: "SELECT",
    sql: "SELECT * FROM orders WHERE status = 'pending'",
    isQuery: true,
  };

  const query5 = interceptor.processQuery(
    "conn-5",
    differentQuery,
    proxyConfig
  );
  console.log(
    `   Different query created: ${
      query5?.id !== query1?.id && query5?.id !== query4?.id
        ? "✅ YES"
        : "❌ NO"
    } - ID: ${query5?.id}`
  );

  console.log(
    `\n   Final total queries: ${interceptor.interceptedQueries.length}`
  );
  console.log(`   Expected: 3 (2 original queries + 1 different query)`);

  // Test disabling deduplication
  console.log("\n🚫 Testing with deduplication disabled...");
  interceptor.updateSettings({ enableDeduplication: false });

  const query6 = interceptor.processQuery("conn-6", testQuery, proxyConfig);
  const query7 = interceptor.processQuery("conn-7", testQuery, proxyConfig);

  console.log(`   Query 6 ID: ${query6?.id}`);
  console.log(`   Query 7 ID: ${query7?.id}`);
  console.log(
    `   Both created separately: ${
      query6?.id !== query7?.id ? "✅ YES" : "❌ NO"
    }`
  );

  console.log(
    `\n   Final total queries: ${interceptor.interceptedQueries.length}`
  );
  console.log(`   Expected: 5 (3 previous + 2 with deduplication disabled)`);

  console.log("\n🎉 Deduplication test completed!");
}

// Run the test
if (require.main === module) {
  testDeduplication().catch(console.error);
}

module.exports = { testDeduplication };
