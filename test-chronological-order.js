const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");

async function testChronologicalOrder() {
  console.log("🧪 Testing chronological order of database requests...");

  const interceptor = new DatabaseProxyInterceptor({
    maxRequestHistory: 100,
    autoSaveRequestsAsMocks: false,
  });

  // Create a database proxy
  interceptor.createDatabaseProxy({
    port: 5432,
    targetHost: "localhost",
    targetPort: 5433,
    protocol: "postgresql",
    name: "Test Postgres Proxy",
  });

  // Simulate adding queries with different timestamps
  const queries = [
    {
      id: "query-1",
      connectionId: "conn-1",
      timestamp: "2025-09-05T10:00:00.000Z",
      proxyPort: 5432,
      query: "SELECT * FROM users WHERE id = 1",
      status: "success",
      startTime: new Date("2025-09-05T10:00:00.000Z").getTime(),
    },
    {
      id: "query-2",
      connectionId: "conn-1",
      timestamp: "2025-09-05T10:05:00.000Z",
      proxyPort: 5432,
      query: "SELECT * FROM products WHERE id = 2",
      status: "success",
      startTime: new Date("2025-09-05T10:05:00.000Z").getTime(),
    },
    {
      id: "query-3",
      connectionId: "conn-1",
      timestamp: "2025-09-05T10:02:00.000Z",
      proxyPort: 5432,
      query: "SELECT * FROM orders WHERE id = 3",
      status: "success",
      startTime: new Date("2025-09-05T10:02:00.000Z").getTime(),
    },
  ];

  // Add queries in mixed order (as they would be loaded from disk)
  console.log("📝 Adding queries in mixed chronological order...");
  for (const query of queries) {
    interceptor.addInterceptedQuery(query, false); // false = don't emit events (like loading from disk)
    console.log(`  Added: ${query.query} (${query.timestamp})`);
  }

  // Test getting all queries - should be sorted newest first
  console.log("\n📋 Getting all intercepted queries...");
  const allQueries = interceptor.getInterceptedQueries();
  console.log("Order of returned queries:");
  allQueries.forEach((q, index) => {
    console.log(`  ${index + 1}. ${q.query} (${q.timestamp})`);
  });

  // Verify order is correct (newest first)
  console.log("\n✅ Verifying chronological order (newest first)...");
  const expectedOrder = [
    "SELECT * FROM products WHERE id = 2", // 10:05 - newest
    "SELECT * FROM orders WHERE id = 3", // 10:02 - middle
    "SELECT * FROM users WHERE id = 1", // 10:00 - oldest
  ];

  let isCorrectOrder = true;
  for (let i = 0; i < expectedOrder.length; i++) {
    if (allQueries[i].query !== expectedOrder[i]) {
      console.log(`❌ Wrong order at position ${i + 1}:`);
      console.log(`   Expected: ${expectedOrder[i]}`);
      console.log(`   Got:      ${allQueries[i].query}`);
      isCorrectOrder = false;
    }
  }

  if (isCorrectOrder) {
    console.log(
      "✅ Chronological order is CORRECT! Newest queries appear first."
    );
  } else {
    console.log("❌ Chronological order is WRONG!");
  }

  // Test getQueriesForProxy as well
  console.log("\n📋 Testing getQueriesForProxy method...");
  const proxyQueries = interceptor.getQueriesForProxy(5432);
  console.log("Order of proxy queries:");
  proxyQueries.forEach((q, index) => {
    console.log(`  ${index + 1}. ${q.query} (${q.timestamp})`);
  });

  // Add a new query (simulating real-time) to ensure it goes to the top
  console.log("\n⚡ Adding a new real-time query...");
  const newQuery = {
    id: "query-4",
    connectionId: "conn-1",
    timestamp: new Date().toISOString(),
    proxyPort: 5432,
    query: "SELECT * FROM new_table",
    status: "success",
    startTime: Date.now(),
  };

  interceptor.addInterceptedQuery(newQuery, true); // true = emit events (like real-time)

  const updatedQueries = interceptor.getInterceptedQueries();
  console.log("Updated order after new query:");
  updatedQueries.forEach((q, index) => {
    console.log(`  ${index + 1}. ${q.query} (${q.timestamp})`);
  });

  // Verify new query is at the top
  if (updatedQueries[0].query === "SELECT * FROM new_table") {
    console.log("✅ New real-time query correctly appears at the top!");
  } else {
    console.log("❌ New real-time query is not at the top!");
  }

  console.log("\n🏁 Test completed!");
}

// Run the test
testChronologicalOrder().catch(console.error);
