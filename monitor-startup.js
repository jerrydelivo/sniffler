/**
 * Real-time Sniffler startup monitoring script
 *
 * This script continuously monitors for file changes during Sniffler startup
 * to catch phantom requests as they're created.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

let monitoring = false;
let startTime = new Date();
const userDataPath = path.join(os.homedir(), ".sniffler");
const outgoingRequestsDir = path.join(
  userDataPath,
  "sniffler-data",
  "outgoing",
  "requests"
);

console.log("🕵️ Starting real-time phantom request monitor...");
console.log("📅 Monitor started at:", startTime.toISOString());
console.log("📂 Watching directory:", outgoingRequestsDir);
console.log("⏰ Will monitor for 5 minutes...");
console.log("");
console.log("👀 Start Sniffler now to see phantom requests in real-time!");
console.log("");

// Ensure directory exists for watching
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
if (!fs.existsSync(outgoingRequestsDir)) {
  fs.mkdirSync(outgoingRequestsDir, { recursive: true });
}

// Function to analyze a request file
function analyzeRequestFile(filePath, eventType = "change") {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`📂 File deleted: ${path.basename(filePath)}`);
      return;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);
    const requests = data.requests || [];

    const now = new Date();
    const monitorStart = startTime;

    console.log(
      `\n📄 File ${eventType}: ${path.basename(
        filePath
      )} at ${now.toISOString()}`
    );
    console.log(`   Total requests: ${requests.length}`);
    console.log(`   Proxy: ${data.systemId || "unknown"}`);

    // Look for requests created since monitoring started
    const newRequests = requests.filter((req) => {
      const reqTime = new Date(req.timestamp);
      return reqTime >= monitorStart;
    });

    if (newRequests.length > 0) {
      console.log(`\n🚨 DETECTED ${newRequests.length} NEW REQUEST(S):`);
      newRequests.forEach((req, index) => {
        const reqTime = new Date(req.timestamp);
        const ageMs = now.getTime() - reqTime.getTime();

        console.log(`\n   🔥 NEW REQUEST #${index + 1}:`);
        console.log(`      Time: ${req.timestamp}`);
        console.log(`      Age: ${Math.floor(ageMs / 1000)} seconds`);
        console.log(`      Method: ${req.method}`);
        console.log(`      URL: ${req.url}`);
        console.log(`      Status: ${req.status}`);
        console.log(`      ID: ${req.id}`);
        console.log(`      Proxy Port: ${req.proxyPort}`);

        // Check if this is likely a phantom request
        if (ageMs < 10000) {
          // Less than 10 seconds old
          console.log(
            `      🚨 PHANTOM SUSPECT: Created ${Math.floor(
              ageMs / 1000
            )}s ago!`
          );
        }
      });
    }
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
  }
}

// Initial scan of existing files
console.log("🔍 Initial scan of existing files...");
if (fs.existsSync(outgoingRequestsDir)) {
  const existingFiles = fs.readdirSync(outgoingRequestsDir);
  console.log(`Found ${existingFiles.length} existing files:`, existingFiles);

  existingFiles.forEach((file) => {
    if (file.endsWith(".json")) {
      analyzeRequestFile(path.join(outgoingRequestsDir, file), "existing");
    }
  });
} else {
  console.log("📂 Outgoing requests directory does not exist yet");
}

console.log("\n🎯 Now monitoring for real-time changes...");
console.log("═".repeat(60));

// Watch for file system changes
let watcher;
try {
  watcher = fs.watch(
    outgoingRequestsDir,
    { recursive: true },
    (eventType, filename) => {
      if (!filename || !filename.endsWith(".json")) return;

      const filePath = path.join(outgoingRequestsDir, filename);
      const now = new Date();

      console.log(
        `\n⚡ File system event: ${eventType} on ${filename} at ${now.toISOString()}`
      );

      // Wait a moment for the file write to complete
      setTimeout(() => {
        analyzeRequestFile(filePath, eventType);
      }, 100);
    }
  );

  console.log("👁️ File watcher active!");
} catch (error) {
  console.error("❌ Could not start file watcher:", error.message);
  console.log("📋 Will check periodically instead...");

  // Fallback to periodic checking
  setInterval(() => {
    if (fs.existsSync(outgoingRequestsDir)) {
      const files = fs.readdirSync(outgoingRequestsDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          analyzeRequestFile(
            path.join(outgoingRequestsDir, file),
            "periodic check"
          );
        }
      });
    }
  }, 2000); // Check every 2 seconds
}

// Auto-stop after 5 minutes
setTimeout(() => {
  console.log("\n⏰ Monitoring period ended (5 minutes)");
  console.log("🛑 Stopping monitor...");

  if (watcher) {
    watcher.close();
  }

  console.log("✅ Monitor stopped");
  process.exit(0);
}, 5 * 60 * 1000);

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n🛑 Monitor stopped by user");
  if (watcher) {
    watcher.close();
  }
  process.exit(0);
});

console.log("");
console.log("💡 INSTRUCTIONS:");
console.log("   1. Keep this terminal open");
console.log("   2. Start Sniffler in another terminal/window");
console.log("   3. Watch this monitor for real-time phantom request detection");
console.log("   4. Press Ctrl+C to stop monitoring");
console.log("");
