/**
 * Test script to verify MongoDB proxy mock type detection fix
 */
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");

async function testMongoDBQueryTypes() {
  console.log("🧪 Testing MongoDB Query Type Detection Fix");
  console.log("==============================================\n");

  const interceptor = new DatabaseProxyInterceptor();

  // Test MongoDB queries that should be properly typed
  const testQueries = [
    "db.users.find()",
    'db.users.find({"status": "active"})',
    'db.orders.insert({"item": "book", "qty": 1})',
    'db.products.update({"_id": "123"}, {"$set": {"price": 29.99}})',
    'db.logs.delete({"date": {"$lt": "2024-01-01"}})',
    'db.events.aggregate([{"$match": {"type": "click"}}])',
    "db.users.count()",
    'db.inventory.distinct("category")',
  ];

  console.log("Testing query type extraction:\n");

  for (const query of testQueries) {
    const detectedType = interceptor.extractQueryType(query);
    const detectedTable = interceptor.extractTableName(query);

    console.log(`Query: ${query}`);
    console.log(`  Type: ${detectedType}`);
    console.log(`  Collection: ${detectedTable}`);
    console.log("");

    // Check if type is being detected properly (not UNKNOWN/OTHER)
    if (detectedType === "UNKNOWN" || detectedType === "OTHER") {
      console.log(`❌ ISSUE: Query type not properly detected for: ${query}`);
    } else {
      console.log(
        `✅ SUCCESS: Query type properly detected as: ${detectedType}`
      );
    }
    console.log("---");
  }

  // Test creating a MongoDB mock to ensure it has the correct type
  console.log("\n🔧 Testing MongoDB Mock Creation:\n");

  try {
    // Create a test MongoDB database proxy
    const proxy = interceptor.createDatabaseProxy({
      port: 27017,
      targetHost: "localhost",
      targetPort: 27018,
      protocol: "mongodb",
      name: "Test MongoDB Proxy",
    });

    console.log("✅ Created MongoDB proxy:", proxy);

    // Add a MongoDB mock
    const mockQuery = 'db.users.find({"status": "active"})';
    const mockResponse = {
      response: {
        data: [
          { _id: "1", name: "John", status: "active" },
          { _id: "2", name: "Jane", status: "active" },
        ],
      },
      enabled: true,
      name: "Active Users Query",
    };

    const mock = interceptor.addDatabaseMock(27017, mockQuery, mockResponse);

    console.log("✅ Created MongoDB mock:");
    console.log(`  ID: ${mock.id}`);
    console.log(`  Type: ${mock.type}`);
    console.log(`  Collection: ${mock.table}`);
    console.log(`  Protocol: ${mock.protocol}`);
    console.log(`  Proxy Name: ${mock.proxyName}`);

    if (mock.type === "UNKNOWN" || mock.type === "OTHER") {
      console.log("❌ ISSUE: Mock still has unknown type!");
      return false;
    } else {
      console.log(`✅ SUCCESS: Mock has proper type: ${mock.type}`);
      return true;
    }
  } catch (error) {
    console.error("❌ Error testing MongoDB mock creation:", error.message);
    return false;
  }
}

// Run the test
testMongoDBQueryTypes()
  .then((success) => {
    if (success) {
      console.log("\n🎉 All MongoDB query type detection tests passed!");
      process.exit(0);
    } else {
      console.log("\n💥 Some tests failed!");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });
