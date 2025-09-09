const { execSync } = require("child_process");

console.log("🧹 Tearing down test environment...");

try {
  // Clean up test data
  console.log("🗑️ Cleaning up test data...");

  // Kill any remaining processes
  if (process.platform === "win32") {
    try {
      execSync("taskkill /F /IM electron.exe /T", { stdio: "pipe" });
    } catch (error) {
      // No processes to kill
    }
  } else {
    try {
      execSync("pkill -f electron", { stdio: "pipe" });
    } catch (error) {
      // No processes to kill
    }
  }

  console.log("✅ Test environment teardown completed!");
} catch (error) {
  console.error("❌ Test environment teardown failed:", error.message);
  // Don't exit with error code in teardown
}
