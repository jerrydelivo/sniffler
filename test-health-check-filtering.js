/**
 * Test script to verify health check filtering is working
 */
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");

async function testHealthCheckFiltering() {
  console.log("🧪 Testing Database Health Check Filtering...");

  // Create interceptor with health check filtering enabled
  const interceptor = new DatabaseProxyInterceptor({
    maxRequestHistory: 100,
  });

  // Create a mock proxy configuration
  const proxyConfig = {
    id: "test-proxy",
    port: 5432,
    targetHost: "localhost",
    targetPort: 5433,
    protocol: "postgresql",
    name: "Test Health Check Filtering Proxy",
    stats: {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      activeConnections: 0,
      mocksServed: 0,
    },
  };

  interceptor.proxyServers.set(5432, proxyConfig);

  console.log("\n📝 Testing health check queries (should be filtered)...");

  const healthCheckQueries = [
    { sql: "SELECT NOW()", description: "Current timestamp" },
    { sql: "SELECT 1", description: "Simple validation" },
    { sql: "select now()", description: "Lowercase version" },
    { sql: "  SELECT NOW()  ", description: "With whitespace" },
    { sql: "SELECT CURRENT_TIMESTAMP", description: "Alternative timestamp" },
  ];

  let filteredCount = 0;
  for (let i = 0; i < healthCheckQueries.length; i++) {
    const testQuery = {
      type: "SELECT",
      sql: healthCheckQueries[i].sql,
      isQuery: true,
    };

    console.log(
      `${i + 1}️⃣ Testing: ${healthCheckQueries[i].description} - "${
        healthCheckQueries[i].sql
      }"`
    );
    const result = interceptor.processQuery(
      `conn-${i}`,
      testQuery,
      proxyConfig
    );

    if (result === null) {
      console.log("   ✅ Filtered out (as expected)");
      filteredCount++;
    } else {
      console.log("   ❌ NOT filtered - this shouldn't happen!");
    }
  }

  console.log("\n📝 Testing real queries (should NOT be filtered)...");

  const realQueries = [
    { sql: "SELECT * FROM users", description: "User query" },
    {
      sql: "INSERT INTO logs (message) VALUES ('test')",
      description: "Insert query",
    },
    {
      sql: "UPDATE users SET active = true WHERE id = 1",
      description: "Update query",
    },
  ];

  let processedCount = 0;
  for (let i = 0; i < realQueries.length; i++) {
    const testQuery = {
      type: "SELECT",
      sql: realQueries[i].sql,
      isQuery: true,
    };

    console.log(
      `${i + 1}️⃣ Testing: ${realQueries[i].description} - "${
        realQueries[i].sql
      }"`
    );
    const result = interceptor.processQuery(
      `real-conn-${i}`,
      testQuery,
      proxyConfig
    );

    if (result !== null) {
      console.log("   ✅ Processed (as expected)");
      processedCount++;
    } else {
      console.log("   ❌ Filtered out - this shouldn't happen!");
    }
  }

  console.log("\n📊 Health Check Filtering Results:");
  console.log(
    `   Health check queries filtered: ${filteredCount}/${healthCheckQueries.length}`
  );
  console.log(
    `   Real queries processed: ${processedCount}/${realQueries.length}`
  );
  console.log(
    `   Total intercepted queries: ${interceptor.interceptedQueries.length}`
  );
  console.log(
    `   Expected intercepted: ${realQueries.length} (only real queries)`
  );

  const success =
    filteredCount === healthCheckQueries.length &&
    processedCount === realQueries.length &&
    interceptor.interceptedQueries.length === realQueries.length;

  console.log(
    `   Health check filtering ${success ? "✅ WORKING" : "❌ NOT WORKING"}`
  );

  // Test disabling health check filtering
  console.log("\n🚫 Testing with health check filtering disabled...");
  interceptor.updateSettings({ filterHealthChecks: false });

  const healthCheckQuery = {
    type: "SELECT",
    sql: "SELECT NOW()",
    isQuery: true,
  };

  const resultWithFilteringDisabled = interceptor.processQuery(
    "disabled-conn",
    healthCheckQuery,
    proxyConfig
  );
  if (resultWithFilteringDisabled !== null) {
    console.log("   ✅ Health check query processed when filtering disabled");
  } else {
    console.log(
      "   ❌ Health check query still filtered when filtering disabled"
    );
  }

  console.log(
    `\n   Final total queries: ${interceptor.interceptedQueries.length}`
  );
  console.log("🎉 Health check filtering test completed!");
}

// Run the test
if (require.main === module) {
  testHealthCheckFiltering().catch(console.error);
}

module.exports = { testHealthCheckFiltering };
