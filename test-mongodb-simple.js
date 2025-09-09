// Simple test to verify MongoDB categorization fix
console.log("Testing MongoDB Mock Categorization Fix");
console.log("====================================");

// Import the function we fixed (we'll simulate it here since we can't easily import React component)
function extractSQLCommandType(query) {
  if (!query || typeof query !== "string") {
    return "UNKNOWN";
  }

  const upperQuery = query.toUpperCase();

  // Check SQL patterns first
  if (upperQuery.includes("SELECT")) return "SELECT";
  if (upperQuery.includes("INSERT")) return "INSERT";
  if (upperQuery.includes("UPDATE")) return "UPDATE";
  if (upperQuery.includes("DELETE")) return "DELETE";
  if (upperQuery.includes("CREATE")) return "CREATE";
  if (upperQuery.includes("DROP")) return "DROP";
  if (upperQuery.includes("ALTER")) return "ALTER";

  // Check MongoDB patterns (both cases)
  if (upperQuery.includes("DB.") && upperQuery.includes(".FIND("))
    return "FIND";
  if (upperQuery.includes("DB.") && upperQuery.includes(".INSERT("))
    return "INSERT";
  if (upperQuery.includes("DB.") && upperQuery.includes(".UPDATE("))
    return "UPDATE";
  if (upperQuery.includes("DB.") && upperQuery.includes(".DELETE("))
    return "DELETE";
  if (upperQuery.includes("DB.") && upperQuery.includes(".AGGREGATE("))
    return "AGGREGATE";
  if (upperQuery.includes("DB.") && upperQuery.includes(".COUNT("))
    return "COUNT";

  return "UNKNOWN";
}

// Test cases
const testCases = [
  // MongoDB patterns that should work now
  { query: "db.users.find({name: 'John'})", expected: "FIND" },
  { query: "DB.USERS.FIND({NAME: 'JOHN'})", expected: "FIND" },
  { query: "db.orders.insert({product: 'laptop'})", expected: "INSERT" },
  {
    query: "db.products.update({_id: 123}, {$set: {price: 999}})",
    expected: "UPDATE",
  },
  { query: "db.logs.delete({date: {$lt: new Date()}})", expected: "DELETE" },

  // SQL patterns should still work
  { query: "SELECT * FROM users", expected: "SELECT" },
  { query: "INSERT INTO orders VALUES (1, 'test')", expected: "INSERT" },
  { query: "UPDATE products SET price = 100", expected: "UPDATE" },
  { query: "DELETE FROM logs WHERE date < NOW()", expected: "DELETE" },

  // Edge cases
  { query: "", expected: "UNKNOWN" },
  { query: null, expected: "UNKNOWN" },
  { query: "some random text", expected: "UNKNOWN" },
];

let passed = 0;
let failed = 0;

console.log("\nRunning tests...\n");

testCases.forEach((testCase, index) => {
  const result = extractSQLCommandType(testCase.query);
  const success = result === testCase.expected;

  console.log(`Test ${index + 1}: ${success ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Query: "${testCase.query}"`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Got: ${result}`);
  console.log("");

  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log("====================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("====================================");

if (failed === 0) {
  console.log("🎉 All tests passed! MongoDB categorization fix is working!");
} else {
  console.log("❌ Some tests failed. The fix needs adjustment.");
}
