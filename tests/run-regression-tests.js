#!/usr/bin/env node

/**
 * Regression Test Runner for Proxy Event Timing Bug
 *
 * This script runs specific tests to ensure the bug where requests
 * were not showing up in the UI is permanently fixed.
 *
 * Bug Description:
 * - Requests made through proxy were not appearing in the UI
 * - Tests were passing 100% but UI showed "0 Requests"
 * - Root cause: Request events were only emitted after completion, not at start
 * - Fix: Emit 'request' events immediately when requests start, 'response' events when complete
 */

const { spawn } = require("child_process");
const path = require("path");

const testFiles = [
  "tests/unit/proxy-event-timing.test.js",
  "tests/integration/proxy-ui-communication.integration.test.js",
  "tests/unit/proxy.test.js", // Includes regression tests
];

console.log("🚀 Running Proxy Event Timing Regression Tests...");
console.log("📋 This ensures the UI communication bug never happens again\n");

async function runTests() {
  for (const testFile of testFiles) {
    console.log(`\n📝 Running: ${testFile}`);
    console.log("─".repeat(50));

    try {
      await new Promise((resolve, reject) => {
        const jest = spawn("npx", ["jest", testFile, "--verbose"], {
          stdio: "inherit",
          shell: true,
          cwd: path.resolve(__dirname, ".."),
        });

        jest.on("close", (code) => {
          if (code === 0) {
            console.log(`✅ ${testFile} - PASSED`);
            resolve();
          } else {
            console.log(`❌ ${testFile} - FAILED (exit code: ${code})`);
            reject(new Error(`Test failed with exit code: ${code}`));
          }
        });

        jest.on("error", (error) => {
          console.log(`❌ ${testFile} - ERROR: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`\n💥 Test suite failed: ${testFile}`);
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  console.log("\n🎉 All regression tests passed!");
  console.log("✅ The UI communication bug is confirmed fixed");
  console.log("🔒 Future regressions will be caught by these tests");
}

// Additional validation tests
async function runValidationChecks() {
  console.log("\n🔍 Running additional validation checks...");

  // Check that the proxy.js file contains the fix
  const fs = require("fs").promises;
  const proxyContent = await fs.readFile(
    path.resolve(__dirname, "../apps/main/proxy.js"),
    "utf8"
  );

  const checks = {
    "Emits request event immediately": proxyContent.includes(
      'this.emit("request", request)'
    ),
    "Emits response event separately": proxyContent.includes(
      'this.emit("response"'
    ),
    "Sets pending status initially": proxyContent.includes('status: "pending"'),
    "Updates status to completed":
      proxyContent.includes('status = "completed"') ||
      proxyContent.includes('status: "completed"'),
  };

  console.log("\n📋 Code validation checks:");
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${check}`);
  });

  const allPassed = Object.values(checks).every(Boolean);
  if (!allPassed) {
    console.error("\n❌ Some code validation checks failed!");
    console.error("The fix may have been modified or removed.");
    process.exit(1);
  }

  console.log("\n✅ All code validation checks passed");
}

// Run everything
async function main() {
  try {
    await runValidationChecks();
    await runTests();

    console.log("\n🎯 SUMMARY:");
    console.log("──────────────────────────────────────────");
    console.log("✅ Bug Fix Status: CONFIRMED WORKING");
    console.log("✅ Regression Tests: ALL PASSING");
    console.log("✅ Code Validation: ALL CHECKS PASSED");
    console.log("🔒 Future regressions will be automatically detected");
    console.log("\nBug Prevention Measures:");
    console.log("• Event timing tests validate immediate emission");
    console.log("• UI communication tests verify end-to-end flow");
    console.log("• Integration tests simulate real-world scenarios");
    console.log("• Code validation ensures fix remains in place");
  } catch (error) {
    console.error("\n💥 Regression test suite failed!");
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runTests, runValidationChecks };
