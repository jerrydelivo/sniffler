const { contextBridge, ipcRenderer } = require("electron");

// Lightweight event buffer to avoid losing early events before renderer subscribes
const __eventBuffers = {
  "mock-auto-created": [],
};
const __subscribers = {
  "mock-auto-created": [],
};

// Attach a single low-level listener to buffer events and fan-out to subscribers
ipcRenderer.on("mock-auto-created", (_event, data) => {
  const subs = __subscribers["mock-auto-created"];
  if (subs.length === 0) {
    // No subscribers yet: buffer the event for later delivery
    __eventBuffers["mock-auto-created"].push(data);
  } else {
    // Subscribers present: deliver immediately, do not buffer to avoid duplicates
    for (const cb of subs) {
      try {
        cb(data);
      } catch (_) {}
    }
  }
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Proxy management
  startProxy: (data) => ipcRenderer.invoke("start-proxy", data),
  stopProxy: (port) => ipcRenderer.invoke("stop-proxy", port),
  restartAllProxies: () => ipcRenderer.invoke("restart-all-proxies"),
  disableProxy: (port) => ipcRenderer.invoke("disable-proxy", port),
  enableProxy: (port) => ipcRenderer.invoke("enable-proxy", port),
  getProxies: () => ipcRenderer.invoke("get-proxies"),
  updateProxyName: (port, newName) =>
    ipcRenderer.invoke("update-proxy-name", port, newName),
  updateProxyConfig: (port, updates) =>
    ipcRenderer.invoke("update-proxy-config", port, updates),
  deleteProxy: (port) => ipcRenderer.invoke("delete-proxy", port),
  testTargetConnection: (data) =>
    ipcRenderer.invoke("test-target-connection", data),

  // Mock management
  addMock: (data) => ipcRenderer.invoke("add-mock", data),
  removeMock: (data) => ipcRenderer.invoke("remove-mock", data),
  updateMock: (data) => ipcRenderer.invoke("update-mock", data),
  toggleMock: (data) => ipcRenderer.invoke("toggle-mock", data),
  getMocks: (port) => ipcRenderer.invoke("get-mocks", port),

  // Request management
  getRequests: (port) => ipcRenderer.invoke("get-requests", port),
  clearRequests: (port) => ipcRenderer.invoke("clear-requests", port),
  sendRequest: (data) => ipcRenderer.invoke("send-request", data),

  // Real-time event listeners
  onProxyRequest: (callback) => {
    ipcRenderer.on("proxy-request", (_event, data) => callback(data));
  },
  onProxyResponse: (callback) => {
    ipcRenderer.on("proxy-response", (_event, data) => callback(data));
  },
  onMockServed: (callback) => {
    ipcRenderer.on("mock-served", (_event, data) => callback(data));
  },
  onProxyError: (callback) => {
    ipcRenderer.on("proxy-error", (_event, data) => callback(data));
  },
  onMockAutoCreated: (callback) => {
    const subs = __subscribers["mock-auto-created"];
    const wasEmpty = subs.length === 0;
    // Register subscriber
    subs.push(callback);
    // If this is the first subscriber, flush buffered events exactly once
    if (wasEmpty) {
      const buffer = __eventBuffers["mock-auto-created"];
      if (buffer && buffer.length) {
        try {
          for (const item of buffer) {
            callback(item);
          }
        } finally {
          __eventBuffers["mock-auto-created"] = [];
        }
      }
    }
  },
  onMockDifferenceDetected: (callback) => {
    ipcRenderer.on("mock-difference-detected", (_event, data) =>
      callback(data)
    );
  },
  onOutgoingMockDifferenceDetected: (callback) => {
    ipcRenderer.on("outgoing-mock-difference-detected", (_event, data) =>
      callback(data)
    );
  },
  onDatabaseMockDifferenceDetected: (callback) => {
    ipcRenderer.on("database-mock-difference-detected", (_event, data) =>
      callback(data)
    );
  },
  onMockAutoReplaced: (callback) => {
    ipcRenderer.on("mock-auto-replaced", (_event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  removeOutgoingRequestListener: () =>
    ipcRenderer.removeAllListeners("outgoing-request"),
  removeOutgoingResponseListener: () =>
    ipcRenderer.removeAllListeners("outgoing-response"),
  removeOutgoingErrorListener: () =>
    ipcRenderer.removeAllListeners("outgoing-error"),
  removeProxyCreatedListener: () =>
    ipcRenderer.removeAllListeners("proxy-created"),
  removeProxyStartedListener: () =>
    ipcRenderer.removeAllListeners("proxy-started"),
  removeProxyStoppedListener: () =>
    ipcRenderer.removeAllListeners("proxy-stopped"),
  removeProxyRemovedListener: () =>
    ipcRenderer.removeAllListeners("proxy-removed"),
  removeProxyUpdatedListener: () =>
    ipcRenderer.removeAllListeners("proxy-updated"),

  // App management
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getLicenseInfo: () => ipcRenderer.invoke("get-license-info"),

  // License management
  checkLicenseStatus: () => ipcRenderer.invoke("check-license-status"),
  setLicenseKey: (licenseKey) =>
    ipcRenderer.invoke("set-license-key", licenseKey),
  removeLicenseKey: () => ipcRenderer.invoke("remove-license-key"),
  clearLicense: () => ipcRenderer.invoke("clear-license"),
  setLicenseEmail: (email) => ipcRenderer.invoke("set-license-email", email),
  removeLicenseEmail: () => ipcRenderer.invoke("remove-license-email"),
  startFreeTrial: () => ipcRenderer.invoke("start-free-trial"),
  createCheckoutSession: (data) =>
    ipcRenderer.invoke("create-checkout-session", data),
  openCheckoutUrl: (url) => ipcRenderer.invoke("open-checkout-url", url),
  isPremiumFeature: (feature) =>
    ipcRenderer.invoke("is-premium-feature", feature),

  // Licensing API base (for admin UI calls)
  getLicensingApiBase: () => ipcRenderer.invoke("get-licensing-api-base"),

  // Payment processing
  processPaymentSuccess: (data) =>
    ipcRenderer.invoke("process-payment-success", data),
  processPaymentCancelled: () =>
    ipcRenderer.invoke("process-payment-cancelled"),

  // License and payment event listeners
  onLicenseStatusChanged: (callback) => {
    ipcRenderer.on("license-status-changed", (_event, data) => callback(data));
  },
  onStripePaymentSuccess: (callback) => {
    ipcRenderer.on("stripe-payment-success", (_event, data) => callback(data));
  },
  onStripePaymentCancelled: (callback) => {
    ipcRenderer.on("stripe-payment-cancelled", (_event, data) =>
      callback(data)
    );
  },

  // File operations
  exportMocks: (data) => ipcRenderer.invoke("export-mocks", data),
  importMocks: (filePath) => ipcRenderer.invoke("import-mocks", filePath),

  // Data management
  exportAllData: () => ipcRenderer.invoke("export-all-data"),
  importAllData: (data) => ipcRenderer.invoke("import-all-data", data),
  chooseImportFile: () => ipcRenderer.invoke("choose-import-file"),
  importSelectedProjects: (data) =>
    ipcRenderer.invoke("import-selected-projects", data),
  exportSingleProject: (port) =>
    ipcRenderer.invoke("export-single-project", port),
  copyProjectMocks: (fromPort, toPort) =>
    ipcRenderer.invoke("copy-project-mocks", fromPort, toPort),
  saveProxyData: () => ipcRenderer.invoke("save-proxy-data"),

  // File dialog operations
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (settings) => ipcRenderer.invoke("update-settings", settings),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // Auto-updater
  checkForUpdates: (silent = false) =>
    ipcRenderer.invoke("check-for-updates", silent),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  onAutoUpdater: (callback) => {
    ipcRenderer.on("auto-updater", (_event, data) => callback(data));
  },

  // Testing mode
  setTestingMode: (enabled) => ipcRenderer.invoke("set-testing-mode", enabled),
  getTestingMode: () => ipcRenderer.invoke("get-testing-mode"),

  // Advanced settings
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openDataFolder: () => ipcRenderer.invoke("open-data-folder"),
  clearAllData: () => ipcRenderer.invoke("clear-all-data"),
  installCertificate: () => ipcRenderer.invoke("install-certificate"),
  removeCertificate: () => ipcRenderer.invoke("remove-certificate"),

  // Database sniffing
  startDatabaseSniffer: (data) =>
    ipcRenderer.invoke("start-database-sniffer", data),
  stopDatabaseSniffer: (port) =>
    ipcRenderer.invoke("stop-database-sniffer", port),
  getDatabaseSniffers: () => ipcRenderer.invoke("get-database-sniffers"),
  getDatabaseStatistics: () => ipcRenderer.invoke("get-database-statistics"),
  stopAllDatabaseSniffers: () =>
    ipcRenderer.invoke("stop-all-database-sniffers"),

  // Database sniffer event listeners (for the old database sniffer)
  onDatabaseConnectionEstablished: (callback) => {
    ipcRenderer.on("database-connection-established", (_event, data) =>
      callback(data)
    );
  },
  onDatabaseConnectionClosed: (callback) => {
    ipcRenderer.on("database-connection-closed", (_event, data) =>
      callback(data)
    );
  },

  // Outgoing Proxy Management
  getOutgoingProxies: () => ipcRenderer.invoke("get-outgoing-proxies"),
  createOutgoingProxy: (proxyConfig) =>
    ipcRenderer.invoke("create-outgoing-proxy", proxyConfig),
  startOutgoingProxy: (port) =>
    ipcRenderer.invoke("start-outgoing-proxy", port),
  stopOutgoingProxy: (port) => ipcRenderer.invoke("stop-outgoing-proxy", port),
  updateOutgoingProxy: (port, updates) =>
    ipcRenderer.invoke("update-outgoing-proxy", port, updates),
  removeOutgoingProxy: (port) =>
    ipcRenderer.invoke("remove-outgoing-proxy", port),
  getOutgoingRequests: (proxyPort) =>
    ipcRenderer.invoke("get-outgoing-requests", proxyPort),
  clearOutgoingRequests: (proxyPort) =>
    ipcRenderer.invoke("clear-outgoing-requests", proxyPort),
  getOutgoingStats: () => ipcRenderer.invoke("get-outgoing-stats"),
  testProxyConnection: (targetUrl) =>
    ipcRenderer.invoke("test-proxy-connection", targetUrl),
  startAllOutgoingProxies: () =>
    ipcRenderer.invoke("start-all-outgoing-proxies"),
  stopAllOutgoingProxies: () => ipcRenderer.invoke("stop-all-outgoing-proxies"),
  exportOutgoingConfig: () => ipcRenderer.invoke("export-outgoing-config"),
  importOutgoingConfig: (config) =>
    ipcRenderer.invoke("import-outgoing-config", config),
  exportOutgoingProxyConfig: () =>
    ipcRenderer.invoke("export-outgoing-proxy-config"),
  importOutgoingProxyConfig: () =>
    ipcRenderer.invoke("import-outgoing-proxy-config"),

  // Outgoing Mock Management
  getOutgoingMocks: (proxyPort) =>
    ipcRenderer.invoke("get-outgoing-mocks", proxyPort),
  addOutgoingMock: (data) => ipcRenderer.invoke("add-outgoing-mock", data),
  removeOutgoingMock: (data) =>
    ipcRenderer.invoke("remove-outgoing-mock", data),
  toggleOutgoingMock: (data) =>
    ipcRenderer.invoke("toggle-outgoing-mock", data),
  updateOutgoingMock: (data) =>
    ipcRenderer.invoke("update-outgoing-mock", data),
  setOutgoingTestingMode: (enabled) =>
    ipcRenderer.invoke("set-outgoing-testing-mode", enabled),
  createOutgoingMockFromRequest: (requestId) =>
    ipcRenderer.invoke("create-outgoing-mock-from-request", requestId),

  // Outgoing Proxy event listeners
  onOutgoingRequest: (callback) => {
    ipcRenderer.on("outgoing-request", (_event, data) => callback(data));
  },
  onOutgoingResponse: (callback) => {
    ipcRenderer.on("outgoing-response", (_event, data) => callback(data));
  },
  onOutgoingError: (callback) => {
    ipcRenderer.on("outgoing-error", (_event, data) => callback(data));
  },
  onProxyCreated: (callback) => {
    ipcRenderer.on("proxy-created", (_event, data) => callback(data));
  },
  onProxyStarted: (callback) => {
    ipcRenderer.on("proxy-started", (_event, data) => callback(data));
  },
  onProxyStopped: (callback) => {
    ipcRenderer.on("proxy-stopped", (_event, data) => callback(data));
  },
  onProxyRemoved: (callback) => {
    ipcRenderer.on("proxy-removed", (_event, data) => callback(data));
  },
  onProxyUpdated: (callback) => {
    ipcRenderer.on("proxy-updated", (_event, data) => callback(data));
  },

  // Outgoing Mock event listeners
  onOutgoingMockServed: (callback) => {
    ipcRenderer.on("outgoing-mock-served", (_event, data) => callback(data));
  },
  onOutgoingMockAdded: (callback) => {
    ipcRenderer.on("outgoing-mock-added", (_event, data) => callback(data));
  },
  onOutgoingMockUpdated: (callback) => {
    ipcRenderer.on("outgoing-mock-updated", (_event, data) => callback(data));
  },
  onOutgoingMockRemoved: (callback) => {
    ipcRenderer.on("outgoing-mock-removed", (_event, data) => callback(data));
  },
  onOutgoingMockToggled: (callback) => {
    ipcRenderer.on("outgoing-mock-toggled", (_event, data) => callback(data));
  },
  onOutgoingTestingModeChanged: (callback) => {
    ipcRenderer.on("outgoing-testing-mode-changed", (_event, data) =>
      callback(data)
    );
  },

  // Developer Tools
  toggleDevTools: () => ipcRenderer.invoke("toggle-dev-tools"),
  openDevTools: () => ipcRenderer.invoke("open-dev-tools"),
  closeDevTools: () => ipcRenderer.invoke("close-dev-tools"),
  isDevToolsEnabled: () => ipcRenderer.invoke("is-dev-tools-enabled"),

  // Database Proxy Management
  getDatabaseProxies: () => ipcRenderer.invoke("get-database-proxies"),
  createDatabaseProxy: (proxyConfig) =>
    ipcRenderer.invoke("create-database-proxy", proxyConfig),
  startDatabaseProxy: (port) =>
    ipcRenderer.invoke("start-database-proxy", port),
  stopDatabaseProxy: (port) => ipcRenderer.invoke("stop-database-proxy", port),
  updateDatabaseProxy: (port, updates) =>
    ipcRenderer.invoke("update-database-proxy", port, updates),
  deleteDatabaseProxy: (port) =>
    ipcRenderer.invoke("delete-database-proxy", port),
  getDatabaseProxyStats: () => ipcRenderer.invoke("get-database-proxy-stats"),
  getDatabaseProxyQueries: (proxyPort) =>
    ipcRenderer.invoke("get-database-proxy-queries", proxyPort),
  clearDatabaseProxyQueries: (proxyPort) =>
    ipcRenderer.invoke("clear-database-proxy-queries", proxyPort),
  getDatabaseQueries: (proxyPort) =>
    ipcRenderer.invoke("get-database-queries", proxyPort),
  clearDatabaseQueries: (proxyPort) =>
    ipcRenderer.invoke("clear-database-queries", proxyPort),
  exportDatabaseProxyConfig: () =>
    ipcRenderer.invoke("export-database-proxy-config"),
  importDatabaseProxyConfig: () =>
    ipcRenderer.invoke("import-database-proxy-config"),

  // Database Mock Management
  getDatabaseMocks: () => ipcRenderer.invoke("get-database-mocks"),
  getDatabaseProxyMocks: (proxyPort) =>
    ipcRenderer.invoke("get-database-proxy-mocks", proxyPort),
  createDatabaseMock: (mockData) =>
    ipcRenderer.invoke("create-database-mock", mockData),
  updateDatabaseMock: (mockId, mockData) =>
    ipcRenderer.invoke("update-database-mock-by-id", mockId, mockData),
  deleteDatabaseMock: (mockId) =>
    ipcRenderer.invoke("delete-database-mock", mockId),
  toggleDatabaseMock: (mockId, enabled) =>
    ipcRenderer.invoke("toggle-database-mock-by-id", mockId, enabled),
  getDatabaseMockUsage: (mockId) =>
    ipcRenderer.invoke("get-database-mock-usage", mockId),
  setDatabaseTestingMode: (enabled) =>
    ipcRenderer.invoke("set-database-testing-mode", enabled),
  createDatabaseMockFromQuery: (queryData) =>
    ipcRenderer.invoke("create-database-mock-from-query", queryData),

  // Database Proxy event listeners
  onDatabaseProxyCreated: (callback) => {
    ipcRenderer.on("database-proxy-created", (_event, data) => callback(data));
  },
  onDatabaseProxyStarted: (callback) => {
    ipcRenderer.on("database-proxy-started", (_event, data) => callback(data));
  },
  onDatabaseProxyStopped: (callback) => {
    ipcRenderer.on("database-proxy-stopped", (_event, data) => callback(data));
  },
  onDatabaseProxyDeleted: (callback) => {
    ipcRenderer.on("database-proxy-deleted", (_event, data) => callback(data));
  },
  onDatabaseProxyError: (callback) => {
    ipcRenderer.on("database-proxy-error", (_event, data) => callback(data));
  },
  onDatabaseQuery: (callback) => {
    ipcRenderer.on("database-proxy-query", (_event, data) => callback(data));
  },
  onDatabaseResponse: (callback) => {
    ipcRenderer.on("database-proxy-response", (_event, data) => callback(data));
  },
  onDatabaseError: (callback) => {
    ipcRenderer.on("database-error", (_event, data) => callback(data));
  },

  // Database Mock event listeners
  onDatabaseMockAdded: (callback) => {
    ipcRenderer.on("database-mock-added", (_event, data) => callback(data));
  },
  onDatabaseMockCreated: (callback) => {
    ipcRenderer.on("database-mock-created", (_event, data) => callback(data));
  },
  onDatabaseMockUpdated: (callback) => {
    ipcRenderer.on("database-mock-updated", (_event, data) => callback(data));
  },
  onDatabaseMockDeleted: (callback) => {
    ipcRenderer.on("database-mock-deleted", (_event, data) => callback(data));
  },
  onDatabaseMockRemoved: (callback) => {
    ipcRenderer.on("database-mock-removed", (_event, data) => callback(data));
  },
  onDatabaseMockToggled: (callback) => {
    ipcRenderer.on("database-mock-toggled", (_event, data) => callback(data));
  },
  onDatabaseMockServed: (callback) => {
    ipcRenderer.on("database-mock-served", (_event, data) => callback(data));
  },
  onDatabaseMockAutoCreated: (callback) => {
    ipcRenderer.on("database-mock-auto-created", (_event, data) =>
      callback(data)
    );
  },
  onDatabaseTestingModeChanged: (callback) => {
    ipcRenderer.on("database-testing-mode-changed", (_event, data) =>
      callback(data)
    );
  },

  // Outgoing Proxy event listeners
  onOutgoingProxyCreated: (callback) => {
    ipcRenderer.on("outgoing-proxy-created", (_event, data) => callback(data));
  },
  onOutgoingProxyStarted: (callback) => {
    ipcRenderer.on("outgoing-proxy-started", (_event, data) => callback(data));
  },
  onOutgoingProxyStopped: (callback) => {
    ipcRenderer.on("outgoing-proxy-stopped", (_event, data) => callback(data));
  },
  onOutgoingProxyUpdated: (callback) => {
    ipcRenderer.on("outgoing-proxy-updated", (_event, data) => callback(data));
  },
  onOutgoingProxyRemoved: (callback) => {
    ipcRenderer.on("outgoing-proxy-removed", (_event, data) => callback(data));
  },
  onOutgoingProxyError: (callback) => {
    ipcRenderer.on("outgoing-proxy-error", (_event, data) => callback(data));
  },
  onOutgoingRequest: (callback) => {
    ipcRenderer.on("outgoing-request", (_event, data) => callback(data));
  },
  onOutgoingResponse: (callback) => {
    ipcRenderer.on("outgoing-response", (_event, data) => callback(data));
  },
  onOutgoingError: (callback) => {
    ipcRenderer.on("outgoing-error", (_event, data) => callback(data));
  },
  onOutgoingMockAdded: (callback) => {
    ipcRenderer.on("outgoing-mock-added", (_event, data) => callback(data));
  },
  onOutgoingMockRemoved: (callback) => {
    ipcRenderer.on("outgoing-mock-removed", (_event, data) => callback(data));
  },
  onOutgoingMockToggled: (callback) => {
    ipcRenderer.on("outgoing-mock-toggled", (_event, data) => callback(data));
  },
  onOutgoingMockAutoCreated: (callback) => {
    ipcRenderer.on("outgoing-mock-auto-created", (_event, data) =>
      callback(data)
    );
  },
  onOutgoingMockDifferenceDetected: (callback) => {
    ipcRenderer.on("outgoing-mock-difference-detected", (_event, data) =>
      callback(data)
    );
  },

  // Remove database listeners
  removeDatabaseProxyListener: (event) => ipcRenderer.removeAllListeners(event),
  removeDatabaseMockListener: (event) => ipcRenderer.removeAllListeners(event),
});
