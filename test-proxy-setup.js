const { Client } = require("pg");
const http = require("http");
const https = require("https");

// ANSI color codes for better output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, "green");
}

function error(message) {
  log(`❌ ${message}`, "red");
}

function info(message) {
  log(`ℹ️  ${message}`, "blue");
}

function warning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function header(message) {
  log(`\n${"=".repeat(60)}`, "cyan");
  log(`${message}`, "cyan");
  log(`${"=".repeat(60)}`, "cyan");
}

async function testProxy(port, targetPort, name, expectedTarget) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: port,
        path: "/test",
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        success(`${name} proxy on port ${port} is responding`);
        if (targetPort) {
          info(`  └─ Should forward to localhost:${targetPort}`);
        }
        resolve(true);
      }
    );

    req.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        error(`${name} proxy on port ${port} is not running`);
      } else {
        error(`${name} proxy on port ${port} error: ${err.message}`);
      }
      resolve(false);
    });

    req.on("timeout", () => {
      error(`${name} proxy on port ${port} timed out`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function testDatabaseProxy(port, description) {
  try {
    info(`Testing database connection through proxy on port ${port}...`);

    const client = new Client({
      host: "localhost",
      port: port,
      user: "postgres",
      password: "postgres",
      database: "postgres",
      connectionTimeoutMillis: 5000,
    });

    await client.connect();
    success(`${description} database proxy connection established`);

    const startTime = Date.now();
    const result = await client.query(
      "SELECT CURRENT_TIMESTAMP as test_time, 'PROXY VALIDATION TEST' as description"
    );
    const duration = Date.now() - startTime;

    success(`${description} database query executed in ${duration}ms`);
    info(`  └─ Result: ${JSON.stringify(result.rows[0], null, 2)}`);

    await client.end();
    success(`${description} database proxy connection closed`);
    return true;
  } catch (err) {
    error(`${description} database proxy failed: ${err.message}`);
    return false;
  }
}

async function testOutgoingProxy(port, targetUrl, name) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: port,
        path: "/posts/1",
        method: "GET",
        timeout: 10000,
      },
      (res) => {
        success(`${name} outgoing proxy on port ${port} is responding`);
        info(`  └─ Should forward to ${targetUrl}`);
        info(`  └─ Response status: ${res.statusCode}`);
        resolve(true);
      }
    );

    req.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        error(`${name} outgoing proxy on port ${port} is not running`);
      } else {
        error(`${name} outgoing proxy on port ${port} error: ${err.message}`);
      }
      resolve(false);
    });

    req.on("timeout", () => {
      error(`${name} outgoing proxy on port ${port} timed out`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function testRealTimeEventFlow() {
  header("TESTING REAL-TIME EVENT FLOW");

  info(
    "This test will run multiple database queries and check if they appear in UI..."
  );

  const testQueries = [
    "SELECT 1 as test_number, 'First real-time test' as description",
    "SELECT 2 as test_number, 'Second real-time test' as description",
    "SELECT 3 as test_number, 'Third real-time test' as description",
  ];

  let successCount = 0;

  for (let i = 0; i < testQueries.length; i++) {
    try {
      info(`Executing test query ${i + 1}/${testQueries.length}...`);

      const client = new Client({
        host: "localhost",
        port: 4445,
        user: "postgres",
        password: "postgres",
        database: "postgres",
      });

      await client.connect();
      const startTime = Date.now();
      const result = await client.query(testQueries[i]);
      const duration = Date.now() - startTime;

      success(`Query ${i + 1} executed in ${duration}ms`);
      info(`  └─ Result: ${JSON.stringify(result.rows[0])}`);

      await client.end();
      successCount++;

      // Wait a bit between queries to see real-time updates
      if (i < testQueries.length - 1) {
        info("Waiting 2 seconds before next query...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      error(`Query ${i + 1} failed: ${err.message}`);
    }
  }

  if (successCount === testQueries.length) {
    success(`All ${successCount} test queries executed successfully`);
    info(
      "📋 Check the UI 'Requests' tab to see if these queries appear in real-time!"
    );
    info("📋 The database proxy should show more intercepted requests");
  } else {
    warning(`${successCount}/${testQueries.length} queries succeeded`);
  }
}

async function main() {
  header("SNIFFLER PROXY SETUP VALIDATION TEST");

  info("This test validates the complete proxy setup for Sniffler:");
  info("• HTTP Proxy (port 4000 → localhost:3009)");
  info("• Outgoing Requests Proxy (port 4444 → external APIs)");
  info("• Database Proxy (port 4445 → PostgreSQL)");
  info("• Real-time UI event flow");

  let allPassed = true;

  // Test 1: HTTP Proxy
  header("1. TESTING HTTP PROXY");
  const httpProxyResult = await testProxy(4000, 3009, "HTTP", "localhost:3009");
  if (!httpProxyResult) allPassed = false;

  // Test 2: Outgoing Requests Proxy
  header("2. TESTING OUTGOING REQUESTS PROXY");
  const outgoingProxyResult = await testOutgoingProxy(
    4444,
    "https://jsonplaceholder.typicode.com",
    "Outgoing"
  );
  if (!outgoingProxyResult) allPassed = false;

  // Test 3: Database Proxy
  header("3. TESTING DATABASE PROXY");
  const databaseProxyResult = await testDatabaseProxy(4445, "PostgreSQL");
  if (!databaseProxyResult) allPassed = false;

  // Test 4: Real-time Event Flow
  if (databaseProxyResult) {
    await testRealTimeEventFlow();
  } else {
    warning("Skipping real-time event flow test due to database proxy failure");
  }

  // Final Summary
  header("TEST SUMMARY");
  if (allPassed) {
    success("🎉 ALL PROXY TESTS PASSED!");
    info("Your Sniffler setup is working correctly.");
    info("");
    info("Next steps:");
    info("1. Open the Sniffler UI at http://localhost:8765");
    info("2. Check the 'Requests' tab for real-time database requests");
    info("3. Try making HTTP requests through port 4000");
    info("4. Try making outgoing requests through port 4444");
  } else {
    error("❌ Some proxy tests failed!");
    warning(
      "Please check that 'npm run dev' is running and all services are started."
    );
    info("");
    info("Troubleshooting:");
    info("1. Make sure PostgreSQL is running locally");
    info(
      "2. Check that ports 4000, 4444, 4445 are not in use by other applications"
    );
    info("3. Verify the test server is running on port 3009");
  }
}

// Run the test
main().catch((err) => {
  console.error(
    "\n" + colors.red + "❌ Test runner failed:",
    err.message + colors.reset
  );
  process.exit(1);
});
