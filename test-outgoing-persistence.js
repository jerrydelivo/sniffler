const http = require("http");
const path = require("path");
const fs = require("fs").promises;

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

async function getUserDataPath() {
  // Get user data path (same logic as DataManager)
  try {
    const { app } = require("electron");
    return app.getPath("userData");
  } catch (error) {
    // Fallback for standalone usage
    const os = require("os");
    return path.join(os.homedir(), ".sniffler");
  }
}

async function checkOutgoingRequestFiles() {
  try {
    const userDataPath = await getUserDataPath();
    const outgoingRequestsDir = path.join(
      userDataPath,
      "sniffler-data",
      "outgoing",
      "requests"
    );

    info(`Checking for outgoing request files in: ${outgoingRequestsDir}`);

    try {
      const files = await fs.readdir(outgoingRequestsDir);
      const requestFiles = files.filter((file) => file.endsWith(".json"));

      if (requestFiles.length === 0) {
        warning(
          "No outgoing request files found. This is expected if no requests have been made yet."
        );
        return { found: false, files: [] };
      }

      success(`Found ${requestFiles.length} outgoing request files:`);

      const fileDetails = [];
      for (const file of requestFiles) {
        const filePath = path.join(outgoingRequestsDir, file);
        try {
          const content = await fs.readFile(filePath, "utf8");
          const data = JSON.parse(content);
          const requestCount = data.requests ? data.requests.length : 0;

          info(
            `  📄 ${file}: ${requestCount} requests (last updated: ${
              data.lastUpdated || "unknown"
            })`
          );
          fileDetails.push({
            file,
            requestCount,
            lastUpdated: data.lastUpdated,
            proxyPort: data.proxyPort || data.systemId,
          });
        } catch (parseError) {
          error(`  📄 ${file}: Failed to parse file - ${parseError.message}`);
        }
      }

      return { found: true, files: fileDetails };
    } catch (dirError) {
      if (dirError.code === "ENOENT") {
        warning(
          "Outgoing requests directory doesn't exist yet. This is normal for a fresh installation."
        );
        return { found: false, files: [] };
      }
      throw dirError;
    }
  } catch (error) {
    error(`Failed to check outgoing request files: ${error.message}`);
    return { found: false, files: [], error: error.message };
  }
}

async function makeTestRequest(proxyPort, targetUrl, testPath = "/test") {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: proxyPort,
        path: testPath,
        method: "GET",
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            success: true,
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            url: `http://localhost:${proxyPort}${testPath}`,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        success: false,
        error: err.message,
        url: `http://localhost:${proxyPort}${testPath}`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: "Request timeout",
        url: `http://localhost:${proxyPort}${testPath}`,
      });
    });

    req.end();
  });
}

async function testOutgoingRequestPersistence() {
  header("OUTGOING REQUEST PERSISTENCE TEST");

  info(
    "This test verifies that outgoing requests are properly saved and persist through app restarts."
  );

  // Step 1: Check current state of request files
  info("\n📋 Step 1: Checking current state of outgoing request files...");
  const initialState = await checkOutgoingRequestFiles();

  // Step 2: Test if outgoing proxies are running
  info("\n🔌 Step 2: Testing outgoing proxy connectivity...");

  const commonPorts = [4444, 4000, 8080, 3001];
  let workingProxy = null;

  for (const port of commonPorts) {
    info(`Testing proxy on port ${port}...`);
    const result = await makeTestRequest(
      port,
      `http://localhost:${port}`,
      "/health"
    );

    if (result.success) {
      success(`✅ Proxy on port ${port} is responding`);
      workingProxy = port;
      break;
    } else {
      warning(`⚠️  Proxy on port ${port} is not responding: ${result.error}`);
    }
  }

  if (!workingProxy) {
    error(
      "❌ No working outgoing proxies found. Please start an outgoing proxy first."
    );
    info("💡 To create an outgoing proxy:");
    info("   1. Open Sniffler UI");
    info("   2. Go to Outgoing Proxies tab");
    info("   3. Create a new proxy (e.g., port 4444 -> httpbin.org)");
    info("   4. Start the proxy");
    info("   5. Run this test again");
    return false;
  }

  // Step 3: Make test requests
  info(
    `\n🚀 Step 3: Making test requests through proxy on port ${workingProxy}...`
  );

  const testRequests = ["/get", "/json", "/headers"];

  let requestsMade = 0;
  for (const testPath of testRequests) {
    info(`Making request to ${testPath}...`);
    const result = await makeTestRequest(
      workingProxy,
      `http://localhost:${workingProxy}`,
      testPath
    );

    if (result.success) {
      success(
        `✅ Request to ${testPath} successful (status: ${result.statusCode})`
      );
      requestsMade++;
    } else {
      error(`❌ Request to ${testPath} failed: ${result.error}`);
    }

    // Wait a bit between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (requestsMade === 0) {
    error("❌ No test requests were successful. Cannot test persistence.");
    return false;
  }

  success(`✅ Made ${requestsMade} successful test requests`);

  // Step 4: Check if requests were saved
  info("\n💾 Step 4: Checking if requests were saved to disk...");

  // Wait a moment for auto-save to kick in
  info("Waiting 3 seconds for auto-save...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const afterRequestsState = await checkOutgoingRequestFiles();

  if (!afterRequestsState.found) {
    error("❌ No outgoing request files found after making requests!");
    error(
      "💡 This indicates that outgoing request persistence is not working."
    );
    return false;
  }

  // Look for files related to our test proxy
  const relevantFiles = afterRequestsState.files.filter(
    (file) =>
      file.proxyPort == workingProxy ||
      file.file.includes(workingProxy.toString())
  );

  if (relevantFiles.length === 0) {
    error(`❌ No request files found for proxy port ${workingProxy}`);
    error("💡 Files found for other ports:");
    afterRequestsState.files.forEach((file) => {
      info(
        `   📄 ${file.file} (port: ${file.proxyPort}, requests: ${file.requestCount})`
      );
    });
    return false;
  }

  success(
    `✅ Found ${relevantFiles.length} request file(s) for proxy port ${workingProxy}`
  );

  let totalSavedRequests = 0;
  relevantFiles.forEach((file) => {
    info(`   📄 ${file.file}: ${file.requestCount} requests`);
    totalSavedRequests += file.requestCount;
  });

  if (totalSavedRequests === 0) {
    error("❌ Request files exist but contain no requests!");
    return false;
  }

  success(`✅ Total saved requests: ${totalSavedRequests}`);

  // Step 5: Provide restart instructions
  info("\n🔄 Step 5: Testing persistence through restart...");
  info("To test that requests persist through app restart:");
  info("1. 🛑 Close the Sniffler application");
  info("2. 🚀 Restart the Sniffler application");
  info("3. 📋 Go to the Outgoing Proxies tab");
  info(
    "4. 👀 Check that your previous requests are still visible in the request history"
  );
  info(
    `5. ✅ You should see ${totalSavedRequests} requests from this test session`
  );

  header("TEST COMPLETED SUCCESSFULLY");
  success("✅ Outgoing request persistence appears to be working correctly!");
  success(
    `✅ ${requestsMade} test requests were made and ${totalSavedRequests} were saved to disk`
  );
  info("💡 Now test the restart scenario manually as described above");

  return true;
}

// Run the test
if (require.main === module) {
  testOutgoingRequestPersistence()
    .then((success) => {
      if (success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ Test failed with error:", error);
      process.exit(1);
    });
}

module.exports = { testOutgoingRequestPersistence, checkOutgoingRequestFiles };
