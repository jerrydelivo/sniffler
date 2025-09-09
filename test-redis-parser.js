const RedisParser = require("./apps/main/protocols/redis-parser");

/**
 * Unit tests for Redis Parser
 * This file tests the Redis parser functionality to ensure proper
 * parsing of Redis RESP protocol commands and responses.
 */

function testRedisParser() {
  console.log("🧪 Testing Redis Parser...");

  const parser = new RedisParser();
  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      testsPassed++;
      console.log(`  ✅ ${message}`);
    } else {
      console.log(`  ❌ ${message}`);
    }
  }

  // Test 1: Parse simple GET command
  console.log("\n📝 Testing GET command parsing:");
  const getCommand = Buffer.from("*2\r\n$3\r\nGET\r\n$8\r\ntest:key\r\n");
  const getResult = parser.parseQuery(getCommand);

  assert(getResult.command === "GET", "GET command parsed correctly");
  assert(getResult.args[0] === "test:key", "GET key argument parsed correctly");
  assert(getResult.isQuery === true, "GET identified as query");
  assert(getResult.protocol === "redis", "Protocol identified as Redis");

  // Test 2: Parse SET command
  console.log("\n📝 Testing SET command parsing:");
  const setCommand = Buffer.from(
    "*3\r\n$3\r\nSET\r\n$8\r\ntest:key\r\n$10\r\ntest:value\r\n"
  );
  const setResult = parser.parseQuery(setCommand);

  assert(setResult.command === "SET", "SET command parsed correctly");
  assert(setResult.args[0] === "test:key", "SET key argument parsed correctly");
  assert(
    setResult.args[1] === "test:value",
    "SET value argument parsed correctly"
  );
  assert(setResult.type === "WRITE", "SET identified as WRITE operation");

  // Test 3: Parse HGET command
  console.log("\n📝 Testing HGET command parsing:");
  const hgetCommand = Buffer.from(
    "*3\r\n$4\r\nHGET\r\n$9\r\nuser:1001\r\n$4\r\nname\r\n"
  );
  const hgetResult = parser.parseQuery(hgetCommand);

  assert(hgetResult.command === "HGET", "HGET command parsed correctly");
  assert(hgetResult.args[0] === "user:1001", "HGET hash key parsed correctly");
  assert(hgetResult.args[1] === "name", "HGET field name parsed correctly");
  assert(hgetResult.type === "READ", "HGET identified as READ operation");

  // Test 4: Parse LPUSH command
  console.log("\n📝 Testing LPUSH command parsing:");
  const lpushCommand = Buffer.from(
    "*4\r\n$5\r\nLPUSH\r\n$5\r\ntasks\r\n$6\r\ntask:1\r\n$6\r\ntask:2\r\n"
  );
  const lpushResult = parser.parseQuery(lpushCommand);

  assert(lpushResult.command === "LPUSH", "LPUSH command parsed correctly");
  assert(lpushResult.args[0] === "tasks", "LPUSH list key parsed correctly");
  assert(
    lpushResult.args.length === 3,
    "LPUSH has correct number of arguments"
  );
  assert(lpushResult.type === "WRITE", "LPUSH identified as WRITE operation");

  // Test 5: Parse simple string response
  console.log("\n📝 Testing simple string response parsing:");
  const okResponse = Buffer.from("+OK\r\n");
  const okResult = parser.parseResponse(okResponse);

  assert(
    okResult.type === "Simple String",
    "OK response type identified correctly"
  );
  assert(okResult.value === "OK", "OK response value parsed correctly");
  assert(okResult.isError === false, "OK response not identified as error");

  // Test 6: Parse error response
  console.log("\n📝 Testing error response parsing:");
  const errorResponse = Buffer.from("-ERR unknown command\r\n");
  const errorResult = parser.parseResponse(errorResponse);

  assert(
    errorResult.type === "Error",
    "Error response type identified correctly"
  );
  assert(
    errorResult.value === "ERR unknown command",
    "Error message parsed correctly"
  );
  assert(errorResult.isError === true, "Error response identified as error");

  // Test 7: Parse integer response
  console.log("\n📝 Testing integer response parsing:");
  const intResponse = Buffer.from(":42\r\n");
  const intResult = parser.parseResponse(intResponse);

  assert(
    intResult.type === "Integer",
    "Integer response type identified correctly"
  );
  assert(intResult.value === 42, "Integer value parsed correctly");
  assert(
    intResult.isError === false,
    "Integer response not identified as error"
  );

  // Test 8: Parse bulk string response
  console.log("\n📝 Testing bulk string response parsing:");
  const bulkResponse = Buffer.from("$10\r\ntest:value\r\n");
  const bulkResult = parser.parseResponse(bulkResponse);

  assert(
    bulkResult.type === "Bulk String",
    "Bulk string response type identified correctly"
  );
  assert(
    bulkResult.value === "test:value",
    "Bulk string value parsed correctly"
  );

  // Test 9: Parse null bulk string response
  console.log("\n📝 Testing null bulk string response parsing:");
  const nullResponse = Buffer.from("$-1\r\n");
  const nullResult = parser.parseResponse(nullResponse);

  assert(
    nullResult.type === "Bulk String",
    "Null bulk string response type identified correctly"
  );
  assert(nullResult.value === null, "Null value parsed correctly");

  // Test 10: Generate mock response
  console.log("\n📝 Testing mock response generation:");
  const mockData = {
    response: {
      value: "mocked:value",
      isError: false,
    },
  };
  const mockResponse = parser.generateMockResponse(mockData, {
    command: "GET",
  });

  assert(Buffer.isBuffer(mockResponse), "Mock response is a buffer");
  assert(mockResponse.length > 0, "Mock response has content");

  // Test 11: Test command categorization
  console.log("\n📝 Testing command categorization:");
  const pingCommand = Buffer.from("*1\r\n$4\r\nPING\r\n");
  const pingResult = parser.parseQuery(pingCommand);

  assert(pingResult.command === "PING", "PING command parsed correctly");
  assert(
    pingResult.type === "CONNECTION",
    "PING categorized as CONNECTION command"
  );
  assert(pingResult.isQuery === false, "PING not identified as data query");

  // Test 12: Test SQL-like representation
  console.log("\n📝 Testing SQL-like representation:");
  assert(
    getResult.sql.includes("SELECT"),
    "GET command has SQL-like SELECT representation"
  );
  assert(
    setResult.sql.includes("INSERT"),
    "SET command has SQL-like INSERT representation"
  );
  assert(
    hgetResult.sql.includes("SELECT"),
    "HGET command has SQL-like SELECT representation"
  );

  // Summary
  console.log("\n📊 Test Results:");
  console.log(`  ✅ Passed: ${testsPassed}/${totalTests} tests`);

  if (testsPassed === totalTests) {
    console.log("🎉 All Redis parser tests passed!");
    return true;
  } else {
    console.log("❌ Some Redis parser tests failed!");
    return false;
  }
}

