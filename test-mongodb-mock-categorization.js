#!/usr/bin/env node

// Test MongoDB mock categorization fix
// This script validates that MongoDB mocks are properly categorized instead of showing as UNKNOWN

// Mock object for testing - simulating the structure used in DatabaseMocksView.jsx
const extractSQLCommandType = (mock) => {
  // Safety check for mock object
  if (!mock || typeof mock !== "object") return "UNKNOWN";

  let queryText = "";

  // Extract query text from pattern
  if (typeof mock.pattern === "string") {
    queryText = mock.pattern;
  } else if (mock.pattern?.sql) {
    queryText = mock.pattern.sql;
  }

  if (!queryText) return "UNKNOWN";

  // Clean the query text
  queryText = queryText.trim();
  const normalizedQuery = queryText.toUpperCase();

  // Handle SQL queries first
  const sqlMatch = queryText
    .toLowerCase()
    .match(
      /^\s*(select|insert|update|delete|create|drop|alter|truncate|grant|revoke|begin|commit|rollback|explain|describe|show|use|set|call|execute|prepare)\b/i
    );

  if (sqlMatch) {
    return sqlMatch[1].toUpperCase();
  }

  // Handle MongoDB queries (formatted as db.collection.operation())
  // Check for both DB. and db. patterns to handle case normalization
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".FIND"))
    return "FIND";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".INSERT"))
    return "INSERT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".UPDATE"))
    return "UPDATE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DELETE"))
    return "DELETE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".AGGREGATE"))
    return "AGGREGATE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".COUNT"))
    return "COUNT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DISTINCT"))
    return "DISTINCT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DROP"))
    return "DROP";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".CREATE"))
    return "CREATE";

  // Also handle lowercase patterns
  const lowerQuery = queryText.toLowerCase();
  if (lowerQuery.includes("db.") && lowerQuery.includes(".find")) return "FIND";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".insert"))
    return "INSERT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".update"))
    return "UPDATE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".delete"))
    return "DELETE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".aggregate"))
    return "AGGREGATE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".count"))
    return "COUNT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".distinct"))
    return "DISTINCT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".drop")) return "DROP";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".create"))
    return "CREATE";

  return "UNKNOWN";
};

// Test cases - various MongoDB and SQL query patterns
const testCases = [
  // MongoDB lowercase patterns
  { pattern: "db.users.find()", expected: "FIND" },
  { pattern: "db.users.find({'status': 'active'})", expected: "FIND" },
  { pattern: "db.orders.insert({'item': 'book'})", expected: "INSERT" },
  {
    pattern: "db.products.update({'_id': '123'}, {'$set': {'price': 29.99}})",
    expected: "UPDATE",
  },
  {
    pattern: "db.logs.delete({'date': {'$lt': '2024-01-01'}})",
    expected: "DELETE",
  },
  {
    pattern: "db.events.aggregate([{'$match': {'type': 'click'}}])",
    expected: "AGGREGATE",
  },
  { pattern: "db.users.count()", expected: "COUNT" },
  { pattern: "db.inventory.distinct('category')", expected: "DISTINCT" },

  // MongoDB uppercase patterns
  { pattern: "DB.USERS.FIND()", expected: "FIND" },
  { pattern: "DB.ORDERS.INSERT({'ITEM': 'BOOK'})", expected: "INSERT" },
  {
    pattern: "DB.PRODUCTS.UPDATE({'_ID': '123'}, {'$SET': {'PRICE': 29.99}})",
    expected: "UPDATE",
  },
  {
    pattern: "DB.LOGS.DELETE({'DATE': {'$LT': '2024-01-01'}})",
    expected: "DELETE",
  },
  {
    pattern: "DB.EVENTS.AGGREGATE([{'$MATCH': {'TYPE': 'CLICK'}}])",
    expected: "AGGREGATE",
  },
  { pattern: "DB.USERS.COUNT()", expected: "COUNT" },
  { pattern: "DB.INVENTORY.DISTINCT('CATEGORY')", expected: "DISTINCT" },

  // SQL patterns (should still work)
  { pattern: "SELECT * FROM users", expected: "SELECT" },
  { pattern: "INSERT INTO users (name) VALUES ('John')", expected: "INSERT" },
  {
    pattern: "UPDATE users SET name = 'Jane' WHERE id = 1",
    expected: "UPDATE",
  },
  { pattern: "DELETE FROM users WHERE id = 1", expected: "DELETE" },
  { pattern: "CREATE TABLE test (id INT)", expected: "CREATE" },
  { pattern: "DROP TABLE test", expected: "DROP" },

  // Edge cases
  { pattern: "", expected: "UNKNOWN" },
  { pattern: "   ", expected: "UNKNOWN" },
  { pattern: "invalid query", expected: "UNKNOWN" },
  { pattern: "db.collection.unknownOperation()", expected: "UNKNOWN" },
];

console.log("🧪 Testing MongoDB Mock Categorization Fix");
console.log("===========================================\n");

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const mock = { pattern: testCase.pattern };
  const result = extractSQLCommandType(mock);
  const success = result === testCase.expected;

  if (success) {
    console.log(`✅ Test ${index + 1}: "${testCase.pattern}" → ${result}`);
    passed++;
  } else {
    console.log(
      `❌ Test ${index + 1}: "${testCase.pattern}" → ${result} (expected: ${
        testCase.expected
      })`
    );
    failed++;
  }
});

console.log("\n===========================================");
console.log(`📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(
  `   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
);

if (failed === 0) {
  console.log(
    "\n🎉 All tests passed! MongoDB mocks should now be properly categorized."
  );
} else {
  console.log("\n⚠️  Some tests failed. Please check the implementation.");
  process.exit(1);
}
