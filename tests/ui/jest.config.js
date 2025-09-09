// Enhanced Jest configuration for UI testing

module.exports = {
  displayName: "UI Tests",
  testMatch: ["**/tests/ui/**/*.test.js", "**/tests/ui/**/*.test.jsx"],
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/setup/react-setup.js"],
  setupFilesAfterEnv: ["<rootDir>/setup/ui-jest-setup.js"],
  transform: {
    "^.+\\.(js|jsx)$": [
      "esbuild-jest",
      {
        sourcemap: true,
        target: "node14",
        jsx: "automatic",
      },
    ],
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  collectCoverageFrom: [
    "<rootDir>/../../apps/renderer/src/**/*.{js,jsx}",
    "!<rootDir>/../../apps/renderer/src/main.jsx", // Entry point
    "!<rootDir>/../../apps/renderer/src/**/*.d.ts",
  ],
  testTimeout: 60000, // Longer timeout for UI tests with Docker
  maxWorkers: 1, // Sequential execution for Docker containers
  moduleDirectories: ["node_modules"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  roots: ["<rootDir>"],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
