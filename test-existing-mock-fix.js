/**
 * Test script to verify existing MongoDB mocks with unknown type get corrected
 */
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");

async function testExistingMockRetying() {
  console.log("🔧 Testing Existing Mock Re-typing Fix");
  console.log("=====================================\n");

  const interceptor = new DatabaseProxyInterceptor();

  // Create a MongoDB proxy
  const proxy = interceptor.createDatabaseProxy({
    port: 27017,
    targetHost: "localhost",
    targetPort: 27018,
    protocol: "mongodb",
    name: "Test MongoDB Proxy",
  });

  // Simulate an existing mock with unknown type (as if loaded from old data)
  const existingMockData = {
    id: "test-mock-123",
    proxyPort: 27017,
    query: 'db.users.find({"status": "active"})',
    response: { data: [{ name: "test" }] },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: "Test Mock",
    type: "UNKNOWN", // This simulates old data with unknown type
    table: "unknown", // This simulates old data with unknown table
  };

  // Manually add the mock to simulate loading from storage
  const mockKey = interceptor.generateMockKey(27017, existingMockData.query);
  interceptor.databaseMocks.set(mockKey, existingMockData);

  console.log("📥 Simulated loading existing mock with unknown type:");
  console.log(`  Original Type: ${existingMockData.type}`);
  console.log(`  Original Table: ${existingMockData.table}`);
  console.log("");

  // Now get the mock through the serialization method (which fixes the type)
  const serializedMock = interceptor.createSerializableMock(existingMockData);

  console.log("🔄 After re-serialization (fixes type automatically):");
  console.log(`  Corrected Type: ${serializedMock.type}`);
  console.log(`  Corrected Table: ${serializedMock.table}`);
  console.log(`  Protocol: ${serializedMock.protocol}`);
  console.log("");

  // Verify the type was corrected
  if (serializedMock.type === "FIND" && serializedMock.table === "users") {
    console.log("✅ SUCCESS: Existing mock type was automatically corrected!");
    return true;
  } else {
    console.log("❌ ISSUE: Mock type was not corrected properly");
    console.log(`  Expected type: FIND, got: ${serializedMock.type}`);
    console.log(`  Expected table: users, got: ${serializedMock.table}`);
    return false;
  }
}

// Run the test
testExistingMockRetying()
  .then((success) => {
    if (success) {
      console.log("\n🎉 Existing mock re-typing test passed!");
      console.log(
        "   All existing MongoDB mocks with unknown type will be automatically corrected."
      );
      process.exit(0);
    } else {
      console.log("\n💥 Existing mock re-typing test failed!");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });
