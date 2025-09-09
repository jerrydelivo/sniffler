#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🎨 Sniffler UI Test Suite Runner");
console.log("=================================\n");

// UI Test categories
const uiTestCategories = {
  components: "tests/ui/components/**/*.test.{js,jsx}",
  integration: "tests/ui/integration/**/*.test.{js,jsx}",
  e2e: "tests/ui/e2e/**/*.test.{js,jsx}",
  database: "tests/ui/integration/DatabaseProxy.integration.test.jsx",
  all: "tests/ui/**/*.test.{js,jsx}",
};

const uiTestDescriptions = {
  components: "UI Component Tests",
  integration: "UI Integration Tests",
  e2e: "End-to-End UI Tests",
  database: "Database UI Integration Tests",
  all: "All UI Tests",
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printSeparator() {
  console.log(colorize("─".repeat(80), "cyan"));
}

function checkUIPrerequisites() {
  console.log(colorize("📋 Checking UI Test Prerequisites...", "blue"));

  // Check if Docker is running
  try {
    execSync("docker --version", { stdio: "ignore" });
    console.log(colorize("✓ Docker is available", "green"));
  } catch (error) {
    console.log(colorize("✗ Docker is not available", "yellow"));
    console.log(colorize("  Database UI tests will be skipped", "yellow"));
  }

  // Check if React Testing Library dependencies are available
  const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const hasTestingLibrary =
      packageJson.devDependencies &&
      (packageJson.devDependencies["@testing-library/react"] ||
        packageJson.devDependencies["@testing-library/jest-dom"]);

    if (hasTestingLibrary) {
      console.log(colorize("✓ React Testing Library available", "green"));
    } else {
      console.log(colorize("✗ React Testing Library not found", "red"));
      console.log(
        colorize(
          "  Please run: npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event",
          "yellow"
        )
      );
      process.exit(1);
    }
  }

  // Check if Jest is available
  try {
    execSync("npx jest --version", { stdio: "ignore" });
    console.log(colorize("✓ Jest test runner available", "green"));
  } catch (error) {
    console.log(colorize("✗ Jest not found", "red"));
    console.log(colorize("  Please run: npm install", "yellow"));
    process.exit(1);
  }

  // Check UI test config
  const uiJestConfigPath = path.join(__dirname, "jest.config.js");
  if (fs.existsSync(uiJestConfigPath)) {
    console.log(colorize("✓ UI Jest configuration found", "green"));
  } else {
    console.log(colorize("✗ UI Jest configuration not found", "red"));
    process.exit(1);
  }

  console.log();
}

function installUITestDependencies() {
  console.log(colorize("📦 Installing UI Test Dependencies...", "blue"));

  try {
    // Install testing dependencies if missing
    const dependencies = [
      "@testing-library/react",
      "@testing-library/jest-dom",
      "@testing-library/user-event",
      "esbuild-jest",
      "identity-obj-proxy",
      "jsdom",
    ];

    console.log(colorize(`Installing: ${dependencies.join(", ")}`, "cyan"));
    execSync(`npm install --save-dev ${dependencies.join(" ")}`, {
      stdio: "inherit",
    });

    console.log(colorize("✓ UI test dependencies installed", "green"));
  } catch (error) {
    console.log(colorize("✗ Failed to install dependencies", "red"));
    console.log(colorize(`Error: ${error.message}`, "yellow"));
    process.exit(1);
  }

  console.log();
}

function runUITestCategory(category) {
  const testPattern = uiTestCategories[category];
  const description = uiTestDescriptions[category];

  if (!testPattern) {
    console.log(colorize(`✗ Unknown UI test category: ${category}`, "red"));
    return { success: false, error: `Unknown category: ${category}` };
  }

  printSeparator();
  console.log(colorize(`🎨 Running: ${description}`, "bold"));
  console.log(colorize(`📁 Pattern: ${testPattern}`, "cyan"));
  printSeparator();

  try {
    const uiJestConfigPath = path.join(__dirname, "jest.config.js");

    let jestArgs = [
      `--config="${uiJestConfigPath}"`,
      `--testPathPatterns="${testPattern}"`,
      "--verbose",
      "--runInBand", // Run tests sequentially for Docker containers
      "--forceExit",
      "--detectOpenHandles",
    ];

    if (process.env.VERBOSE_TESTS) {
      jestArgs.push("--verbose");
    }

    // Add coverage for specific categories
    if (category !== "e2e") {
      jestArgs.push("--collectCoverage");
    }

    execSync(`npx jest ${jestArgs.join(" ")}`, {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "test",
        JEST_ENVIRONMENT: "jsdom",
      },
    });

    console.log(colorize(`✓ ${description} - PASSED`, "green"));
    return { category, status: "PASSED", error: null };
  } catch (error) {
    console.log(colorize(`✗ ${description} - FAILED`, "red"));
    return { category, status: "FAILED", error: error.message };
  }
}

