// Global setup for Jest tests - starts Docker containers
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = async () => {
  console.log("� Starting Docker test environment...");

  try {
    const dockerComposePath = path.join(
      __dirname,
      "..",
      "docker",
      "docker-compose.test.yml"
    );

    // Check if docker-compose file exists
    if (!fs.existsSync(dockerComposePath)) {
      throw new Error(`Docker compose file not found: ${dockerComposePath}`);
    }

    // Stop any existing containers
    try {
      execSync(`docker-compose -f "${dockerComposePath}" down`, {
        stdio: "pipe",
        timeout: 30000,
      });
    } catch (error) {
      // Ignore errors when stopping containers
    }

    // Start the containers
    execSync(`docker-compose -f "${dockerComposePath}" up -d`, {
      stdio: "inherit",
      timeout: 120000, // 2 minutes timeout
    });

    // Wait for services to be healthy
    console.log("⏳ Waiting for services to be healthy...");

    const maxWaitTime = 120; // 2 minutes
    const checkInterval = 5; // Check every 5 seconds
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      try {
        const result = execSync(
          `docker-compose -f "${dockerComposePath}" ps --format "json"`,
          { encoding: "utf8", stdio: "pipe" }
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

        const healthyContainers = containers.filter(
          (container) =>
            container.State.includes("healthy") ||
            (container.State.includes("running") &&
              !container.State.includes("health:"))
        );

        const unhealthyContainers = containers.filter((container) =>
          container.State.includes("unhealthy")
        );

        if (
          healthyContainers.length === containers.length &&
          unhealthyContainers.length === 0
        ) {
          console.log("✅ All services are healthy and ready");
          break;
        }

        if (unhealthyContainers.length > 0 && waitTime > 60) {
          throw new Error(
            `${unhealthyContainers.length} containers are unhealthy after ${waitTime} seconds`
          );
        }
      } catch (checkError) {
        if (waitTime > 60) {
          console.warn(`Warning: Health check failed: ${checkError.message}`);
        }
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, checkInterval * 1000));
      waitTime += checkInterval;
    }

    if (waitTime >= maxWaitTime) {
      console.warn(
        "⚠️ Warning: Services may not be fully ready, but continuing with tests"
      );
    }

    console.log("✅ Docker test environment ready");

    // Store environment info globally for tests
    global.__DOCKER_COMPOSE_PATH__ = dockerComposePath;
  } catch (error) {
    console.error("❌ Failed to start Docker test environment:", error.message);
    throw error;
  }
};
