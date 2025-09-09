// Global teardown for Jest tests - stops Docker containers
const { execSync } = require("child_process");

module.exports = async () => {
  console.log("🛑 Stopping Docker test environment...");

  try {
    const dockerComposePath = global.__DOCKER_COMPOSE_PATH__;

    if (dockerComposePath) {
      execSync(`docker-compose -f "${dockerComposePath}" down`, {
        stdio: "inherit",
        timeout: 30000, // 30 seconds timeout
      });
      console.log("✅ Docker test environment stopped");
    }
  } catch (error) {
    console.warn(
      "⚠️ Warning: Failed to stop Docker environment cleanly:",
      error.message
    );
  }
};
