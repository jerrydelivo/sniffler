/**
 * Enhanced debugging script for phantom outgoing request investigation
 *
 * This script provides detailed investigation of when and how phantom requests are created.
 * Run this IMMEDIATELY after Sniffler startup to catch phantom requests.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

async function debugPhantomRequests() {
  try {
    console.log("🔍 PHANTOM REQUEST DEBUGGING STARTED");
    console.log("=".repeat(60));
    console.log("🕐 Current time:", new Date().toISOString());

    // Get Sniffler data directory
    const userDataPath = path.join(os.homedir(), ".sniffler");
    const outgoingRequestsDir = path.join(
      userDataPath,
      "sniffler-data",
      "outgoing",
      "requests"
    );

    console.log("📂 Checking directory:", outgoingRequestsDir);

    if (!fs.existsSync(outgoingRequestsDir)) {
      console.log("❌ Directory does not exist - no requests found");
      return;
    }

    const files = fs.readdirSync(outgoingRequestsDir);
    console.log(`📋 Found ${files.length} request files:`, files);

    if (files.length === 0) {
      console.log("✅ No request files found - no phantom requests");
      return;
    }

    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    console.log("\n⏰ Time windows:");
    console.log(
      `   Last 30 seconds: ${thirtySecondsAgo.toISOString()} to ${now.toISOString()}`
    );
    console.log(
      `   Last 1 minute: ${oneMinuteAgo.toISOString()} to ${now.toISOString()}`
    );
    console.log(
      `   Last 5 minutes: ${fiveMinutesAgo.toISOString()} to ${now.toISOString()}`
    );

    let totalRequests = 0;
    let last30SecRequests = 0;
    let last1MinRequests = 0;
    let last5MinRequests = 0;
    let phantomRequests = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(outgoingRequestsDir, file);
      console.log(`\n📄 Analyzing file: ${file}`);

      try {
        const content = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(content);
        const requests = data.requests || [];

        console.log(`   Total requests in file: ${requests.length}`);
        console.log(
          `   Proxy Port: ${data.systemId || file.replace(".json", "")}`
        );

        totalRequests += requests.length;

        // Analyze each request
        requests.forEach((request, index) => {
          const requestTime = new Date(request.timestamp);
          const ageMs = now.getTime() - requestTime.getTime();
          const ageSeconds = Math.floor(ageMs / 1000);

          let category = "";
          if (requestTime > thirtySecondsAgo) {
            last30SecRequests++;
            category = "🔥 VERY RECENT (< 30s)";
          } else if (requestTime > oneMinuteAgo) {
            last1MinRequests++;
            category = "🔥 RECENT (< 1min)";
          } else if (requestTime > fiveMinutesAgo) {
            last5MinRequests++;
            category = "⏰ RECENT (< 5min)";
          } else {
            category = "📜 OLD";
          }

          if (requestTime > thirtySecondsAgo) {
            console.log(`\n   ${category} REQUEST #${index + 1}:`);
            console.log(
              `      Time: ${request.timestamp} (${ageSeconds}s ago)`
            );
            console.log(`      Method: ${request.method}`);
            console.log(`      URL: ${request.url}`);
            console.log(`      Status: ${request.status}`);
            console.log(`      Proxy Port: ${request.proxyPort}`);
            console.log(`      Request ID: ${request.id}`);

            // Check if this looks like a phantom request
            if (ageSeconds < 60) {
              phantomRequests.push({
                file,
                request,
                ageSeconds,
                category,
              });
            }
          }
        });
      } catch (error) {
        console.error(`❌ Error reading ${file}:`, error.message);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 ANALYSIS RESULTS:");
    console.log("=".repeat(60));
    console.log(`Total requests across all files: ${totalRequests}`);
    console.log(`Requests in last 30 seconds: ${last30SecRequests}`);
    console.log(`Requests in last 1 minute: ${last1MinRequests}`);
    console.log(`Requests in last 5 minutes: ${last5MinRequests}`);
    console.log(`Potential phantom requests: ${phantomRequests.length}`);

    if (phantomRequests.length > 0) {
      console.log("\n🚨 PHANTOM REQUEST ANALYSIS:");
      phantomRequests.forEach((phantom, index) => {
        console.log(`\n   PHANTOM #${index + 1}:`);
        console.log(`   File: ${phantom.file}`);
        console.log(`   Age: ${phantom.ageSeconds} seconds`);
        console.log(`   Time: ${phantom.request.timestamp}`);
        console.log(`   URL: ${phantom.request.method} ${phantom.request.url}`);
        console.log(`   ID Pattern: ${phantom.request.id}`);

        // Analyze the request ID pattern
        if (phantom.request.id.includes("outgoing-")) {
          const idParts = phantom.request.id.split("-");
          if (idParts.length >= 2) {
            const idTimestamp = parseInt(idParts[1]);
            const idTime = new Date(idTimestamp);
            console.log(`   ID Timestamp: ${idTime.toISOString()}`);
            console.log(
              `   Time diff: ${Math.abs(
                idTimestamp - new Date(phantom.request.timestamp).getTime()
              )}ms`
            );
          }
        }
      });

      console.log("\n❌ CONCLUSION: Phantom requests detected!");
      console.log(
        "❌ These requests were created recently, likely during startup."
      );
    } else {
      console.log("\n✅ CONCLUSION: No phantom requests detected!");
      console.log("✅ All requests are older than 30 seconds.");
    }

    console.log("\n🔧 NEXT STEPS:");
    if (phantomRequests.length > 0) {
      console.log("1. Check Sniffler console logs for initialization messages");
      console.log(
        '2. Look for "REQUEST HANDLER" or "Creating request ID" messages'
      );
      console.log("3. Verify initialization mode is properly set");
      console.log(
        "4. Check if any actual HTTP requests are being made during startup"
      );
    } else {
      console.log("1. The phantom request fix appears to be working");
      console.log("2. Run this script again after the next Sniffler restart");
    }
  } catch (error) {
    console.error("❌ Debug script error:", error);
  }
}

debugPhantomRequests();
