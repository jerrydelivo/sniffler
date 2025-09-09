/**
 * Test script to verify the phantom outgoing request fix
 *
 * This script helps test if the fix for phantom outgoing requests appearing on restart is working.
 *
 * Instructions:
 * 1. Run this before restarting Sniffler to capture current request count
 * 2. Restart Sniffler
 * 3. Run this again to check if any phantom requests appeared
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

async function checkPhantomRequests() {
  try {
    // Get Sniffler data directory
    const userDataPath = path.join(os.homedir(), ".sniffler");
    const outgoingRequestsDir = path.join(
      userDataPath,
      "sniffler-data",
      "outgoing",
      "requests"
    );

    console.log("🔍 Checking for phantom outgoing requests...");
    console.log("📂 Outgoing requests directory:", outgoingRequestsDir);

    // Check if the directory exists
    if (!fs.existsSync(outgoingRequestsDir)) {
      console.log(
        "✅ No outgoing requests directory found - no phantom requests possible"
      );
      return;
    }

    // Read all request files
    const files = fs.readdirSync(outgoingRequestsDir);
    console.log(`📋 Found ${files.length} proxy request files`);

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000); // Check last 1 minute
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    let totalRequests = 0;
    let veryRecentRequests = 0; // Within 1 minute
    let recentRequests = 0;
    let suspiciousRequests = 0;

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(outgoingRequestsDir, file);
        const content = fs.readFileSync(filePath, "utf8");

        try {
          const data = JSON.parse(content);
          const requests = data.requests || [];
          totalRequests += requests.length;

          // Check for recent requests (within last 5 minutes)
          for (const request of requests) {
            const requestTime = new Date(request.timestamp);

            if (requestTime > fiveMinutesAgo) {
              recentRequests++;

              // Check if this looks like a phantom request
              // Phantom requests typically have current timestamps but old URLs/patterns
              if (
                request.timestamp &&
                request.id &&
                request.method &&
                request.url
              ) {
                console.log(`⚠️  Recent request found in ${file}:`);
                console.log(`   Time: ${request.timestamp}`);
                console.log(`   Method: ${request.method}`);
                console.log(`   URL: ${request.url}`);
                console.log(`   Status: ${request.status}`);
                console.log(`   ID: ${request.id}`);

                // Check if the request ID pattern suggests it was generated at startup
                if (
                  request.id.includes("outgoing-") &&
                  Math.abs(Date.now() - new Date(request.timestamp).getTime()) <
                    5 * 60 * 1000
                ) {
                  suspiciousRequests++;
                  console.log(
                    `   🚨 SUSPICIOUS: Timestamp matches current time (potential phantom request)`
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error reading ${file}:`, error.message);
        }
      }
    }

    console.log("\n📊 Summary:");
    console.log(`   Total saved requests: ${totalRequests}`);
    console.log(`   Recent requests (last 5 min): ${recentRequests}`);
    console.log(`   Suspicious phantom requests: ${suspiciousRequests}`);

    if (suspiciousRequests === 0) {
      console.log("✅ No phantom requests detected!");
    } else {
      console.log(
        `❌ ${suspiciousRequests} potential phantom request(s) detected`
      );
    }

    console.log("\n🔧 To test the fix:");
    console.log("1. Note the current request counts above");
    console.log("2. Restart Sniffler application");
    console.log("3. Run this script again immediately after restart");
    console.log(
      "4. Compare counts - they should be the same (no new phantom requests)"
    );
  } catch (error) {
    console.error("❌ Error checking phantom requests:", error);
  }
}

// Run the check
checkPhantomRequests();
