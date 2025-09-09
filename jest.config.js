module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/e2e/", // Exclude E2E tests - they should be run with Playwright
  ],
  collectCoverageFrom: [
    "apps/main/**/*.js",
    "!apps/main/index.js", // Exclude main entry point
    "!apps/main/preload.js", // Exclude preload script
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest-setup.js"],
  globalSetup: "<rootDir>/tests/setup/global-setup.js",
  globalTeardown: "<rootDir>/tests/setup/global-teardown.js",
  testTimeout: 30000, // 30 seconds for integration tests
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1, // Run tests sequentially to avoid port conflicts
};
