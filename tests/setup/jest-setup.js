// Jest setup file for individual tests
const path = require("path");

// Set up global test timeout
jest.setTimeout(30000);

// Mock electron for main process tests
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => require("path").join(__dirname, "..", "test-data")),
    on: jest.fn(),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      toggleDevTools: jest.fn(),
      reload: jest.fn(),
      reloadIgnoringCache: jest.fn(),
      setZoomLevel: jest.fn(),
      getZoomLevel: jest.fn(() => 0),
      inspectElement: jest.fn(),
    },
    on: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
  },
  shell: {
    openPath: jest.fn(),
  },
}));

// Global test utilities
global.testUtils = {
  waitForPort: (port, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const net = require("net");
      const start = Date.now();

      const check = () => {
        const socket = new net.Socket();
        socket.setTimeout(1000);

        socket.on("connect", () => {
          socket.destroy();
          resolve(true);
        });

        socket.on("error", () => {
          if (Date.now() - start > timeout) {
            reject(new Error(`Port ${port} not available after ${timeout}ms`));
          } else {
            setTimeout(check, 100);
          }
        });

        socket.connect(port, "localhost");
      };

      check();
    });
  },

  isPortOpen: (port) => {
    return new Promise((resolve) => {
      const net = require("net");
      const socket = new net.Socket();

      socket.setTimeout(1000);

      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        resolve(false);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, "localhost");
    });
  },

  generateTestPort: () => {
    return 9000 + Math.floor(Math.random() * 1000);
  },

  sleep: (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

// Clean up console logs during tests unless verbose
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}