// Test Redis parser integration
function testRedisParserIntegration() {
  console.log("\n🔧 Testing Redis Parser Integration...");

  const parser = new RedisParser();

  // Test multiple commands in buffer
  console.log("\n📦 Testing multiple commands parsing:");
  const multiCommandBuffer = Buffer.concat([
    Buffer.from("*2\r\n$3\r\nGET\r\n$4\r\nkey1\r\n"),
    Buffer.from("*3\r\n$3\r\nSET\r\n$4\r\nkey2\r\n$6\r\nvalue2\r\n"),
    Buffer.from("*2\r\n$4\r\nPING\r\n$0\r\n\r\n"),
  ]);

  const commands = parser.parseQueries(multiCommandBuffer);
  console.log(`  ✅ Parsed ${commands.length} commands from buffer`);

  commands.forEach((cmd, index) => {
    console.log(`    ${index + 1}. ${cmd.command} (${cmd.type})`);
  });

  // Test command encoding/decoding round trip
  console.log("\n🔄 Testing command round-trip:");
  const testCommands = [
    ["GET", "test:key"],
    ["SET", "test:key", "test:value"],
    ["HGET", "user:1", "name"],
    ["LPUSH", "queue", "item1", "item2"],
    ["SADD", "tags", "redis", "cache"],
  ];

  testCommands.forEach(([command, ...args]) => {
    // Create RESP format command
    const respCommand = parser.encodeArray([command, ...args]);

    // Parse it back
    const parsed = parser.parseQuery(respCommand);

    console.log(
      `  ✅ ${command}: ${args.join(", ")} -> ${
        parsed.command
      }: ${parsed.args.join(", ")}`
    );
  });

  console.log("\n✨ Redis parser integration tests complete!");
}

// Run tests if this file is executed directly
if (require.main === module) {
  try {
    const success = testRedisParser();
    testRedisParserIntegration();

    if (success) {
      console.log("\n🚀 Redis parser is ready for use!");
      console.log("💡 Next steps:");
      console.log("   1. Start Sniffler application");
      console.log("   2. Create a Redis database proxy");
      console.log(
        "   3. Run test-redis-proxy.js to verify proxy functionality"
      );
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

module.exports = {
  testRedisParser,
  testRedisParserIntegration,
};
