import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Make React available for tests
global.React = require("react");

// Polyfills for JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.confirm and window.alert
global.confirm = jest.fn(() => true);
global.alert = jest.fn();

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is no longer supported") ||
        args[0].includes("Invalid hook call") ||
        args[0].includes("Cannot read properties of null"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock electron APIs
global.window = global.window || {};
global.window.electronAPI = {
  // Proxy management
  getProxies: jest.fn(),
  startProxy: jest.fn(),
  stopProxy: jest.fn(),
  disableProxy: jest.fn(),
  enableProxy: jest.fn(),
  deleteProxy: jest.fn(),
  restartAllProxies: jest.fn(),
  testTargetConnection: jest.fn(),

  // Mock and request management
  getMocks: jest.fn(),
  getRequests: jest.fn(),
  addMock: jest.fn(),
  updateMock: jest.fn(),
  deleteMock: jest.fn(),
  toggleMock: jest.fn(),

  // Database proxy
  getDatabaseProxies: jest.fn().mockResolvedValue([]),
  getDatabaseQueries: jest.fn().mockResolvedValue([]),
  getDatabaseMocks: jest.fn().mockResolvedValue([]),
  getDatabaseProxyStats: jest.fn().mockResolvedValue({}),
  createDatabaseProxy: jest.fn(),
  deleteDatabaseProxy: jest.fn(),
  startDatabaseProxy: jest.fn(),
  stopDatabaseProxy: jest.fn(),

  // Settings
  getSettings: jest.fn().mockResolvedValue({}),
  updateSettings: jest.fn(),
  saveSettings: jest.fn(),

  // Import/Export
  exportData: jest.fn(),
  importData: jest.fn(),
  exportSingleProject: jest.fn(),
  exportSettings: jest.fn(),
  importSettings: jest.fn(),
  resetSettings: jest.fn(),

  // Event listeners
  onProxyRequest: jest.fn(),
  onProxyResponse: jest.fn(),
  onProxyError: jest.fn(),
  onMockAutoCreated: jest.fn(),
  onDatabaseQuery: jest.fn(),

  // Remove listeners
  removeAllListeners: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  if (global.window?.electronAPI) {
    Object.values(global.window.electronAPI).forEach((fn) => {
      if (typeof fn === "function" && fn.mockReset) {
        fn.mockReset();
      }
    });
  }

  jest.clearAllMocks();
});