function runAllUITests() {
  console.log(colorize("🚀 Running All UI Tests...", "blue"));
  console.log();

  const results = [];
  const startTime = Date.now();

  // Run UI tests in order: components -> integration -> e2e
  const testOrder = ["components", "integration", "database", "e2e"];

  for (const category of testOrder) {
    const result = runUITestCategory(category);
    results.push(result);

    // Add spacing between test categories
    console.log();
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  printSeparator();
  console.log(colorize("📊 UI TEST SUMMARY", "bold"));
  printSeparator();

  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;

  console.log(colorize(`Total UI Test Categories: ${results.length}`, "blue"));
  console.log(colorize(`Passed: ${passed}`, "green"));
  console.log(colorize(`Failed: ${failed}`, "red"));
  console.log(colorize(`Duration: ${duration}s`, "magenta"));
  console.log();

  // List results
  results.forEach((result) => {
    const status =
      result.status === "PASSED"
        ? colorize("✓ PASSED", "green")
        : colorize("✗ FAILED", "red");

    console.log(`${status} ${uiTestDescriptions[result.category]}`);

    if (result.error) {
      console.log(colorize(`  Error: ${result.error}`, "red"));
    }
  });

  console.log();

  if (failed > 0) {
    console.log(
      colorize(
        "🔍 For detailed failure information, check the test output above.",
        "yellow"
      )
    );
  } else {
    console.log(colorize("🎉 All UI tests passed successfully!", "green"));
  }

  return failed === 0;
}

function runSpecificUITest(testName) {
  const category = Object.keys(uiTestCategories).find(
    (cat) =>
      cat.includes(testName.toLowerCase()) ||
      uiTestDescriptions[cat].toLowerCase().includes(testName.toLowerCase())
  );

  if (!category) {
    console.log(colorize(`✗ UI test category not found: ${testName}`, "red"));
    console.log(colorize("Available UI test categories:", "yellow"));
    Object.entries(uiTestDescriptions).forEach(([key, desc]) => {
      console.log(colorize(`  - ${key}: ${desc}`, "cyan"));
    });
    process.exit(1);
  }

  console.log(
    colorize(
      `🎯 Running specific UI test category: ${uiTestDescriptions[category]}`,
      "blue"
    )
  );
  console.log();

  const result = runUITestCategory(category);

  printSeparator();
  if (result.status === "PASSED") {
    console.log(
      colorize("🎉 UI test category completed successfully!", "green")
    );
  } else {
    console.log(
      colorize(
        "❌ UI test category failed. Check output above for details.",
        "red"
      )
    );
  }

  return result.status === "PASSED";
}

function showUIHelp() {
  console.log(colorize("Sniffler UI Test Runner", "bold"));
  console.log();
  console.log(colorize("Usage:", "blue"));
  console.log("  node run-ui-tests.js [options] [test-category]");
  console.log();
  console.log(colorize("Options:", "blue"));
  console.log("  --help, -h        Show this help message");
  console.log("  --install-deps    Install UI testing dependencies");
  console.log("  --list           List available UI test categories");
  console.log();
  console.log(colorize("Examples:", "blue"));
  console.log("  node run-ui-tests.js                 # Run all UI tests");
  console.log(
    "  node run-ui-tests.js components      # Run component tests only"
  );
  console.log("  node run-ui-tests.js integration     # Run integration tests");
  console.log("  node run-ui-tests.js e2e             # Run end-to-end tests");
  console.log(
    "  node run-ui-tests.js --list          # List available categories"
  );
  console.log();
  console.log(colorize("Available UI Test Categories:", "blue"));
  Object.entries(uiTestDescriptions).forEach(([key, desc]) => {
    console.log(`  ${colorize(key.padEnd(12), "cyan")}: ${desc}`);
  });
  console.log();
  console.log(colorize("Environment Variables:", "blue"));
  console.log("  VERBOSE_TESTS=1    Enable verbose test output");
  console.log("  NODE_ENV=test      Set test environment (automatic)");
}

function listUITests() {
  console.log(colorize("📋 Available UI Test Categories:", "bold"));
  console.log();
  Object.entries(uiTestDescriptions).forEach(([key, desc], index) => {
    console.log(
      `${colorize((index + 1).toString().padStart(2), "magenta")}. ${colorize(
        key,
        "cyan"
      )}`
    );
    console.log(`    ${desc}`);
    console.log(`    Pattern: ${uiTestCategories[key]}`);
    console.log();
  });
}

// Main execution for UI tests
function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showUIHelp();
    return;
  }

  if (args.includes("--list")) {
    listUITests();
    return;
  }

  if (args.includes("--install-deps")) {
    installUITestDependencies();
    return;
  }

  const testCategory = args.find((arg) => !arg.startsWith("--"));

  try {
    // Setup
    checkUIPrerequisites();

    // Run tests
    let success;
    if (testCategory) {
      success = runSpecificUITest(testCategory);
    } else {
      success = runAllUITests();
    }

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.log(colorize(`💥 Unexpected error: ${error.message}`, "red"));
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log(colorize("\n🛑 UI test execution interrupted", "yellow"));
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log(colorize("\n🛑 UI test execution terminated", "yellow"));
  process.exit(1);
});

// Run the main function
main();
