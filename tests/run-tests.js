#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Sniffler Backend Test Suite Runner");
console.log("=====================================\n");

// Test categories and their corresponding Jest patterns
const testCategories = {
  unit: "tests/unit/**/*.test.js",
  integration: "tests/integration/**/*.test.js",
  database: "tests/integration/database.integration.test.js",
  proxy: "tests/integration/proxy.integration.test.js",
  mocking: "tests/integration/mocking.integration.test.js",
  all: "tests/**/*.test.js",
};

const testDescriptions = {
  unit: "Unit Tests (Core Components)",
  integration: "Integration Tests (All)",
  database: "Database Integration Tests",
  proxy: "Proxy Integration Tests",
  mocking: "Mocking Integration Tests",
  all: "All Tests (Unit + Integration)",
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

function checkPrerequisites() {
  console.log(colorize("📋 Checking Prerequisites...", "blue"));

  // Check if Docker is running
  try {
    execSync("docker --version", { stdio: "ignore" });
    console.log(colorize("✓ Docker is available", "green"));
  } catch (error) {
    console.log(colorize("✗ Docker is not available or not running", "red"));
    console.log(
      colorize("  Please install and start Docker Desktop", "yellow")
    );
    process.exit(1);
  }

  // Check if docker-compose file exists
  const dockerComposePath = path.join(
    __dirname,
    "docker",
    "docker-compose.test.yml"
  );
  if (fs.existsSync(dockerComposePath)) {
    console.log(colorize("✓ Docker Compose configuration found", "green"));
  } else {
    console.log(colorize("✗ Docker Compose configuration not found", "red"));
    process.exit(1);
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

  console.log();
}

function startDockerEnvironment() {
  console.log(colorize("🐳 Starting Docker Test Environment...", "blue"));

  try {
    const dockerComposePath = path.join(
      __dirname,
      "docker",
      "docker-compose.test.yml"
    );
    execSync(`docker-compose -f "${dockerComposePath}" up -d`, {
      stdio: "inherit",
    });
    console.log(colorize("✓ Docker containers started successfully", "green"));

    // Wait for services to be healthy
    console.log(colorize("⏳ Waiting for services to be healthy...", "yellow"));

    const maxWaitTime = 120; // 2 minutes total wait time
    const checkInterval = 10; // Check every 10 seconds
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      try {
        // Get health status of all containers
        const result = execSync(
          `docker-compose -f "${dockerComposePath}" ps --format "json"`,
          {
            encoding: "utf8",
            stdio: "pipe",
          }
        );

        const containers = result
          .trim()
          .split("\n")
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter((container) => container !== null);

        const totalContainers = containers.length;
        const healthyContainers = containers.filter(
          (container) =>
            container.State.includes("healthy") ||
            (container.State.includes("running") &&
              !container.State.includes("health:") &&
              !container.State.includes("starting"))
        );
        const unhealthyContainers = containers.filter((container) =>
          container.State.includes("unhealthy")
        );
        const startingContainers = containers.filter(
          (container) =>
            container.State.includes("health: starting") ||
            container.State.includes("starting")
        );

        console.log(
          colorize(
            `  Status: ${healthyContainers.length}/${totalContainers} healthy, ${startingContainers.length} starting, ${unhealthyContainers.length} unhealthy`,
            "cyan"
          )
        );

        // All containers are healthy or running without health checks
        if (
          healthyContainers.length === totalContainers &&
          unhealthyContainers.length === 0
        ) {
          console.log(
            colorize("✓ All services are healthy and ready", "green")
          );
          return;
        }

        // If we have unhealthy containers and we've waited a reasonable time, fail
        if (unhealthyContainers.length > 0 && waitTime > 60) {
          throw new Error(
            `${unhealthyContainers.length} containers are unhealthy after ${waitTime} seconds`
          );
        }
      } catch (checkError) {
        console.log(
          colorize(
            `  Checking services... ${maxWaitTime - waitTime}s remaining`,
            "cyan"
          )
        );
      }

      // Wait before next check
      if (process.platform === "win32") {
        try {
          execSync(
            `powershell -command "Start-Sleep -Seconds ${checkInterval}"`,
            {
              stdio: "ignore",
            }
          );
        } catch {
          execSync(`timeout /t ${checkInterval} /nobreak`, { stdio: "ignore" });
        }
      } else {
        execSync(`sleep ${checkInterval}`, { stdio: "ignore" });
      }

      waitTime += checkInterval;
    }

    throw new Error(
      `Services did not become healthy within ${maxWaitTime} seconds`
    );
  } catch (error) {
    console.log(colorize("✗ Failed to start Docker environment", "red"));
    console.log(colorize(`  Error: ${error.message}`, "yellow"));
    console.log(colorize("  Please check Docker and try again", "yellow"));
    process.exit(1);
  }

  console.log();
}

function stopDockerEnvironment() {
  console.log(colorize("🛑 Stopping Docker Test Environment...", "blue"));

  try {
    const dockerComposePath = path.join(
      __dirname,
      "docker",
      "docker-compose.test.yml"
    );
    execSync(`docker-compose -f "${dockerComposePath}" down`, {
      stdio: "inherit",
    });
    console.log(colorize("✓ Docker containers stopped successfully", "green"));
  } catch (error) {
    console.log(
      colorize("⚠ Warning: Failed to stop Docker environment cleanly", "yellow")
    );
  }
}

function runTestCategory(category) {
  const testPattern = testCategories[category];
  const description = testDescriptions[category];

  if (!testPattern) {
    console.log(colorize(`✗ Unknown test category: ${category}`, "red"));
    return { success: false, error: `Unknown category: ${category}` };
  }

  printSeparator();
  console.log(colorize(`🧪 Running: ${description}`, "bold"));
  console.log(colorize(`📁 Pattern: ${testPattern}`, "cyan"));
  printSeparator();

  try {
    let jestArgs;

    // Use directory-based matching for unit tests
    if (category === "unit") {
      jestArgs = [
        "tests/unit",
        "--verbose",
        "--runInBand", // Run tests sequentially to avoid port conflicts
        "--forceExit",
        "--detectOpenHandles",
      ];
    } else {
      // Use testPathPatterns for integration tests
      jestArgs = [
        "--testPathPatterns=" + testPattern,
        "--verbose",
        "--runInBand", // Run tests sequentially to avoid port conflicts
        "--forceExit",
        "--detectOpenHandles",
      ];
    }

    if (process.env.VERBOSE_TESTS) {
      jestArgs.push("--verbose");
    }

    execSync(`npx jest ${jestArgs.join(" ")}`, {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });

    console.log(colorize(`✓ ${description} - PASSED`, "green"));
    return { category, status: "PASSED", error: null };
  } catch (error) {
    console.log(colorize(`✗ ${description} - FAILED`, "red"));
    return { category, status: "FAILED", error: error.message };
  }
}

function runAllTests() {
  console.log(colorize("🚀 Running All Backend Tests...", "blue"));
  console.log();

  const results = [];
  const startTime = Date.now();

  // Run unit tests first, then integration tests
  const testOrder = ["unit", "database", "proxy", "mocking"];

  for (const category of testOrder) {
    const result = runTestCategory(category);
    results.push(result);

    // Add spacing between test categories
    console.log();
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  printSeparator();
  console.log(colorize("📊 TEST SUMMARY", "bold"));
  printSeparator();

  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;

  console.log(colorize(`Total Test Categories: ${results.length}`, "blue"));
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

    console.log(`${status} ${testDescriptions[result.category]}`);

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
    console.log(colorize("🎉 All tests passed successfully!", "green"));
  }

  return failed === 0;
}

function runSpecificTest(testName) {
  const category = Object.keys(testCategories).find(
    (cat) =>
      cat.includes(testName.toLowerCase()) ||
      testDescriptions[cat].toLowerCase().includes(testName.toLowerCase())
  );

  if (!category) {
    console.log(colorize(`✗ Test category not found: ${testName}`, "red"));
    console.log(colorize("Available test categories:", "yellow"));
    Object.entries(testDescriptions).forEach(([key, desc]) => {
      console.log(colorize(`  - ${key}: ${desc}`, "cyan"));
    });
    process.exit(1);
  }

  console.log(
    colorize(
      `🎯 Running specific test category: ${testDescriptions[category]}`,
      "blue"
    )
  );
  console.log();

  const result = runTestCategory(category);

  printSeparator();
  if (result.status === "PASSED") {
    console.log(colorize("🎉 Test category completed successfully!", "green"));
  } else {
    console.log(
      colorize(
        "❌ Test category failed. Check output above for details.",
        "red"
      )
    );
  }

  return result.status === "PASSED";
}

function showHelp() {
  console.log(colorize("Sniffler Backend Test Runner", "bold"));
  console.log();
  console.log(colorize("Usage:", "blue"));
  console.log("  node run-tests.js [options] [test-category]");
  console.log();
  console.log(colorize("Options:", "blue"));
  console.log("  --help, -h     Show this help message");
  console.log("  --no-docker    Skip Docker environment setup (use existing)");
  console.log("  --list         List available test categories");
  console.log();
  console.log(colorize("Examples:", "blue"));
  console.log("  node run-tests.js                 # Run all tests");
  console.log("  node run-tests.js unit            # Run unit tests only");
  console.log(
    "  node run-tests.js database        # Run database integration tests"
  );
  console.log(
    "  node run-tests.js --list          # List available test categories"
  );
  console.log();
  console.log(colorize("Available Test Categories:", "blue"));
  Object.entries(testDescriptions).forEach(([key, desc]) => {
    console.log(`  ${colorize(key.padEnd(12), "cyan")}: ${desc}`);
  });
  console.log();
  console.log(colorize("Environment Variables:", "blue"));
  console.log("  VERBOSE_TESTS=1    Enable verbose test output");
  console.log("  NODE_ENV=test      Set test environment (automatic)");
}

function listTests() {
  console.log(colorize("📋 Available Test Categories:", "bold"));
  console.log();
  Object.entries(testDescriptions).forEach(([key, desc], index) => {
    console.log(
      `${colorize((index + 1).toString().padStart(2), "magenta")}. ${colorize(
        key,
        "cyan"
      )}`
    );
    console.log(`    ${desc}`);
    console.log(`    Pattern: ${testCategories[key]}`);
    console.log();
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  if (args.includes("--list")) {
    listTests();
    return;
  }

  const skipDocker = args.includes("--no-docker");
  const testCategory = args.find((arg) => !arg.startsWith("--"));

  try {
    // Setup
    checkPrerequisites();

    if (!skipDocker) {
      startDockerEnvironment();
    }

    // Run tests
    let success;
    if (testCategory) {
      success = runSpecificTest(testCategory);
    } else {
      success = runAllTests();
    }

    // Cleanup
    if (!skipDocker) {
      stopDockerEnvironment();
    }

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.log(colorize(`💥 Unexpected error: ${error.message}`, "red"));

    if (!skipDocker) {
      stopDockerEnvironment();
    }

    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log(colorize("\n🛑 Test execution interrupted", "yellow"));
  stopDockerEnvironment();
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log(colorize("\n🛑 Test execution terminated", "yellow"));
  stopDockerEnvironment();
  process.exit(1);
});

// Run the main function
main();
