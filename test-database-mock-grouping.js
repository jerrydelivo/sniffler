#!/usr/bin/env node

/**
 * Simple test script to verify database mock grouping functionality
 */

const DataManager = require("./apps/main/data-manager");
const DatabaseProxyInterceptor = require("./apps/main/database-proxy-interceptor");
const path = require("path");
const fs = require("fs");

async function testDatabaseMockGrouping() {
  console.log("🧪 Testing Database Mock Grouping...\n");

  // Create test data directory
  const testDataPath = path.join(__dirname, "test-data");
  const dataManager = new DataManager();

  // Override data directory for testing
  dataManager.dataDir = testDataPath;
  dataManager.databaseMocksDir = path.join(testDataPath, "database", "mocks");

  // Ensure directories exist
  await dataManager.initialize();

  const interceptor = new DatabaseProxyInterceptor();

  // Create some test database proxies
  const mysqlProxy = interceptor.createDatabaseProxy({
    port: 3306,
    targetHost: "localhost",
    targetPort: 3306,
    protocol: "mysql",
    name: "MySQL Production DB",
  });

  const postgresProxy = interceptor.createDatabaseProxy({
    port: 5432,
    targetHost: "localhost",
    targetPort: 5432,
    protocol: "postgresql",
    name: "PostgreSQL Analytics DB",
  });

  const mongoProxy = interceptor.createDatabaseProxy({
    port: 27017,
    targetHost: "localhost",
    targetPort: 27017,
    protocol: "mongodb",
    name: "MongoDB User Data",
  });

  console.log("✅ Created test database proxies");

  // Create some test mocks for each database
  const mysqlMock1 = interceptor.addDatabaseMock(3306, "SELECT * FROM users", {
    response: { data: [{ id: 1, name: "Alice", email: "alice@example.com" }] },
    enabled: true,
    name: "Get all users",
  });

  const mysqlMock2 = interceptor.addDatabaseMock(
    3306,
    "SELECT COUNT(*) FROM orders",
    {
      response: { data: [{ count: 42 }] },
      enabled: false,
      name: "Count orders",
    }
  );

  const postgresMock1 = interceptor.addDatabaseMock(
    5432,
    "SELECT * FROM analytics_data WHERE date > $1",
    {
      response: { data: [{ date: "2023-01-01", value: 100.5 }] },
      enabled: true,
      name: "Get analytics data",
    }
  );

  const mongoMock1 = interceptor.addDatabaseMock(27017, "db.users.find({})", {
    response: {
      data: [
        { _id: "507f1f77bcf86cd799439011", name: "John", status: "active" },
      ],
    },
    enabled: true,
    name: "Find all users",
  });

  console.log("✅ Created test database mocks");

  // Save the mocks using our new grouped saving logic
  const allMocks = interceptor.getDatabaseMocks();
  await dataManager.saveDatabaseMocks(allMocks);

  console.log("✅ Saved database mocks using grouped logic");

  // Check what files were created
  const mockFiles = fs.readdirSync(dataManager.databaseMocksDir);
  console.log("\n📁 Files created:");
  mockFiles.forEach((file) => {
    console.log(`  - ${file}`);
  });

  // Verify grouped files exist
  const expectedFiles = [
    "MySQL-Production-DB-mocks.json",
    "PostgreSQL-Analytics-DB-mocks.json",
    "MongoDB-User-Data-mocks.json",
    "database-mocks.json", // backward compatibility file
  ];

  let allFilesExist = true;
  console.log("\n✅ Checking expected files:");
  for (const expectedFile of expectedFiles) {
    const exists = mockFiles.includes(expectedFile);
    console.log(`  ${exists ? "✅" : "❌"} ${expectedFile}`);
    if (!exists) allFilesExist = false;
  }

  // Check content of grouped files
  console.log("\n📄 Checking file contents:");

  const mysqlMocksFile = path.join(
    dataManager.databaseMocksDir,
    "MySQL-Production-DB-mocks.json"
  );
  if (fs.existsSync(mysqlMocksFile)) {
    const mysqlData = JSON.parse(fs.readFileSync(mysqlMocksFile, "utf8"));
    console.log(
      `✅ MySQL file: ${mysqlData.mocks.length} mocks for database "${mysqlData.databaseName}"`
    );
    console.log(
      `   Queries: ${mysqlData.mocks
        .map((m) => m.query.substring(0, 30) + "...")
        .join(", ")}`
    );
  }

  const postgresMocksFile = path.join(
    dataManager.databaseMocksDir,
    "PostgreSQL-Analytics-DB-mocks.json"
  );
  if (fs.existsSync(postgresMocksFile)) {
    const postgresData = JSON.parse(fs.readFileSync(postgresMocksFile, "utf8"));
    console.log(
      `✅ PostgreSQL file: ${postgresData.mocks.length} mocks for database "${postgresData.databaseName}"`
    );
    console.log(
      `   Queries: ${postgresData.mocks
        .map((m) => m.query.substring(0, 30) + "...")
        .join(", ")}`
    );
  }

  const mongoMocksFile = path.join(
    dataManager.databaseMocksDir,
    "MongoDB-User-Data-mocks.json"
  );
  if (fs.existsSync(mongoMocksFile)) {
    const mongoData = JSON.parse(fs.readFileSync(mongoMocksFile, "utf8"));
    console.log(
      `✅ MongoDB file: ${mongoData.mocks.length} mocks for database "${mongoData.databaseName}"`
    );
    console.log(
      `   Queries: ${mongoData.mocks
        .map((m) => m.query.substring(0, 30) + "...")
        .join(", ")}`
    );
  }

  // Test loading the mocks back
  console.log("\n🔄 Testing mock loading...");
  const loadedMocks = await dataManager.loadDatabaseMocks();
  console.log(`✅ Loaded ${loadedMocks.length} total mocks`);

  // Verify the mocks are correctly grouped
  const mocksByDatabase = {};
  for (const mock of loadedMocks) {
    const dbName = mock.proxyName || `port-${mock.proxyPort}`;
    if (!mocksByDatabase[dbName]) {
      mocksByDatabase[dbName] = [];
    }
    mocksByDatabase[dbName].push(mock);
  }

  console.log("\n📊 Mocks grouped by database:");
  for (const [dbName, mocks] of Object.entries(mocksByDatabase)) {
    console.log(`  📋 ${dbName}: ${mocks.length} mocks`);
    mocks.forEach((mock) => {
      console.log(
        `    - ${mock.query.substring(0, 50)}... (${
          mock.enabled ? "enabled" : "disabled"
        })`
      );
    });
  }

  // Test loading mocks for specific database
  console.log("\n🎯 Testing specific database mock loading...");
  const mysqlSpecificMocks = await dataManager.loadDatabaseMocksForDatabase(
    "MySQL Production DB"
  );
  console.log(
    `✅ Loaded ${mysqlSpecificMocks.length} mocks specifically for MySQL database`
  );

  // Cleanup test data
  console.log("\n🧹 Cleaning up test data...");
  try {
    fs.rmSync(testDataPath, { recursive: true, force: true });
    console.log("✅ Test data cleaned up");
  } catch (error) {
    console.log("⚠️ Could not clean up test data:", error.message);
  }

  if (
    allFilesExist &&
    loadedMocks.length === 4 &&
    Object.keys(mocksByDatabase).length === 3
  ) {
    console.log(
      "\n🎉 All tests passed! Database mocks are correctly grouped by database name."
    );
    return true;
  } else {
    console.log("\n❌ Some tests failed. Check the output above for details.");
    return false;
  }
}

// Run the test
testDatabaseMockGrouping()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  });
