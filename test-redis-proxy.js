const redis = require("redis");

/**
 * Test script for Redis database proxy functionality
 * This script tests the Redis proxy by connecting through the proxy port
 * and executing various Redis commands to verify interception works correctly.
 */

async function testRedisProxy() {
  console.log("🔴 Testing Redis Database Proxy...");

  // Connect to Redis through the proxy port (16379) instead of direct port (6379)
  const client = redis.createClient({
    socket: {
      host: "localhost",
      port: 16379, // Proxy port
    },
    password: "testpass",
  });

  client.on("error", (err) => {
    console.error("❌ Redis Client Error:", err);
  });

  client.on("connect", () => {
    console.log("✅ Connected to Redis proxy on port 16379");
  });

  try {
    await client.connect();
    console.log("🔌 Redis proxy connection established");

    // Test basic string operations
    console.log("\n📝 Testing String Operations:");

    // SET operation
    console.log('  - Setting key "test:user:1" to "John Doe"');
    await client.set("test:user:1", "John Doe");

    // GET operation
    console.log('  - Getting key "test:user:1"');
    const value = await client.get("test:user:1");
    console.log(`  ✅ Retrieved: ${value}`);

    // INCR operation
    console.log("  - Incrementing counter");
    await client.set("test:counter", "0");
    const counter = await client.incr("test:counter");
    console.log(`  ✅ Counter value: ${counter}`);

    // Test hash operations
    console.log("\n📊 Testing Hash Operations:");

    // HSET operation
    console.log("  - Setting hash fields");
    await client.hSet("test:user:profile:1", {
      name: "John Doe",
      email: "john@example.com",
      age: "30",
    });

    // HGET operation
    console.log("  - Getting hash field");
    const name = await client.hGet("test:user:profile:1", "name");
    console.log(`  ✅ Retrieved name: ${name}`);

    // HGETALL operation
    console.log("  - Getting all hash fields");
    const profile = await client.hGetAll("test:user:profile:1");
    console.log(`  ✅ Full profile:`, profile);

    // Test list operations
    console.log("\n📝 Testing List Operations:");

    // LPUSH operation
    console.log("  - Pushing to list");
    await client.lPush("test:tasks", "Task 1");
    await client.lPush("test:tasks", "Task 2");
    await client.lPush("test:tasks", "Task 3");

    // LRANGE operation
    console.log("  - Getting list range");
    const tasks = await client.lRange("test:tasks", 0, -1);
    console.log(`  ✅ Tasks list:`, tasks);

    // LPOP operation
    console.log("  - Popping from list");
    const task = await client.lPop("test:tasks");
    console.log(`  ✅ Popped task: ${task}`);

    // Test set operations
    console.log("\n🔢 Testing Set Operations:");

    // SADD operation
    console.log("  - Adding to set");
    await client.sAdd("test:tags", ["redis", "database", "cache", "nosql"]);

    // SMEMBERS operation
    console.log("  - Getting set members");
    const tags = await client.sMembers("test:tags");
    console.log(`  ✅ Tags set:`, tags);

    // SCARD operation
    console.log("  - Getting set size");
    const setSize = await client.sCard("test:tags");
    console.log(`  ✅ Set size: ${setSize}`);

    // Test key operations
    console.log("\n🔑 Testing Key Operations:");

    // EXISTS operation
    console.log("  - Checking key existence");
    const exists = await client.exists("test:user:1");
    console.log(`  ✅ Key exists: ${exists}`);

    // TTL operation
    console.log("  - Setting expiration and checking TTL");
    await client.expire("test:user:1", 300); // 5 minutes
    const ttl = await client.ttl("test:user:1");
    console.log(`  ✅ TTL: ${ttl} seconds`);

    // TYPE operation
    console.log("  - Checking key type");
    const type = await client.type("test:user:profile:1");
    console.log(`  ✅ Key type: ${type}`);

    // Test server operations
    console.log("\n🖥️ Testing Server Operations:");

    // PING operation
    console.log("  - Pinging server");
    const pong = await client.ping();
    console.log(`  ✅ Ping response: ${pong}`);

    // INFO operation
    console.log("  - Getting server info");
    const info = await client.info("server");
    console.log(`  ✅ Server info retrieved (${info.length} bytes)`);

    // Cleanup test keys
    console.log("\n🧹 Cleaning up test keys:");
    const deletedKeys = await client.del([
      "test:user:1",
      "test:counter",
      "test:user:profile:1",
      "test:tasks",
      "test:tags",
    ]);
    console.log(`  ✅ Deleted ${deletedKeys} keys`);

    console.log("\n🎉 All Redis proxy tests completed successfully!");
    console.log("📊 Check the Sniffler UI to see intercepted Redis commands");
  } catch (error) {
    console.error("❌ Redis proxy test failed:", error);
  } finally {
    await client.quit();
    console.log("👋 Redis connection closed");
  }
}

// Helper function to test Redis proxy with specific operations
async function testRedisProxyOperations() {
  console.log("\n🧪 Testing specific Redis operations through proxy...");

  const client = redis.createClient({
    socket: {
      host: "localhost",
      port: 16379, // Proxy port
    },
    password: "testpass",
  });

  try {
    await client.connect();

    // Test transaction
    console.log("📦 Testing Redis Transaction:");
    const multi = client.multi();
    multi.set("transaction:key1", "value1");
    multi.set("transaction:key2", "value2");
    multi.get("transaction:key1");
    multi.get("transaction:key2");

    const results = await multi.exec();
    console.log("  ✅ Transaction results:", results);

    // Test pub/sub (basic test - actual pub/sub requires multiple connections)
    console.log("📢 Testing Pub/Sub preparation:");
    await client.publish("test:channel", "Hello Redis Proxy!");
    console.log("  ✅ Published message to test:channel");

    // Cleanup
    await client.del(["transaction:key1", "transaction:key2"]);
  } catch (error) {
    console.error("❌ Operations test failed:", error);
  } finally {
    await client.quit();
  }
}

// Run the tests
if (require.main === module) {
  (async () => {
    try {
      await testRedisProxy();
      await testRedisProxyOperations();

      console.log("\n✨ Redis proxy testing complete!");
      console.log("💡 To create a Redis proxy in Sniffler:");
      console.log("   1. Open Sniffler and go to Database Proxies");
      console.log('   2. Click "Add Proxy"');
      console.log('   3. Set Protocol to "Redis"');
      console.log("   4. Set Proxy Port to 16379");
      console.log("   5. Set Target Host to localhost");
      console.log("   6. Set Target Port to 6379");
      console.log("   7. Start the proxy and run this test script");
    } catch (error) {
      console.error("❌ Test execution failed:", error);
      process.exit(1);
    }
  })();
}

module.exports = {
  testRedisProxy,
  testRedisProxyOperations,
};
