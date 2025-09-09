const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🔧 Setting up test environment...");

try {
  // Ensure test directories exist
  const testDirs = [
    "test-results",
    "test-results/screenshots",
    "test-results/videos",
    "test-results/traces",
  ];

  testDirs.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  // Install test dependencies
  console.log("📦 Installing test dependencies...");
  try {
    execSync("npm install", { stdio: "inherit" });
  } catch (error) {
    console.log("⚠️ npm install failed, continuing...");
  }

  // Build the application
  console.log("🔨 Building application...");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch (error) {
    console.log("⚠️ Build failed, continuing...");
  }

  console.log("✅ Test environment setup completed!");
} catch (error) {
  console.error("❌ Test environment setup failed:", error.message);
  process.exit(1);
}
