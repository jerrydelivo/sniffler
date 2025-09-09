const fs = require("fs/promises");
const path = require("path");
const os = require("os");

class DataManager {
  constructor() {
    // Support both Electron and standalone contexts
    try {
      const { app } = require("electron");
      this.userDataPath = app.getPath("userData");
    } catch (error) {
      // Fallback for standalone usage
      this.userDataPath = path.join(os.homedir(), ".sniffler");
    }
    this.dataDir = path.join(this.userDataPath, "sniffler-data");
    this.proxiesFile = path.join(this.dataDir, "proxies.json");
    this.mocksDir = path.join(this.dataDir, "mocks");
    this.requestsDir = path.join(this.dataDir, "requests");
    this.outgoingDir = path.join(this.dataDir, "outgoing");
    this.outgoingProxiesFile = path.join(this.outgoingDir, "proxies.json");
    this.outgoingSystemsFile = path.join(this.outgoingDir, "systems.json");
    this.outgoingRequestsDir = path.join(this.outgoingDir, "requests");
    this.outgoingMocksDir = path.join(this.outgoingDir, "mocks");
    this.databaseDir = path.join(this.dataDir, "database");
    this.databaseProxiesFile = path.join(this.databaseDir, "proxies.json");
    this.databaseRequestsDir = path.join(this.databaseDir, "requests");
    this.databaseMocksDir = path.join(this.databaseDir, "mocks");
  }

  async initialize() {
    await this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.mocksDir, { recursive: true });
      await fs.mkdir(this.requestsDir, { recursive: true });
      await fs.mkdir(this.outgoingDir, { recursive: true });
      await fs.mkdir(this.outgoingRequestsDir, { recursive: true });
      await fs.mkdir(this.outgoingMocksDir, { recursive: true });
      await fs.mkdir(this.databaseDir, { recursive: true });
      await fs.mkdir(this.databaseRequestsDir, { recursive: true });
      await fs.mkdir(this.databaseMocksDir, { recursive: true });
    } catch (error) {
      // Handle error silently
    }
  }

  // Proxy Configuration Persistence
  async saveProxies(proxies) {
    try {
      console.log("💾 DataManager: Saving normal proxies...");

      const proxyConfigs = Array.from(proxies.entries()).map(
        ([port, data]) => ({
          port,
          name: data.name,
          targetHost: data.targetHost,
          targetPort: data.targetPort,
          isRunning: data.proxy.isRunning,
          createdAt: data.createdAt || new Date().toISOString(),
          lastStarted: data.proxy.isRunning
            ? new Date().toISOString()
            : data.lastStarted,
          autoStart: data.autoStart !== false, // Default to true unless explicitly set to false
        })
      );

      const proxyData = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        proxies: proxyConfigs,
      };

      await fs.writeFile(this.proxiesFile, JSON.stringify(proxyData, null, 2));

      console.log(
        `✅ DataManager: Successfully saved ${proxyConfigs.length} normal proxies`
      );
    } catch (error) {
      console.error("❌ DataManager: Failed to save normal proxies:", error);
    }
  }

  async loadProxies() {
    try {
      console.log("📂 DataManager: Loading normal proxies...");
      console.log("📂 Reading from file:", this.proxiesFile);
      const data = await fs.readFile(this.proxiesFile, "utf8");

      if (!data.trim()) {
        console.log("📂 No proxy data found (empty file)");
        return [];
      }

      console.log("📂 File contents:", data.substring(0, 200) + "...");
      const parsedData = JSON.parse(data);
      console.log(
        "📂 Parsed data type:",
        typeof parsedData,
        "isArray:",
        Array.isArray(parsedData)
      );

      // Handle both old format (direct array) and new format (object with version)
      let proxyConfigs;
      if (Array.isArray(parsedData)) {
        // Old format - migrate to new format
        console.log("📂 Using old format (direct array)");
        proxyConfigs = parsedData;
      } else {
        // New format
        console.log("📂 Using new format (object with version)");
        proxyConfigs = parsedData.proxies || [];
      }

      if (!Array.isArray(proxyConfigs)) {
        console.log("📂 Invalid proxy config format, returning empty array");
        return [];
      }

      console.log(
        `📂 Successfully loaded ${proxyConfigs.length} normal proxy configurations`
      );
      return proxyConfigs;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("📂 No proxy configuration file found, starting fresh");
        return [];
      } else if (error instanceof SyntaxError) {
        console.error(
          "📂 Corrupted proxy config file, backing up and starting fresh"
        );
        try {
          await fs.copyFile(
            this.proxiesFile,
            `${this.proxiesFile}.backup-${Date.now()}`
          );
          await fs.unlink(this.proxiesFile);
        } catch (backupError) {
          console.error("❌ Failed to backup corrupted file:", backupError);
        }
        return [];
      } else {
        console.error("❌ Failed to load proxy configurations:", error);
        return [];
      }
    }
  } // Mock Persistence
  async saveMocks(port, mocks, maxMocks = 1000) {
    try {
      const mockFile = path.join(this.mocksDir, `mocks-${port}.json`);

      const mockArray = Array.isArray(mocks)
        ? mocks
        : Array.from(mocks.values());

      const sortedMocks = mockArray.sort(
        (a, b) =>
          new Date(b.createdAt || "1970-01-01") -
          new Date(a.createdAt || "1970-01-01")
      );
      const limitedMocks = sortedMocks.slice(0, maxMocks);

      const mockData = {
        port,
        mocks: limitedMocks,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      };

      await fs.writeFile(mockFile, JSON.stringify(mockData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadMocks(port) {
    try {
      const mockFile = path.join(this.mocksDir, `mocks-${port}.json`);
      const data = await fs.readFile(mockFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const mockData = JSON.parse(data);
      return mockData.mocks;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  async deleteMocks(port) {
    try {
      const mockFile = path.join(this.mocksDir, `mocks-${port}.json`);
      await fs.unlink(mockFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  // Request History Persistence
  async saveRequests(port, requests, maxRequests = 100) {
    try {
      const requestFile = path.join(this.requestsDir, `requests-${port}.json`);

      const limitedRequests = Array.isArray(requests)
        ? requests.slice(0, maxRequests)
        : [];

      const requestData = {
        port,
        requests: limitedRequests,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      };

      await fs.writeFile(requestFile, JSON.stringify(requestData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadRequests(port) {
    try {
      const requestFile = path.join(this.requestsDir, `requests-${port}.json`);
      const data = await fs.readFile(requestFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const requestData = JSON.parse(data);
      return requestData.requests;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  async deleteRequests(port) {
    try {
      const requestFile = path.join(this.requestsDir, `requests-${port}.json`);
      await fs.unlink(requestFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  // Cleanup old data
  async cleanup() {
    try {
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const cutoffDate = new Date(Date.now() - maxAge);

      const requestFiles = await fs.readdir(this.requestsDir);
      for (const file of requestFiles) {
        const filePath = path.join(this.requestsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      // Handle error silently
    }
  }

  // Clear all data
  async clearAllData() {
    try {
      await fs.unlink(this.proxiesFile).catch(() => {});

      const mockFiles = await fs.readdir(this.mocksDir).catch(() => []);
      for (const file of mockFiles) {
        await fs.unlink(path.join(this.mocksDir, file)).catch(() => {});
      }

      const requestFiles = await fs.readdir(this.requestsDir).catch(() => []);
      for (const file of requestFiles) {
        await fs.unlink(path.join(this.requestsDir, file)).catch(() => {});
      }
    } catch (error) {
      // Handle error silently
    }
  }

  // Export/Import functionality
  async exportAllData() {
    try {
      const proxies = await this.loadProxies();
      const allMocks = {};
      const allRequests = {};

      for (const proxy of proxies) {
        allMocks[proxy.port] = await this.loadMocks(proxy.port);
        allRequests[proxy.port] = await this.loadRequests(proxy.port);
      }

      const outgoingSystems = await this.loadOutgoingSystems();
      const outgoingRequests = {};
      for (const system of outgoingSystems) {
        outgoingRequests[system.id] = await this.loadOutgoingRequests(
          system.id
        );
      }

      const outgoingMocks = await this.loadOutgoingMocks();

      return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        proxies,
        mocks: allMocks,
        requests: allRequests,
        outgoingSystems,
        outgoingRequests,
        outgoingMocks,
        settings: await this.loadSettings(),
      };
    } catch (error) {
      return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        proxies: [],
        mocks: {},
        requests: {},
        outgoingSystems: [],
        outgoingRequests: {},
        outgoingMocks: [],
        settings: {},
        error: error.message,
      };
    }
  }

  async importAllData(importData) {
    try {
      if (importData.proxies) {
        await fs.writeFile(
          this.proxiesFile,
          JSON.stringify(importData.proxies, null, 2)
        );
      }

      if (importData.mocks) {
        for (const [port, mocks] of Object.entries(importData.mocks)) {
          await this.saveMocks(parseInt(port), mocks);
        }
      }

      if (importData.requests) {
        for (const [port, requests] of Object.entries(importData.requests)) {
          await this.saveRequests(parseInt(port), requests);
        }
      }

      if (importData.outgoingSystems) {
        await this.saveOutgoingSystems(importData.outgoingSystems);
      }

      if (importData.outgoingRequests) {
        for (const [systemId, requests] of Object.entries(
          importData.outgoingRequests
        )) {
          await this.saveOutgoingRequests(systemId, requests);
        }
      }

      if (importData.outgoingMocks) {
        await this.saveOutgoingMocks(importData.outgoingMocks);
      }

      if (importData.settings) {
        await this.saveSettings(importData.settings);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Settings Persistence
  async saveSettings(settings) {
    try {
      const settingsFile = path.join(this.dataDir, "settings.json");
      await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadSettings() {
    try {
      const settingsFile = path.join(this.dataDir, "settings.json");
      const data = await fs.readFile(settingsFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        const defaultSettings = {
          defaultProxyPort: 8080,
          autoStartProxy: true,
          runAtStartup: false, // Run Sniffler at Windows startup - default to false for less intrusive behavior
          enableHttps: true,
          maxRequestHistory: 100,
          maxMockHistory: 1000,
          autoSaveRequests: true, // Save request history to disk
          autoSaveRequestsAsMocks: true,
          enablePatternMatching: true,
          mockOutgoingRequests: true,
          mockDatabaseRequests: true,
          saveNewOutgoingRequestsAsMocks: false,
          saveNewDatabaseRequestsAsMocks: true,
        };
        return defaultSettings;
      }
      throw error;
    }
  }

  // Outgoing Request Systems Persistence
  async saveOutgoingSystems(systems) {
    try {
      await this.ensureDirectories();
      await fs.writeFile(
        this.outgoingSystemsFile,
        JSON.stringify(systems, null, 2)
      );
    } catch (error) {
      // Handle error silently
    }
  }

  async loadOutgoingSystems() {
    try {
      const data = await fs.readFile(this.outgoingSystemsFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      return [];
    }
  }

  // Outgoing Request History Persistence
  async saveOutgoingRequests(systemId, requests, maxRequests = 500) {
    try {
      const requestFile = path.join(
        this.outgoingRequestsDir,
        `${systemId}.json`
      );

      const limitedRequests = Array.isArray(requests)
        ? requests.slice(0, maxRequests)
        : [];

      const requestData = {
        systemId,
        requests: limitedRequests,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      };

      await fs.writeFile(requestFile, JSON.stringify(requestData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadOutgoingRequests(systemId) {
    try {
      const requestFile = path.join(
        this.outgoingRequestsDir,
        `${systemId}.json`
      );
      const data = await fs.readFile(requestFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const requestData = JSON.parse(data);
      return requestData.requests || [];
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      return [];
    }
  }

  async deleteOutgoingRequests(systemId) {
    try {
      const requestFile = path.join(
        this.outgoingRequestsDir,
        `${systemId}.json`
      );
      await fs.unlink(requestFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  async deleteOutgoingSystem(systemId) {
    try {
      await this.deleteOutgoingRequests(systemId);

      const systems = await this.loadOutgoingSystems();
      const updatedSystems = systems.filter((system) => system.id !== systemId);
      await this.saveOutgoingSystems(updatedSystems);
    } catch (error) {
      // Handle error silently
    }
  }

  // Outgoing Proxy Configuration Persistence
  async saveOutgoingProxies(proxies) {
    try {
      console.log("� DataManager: Saving outgoing proxies...", {
        proxiesCount: proxies.length,
        outgoingProxiesFile: this.outgoingProxiesFile,
      });
      await this.ensureDirectories();

      // Ensure each proxy has proper structure with auto-start settings
      const normalizedProxies = (proxies || []).map((proxy) => ({
        ...proxy,
        autoStart: proxy.autoStart !== false, // Default to true unless explicitly set to false
        lastStarted: proxy.isRunning
          ? new Date().toISOString()
          : proxy.lastStarted,
      }));

      const proxyData = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        proxies: normalizedProxies,
      };

      console.log("📂 Writing to file:", this.outgoingProxiesFile);
      await fs.writeFile(
        this.outgoingProxiesFile,
        JSON.stringify(proxyData, null, 2)
      );
      console.log(
        `✅ DataManager: Successfully saved ${normalizedProxies.length} outgoing proxies`
      );
    } catch (error) {
      console.error("❌ DataManager: Failed to save outgoing proxies:", error);
    }
  }

  async loadOutgoingProxies() {
    try {
      console.log("📂 DataManager: Loading outgoing proxies...");
      const data = await fs.readFile(this.outgoingProxiesFile, "utf8");

      if (!data.trim()) {
        console.log("📂 No outgoing proxy data found (empty file)");
        return [];
      }

      const parsedData = JSON.parse(data);

      // Handle both old format (direct array) and new format (object with version)
      let proxies;
      if (Array.isArray(parsedData)) {
        // Old format - migrate to new format
        proxies = parsedData;
      } else {
        // New format
        proxies = parsedData.proxies || [];
      }

      const normalizedProxies = Array.isArray(proxies) ? proxies : [];

      console.log(
        `📂 Successfully loaded ${normalizedProxies.length} outgoing proxy configurations`
      );
      return normalizedProxies;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(
          "📂 No outgoing proxy configuration file found, starting fresh"
        );
        return [];
      } else if (error instanceof SyntaxError) {
        console.error(
          "📂 Corrupted outgoing proxy config file, backing up and starting fresh"
        );
        try {
          await fs.copyFile(
            this.outgoingProxiesFile,
            `${this.outgoingProxiesFile}.backup-${Date.now()}`
          );
          await fs.unlink(this.outgoingProxiesFile);
        } catch (backupError) {
          console.error(
            "❌ Failed to backup corrupted outgoing proxy file:",
            backupError
          );
        }
        return [];
      } else {
        console.error(
          "❌ Failed to load outgoing proxy configurations:",
          error
        );
        return [];
      }
    }
  }

  async deleteOutgoingProxy(port) {
    try {
      // For now, we'll just reload and save without this proxy
      // This will be handled by the main proxy management logic
    } catch (error) {
      // Handle error silently
    }
  }

  // Outgoing Mocks Persistence
  async saveOutgoingMocks(mocks) {
    try {
      const mockFile = path.join(this.outgoingMocksDir, "outgoing-mocks.json");
      const mockData = {
        mocks: Array.isArray(mocks) ? mocks : Array.from(mocks.values()),
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      };

      await fs.writeFile(mockFile, JSON.stringify(mockData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadOutgoingMocks() {
    try {
      const mockFile = path.join(this.outgoingMocksDir, "outgoing-mocks.json");
      const data = await fs.readFile(mockFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const mockData = JSON.parse(data);
      return Array.isArray(mockData.mocks) ? mockData.mocks : [];
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  async deleteOutgoingMocks() {
    try {
      const mockFile = path.join(this.outgoingMocksDir, "outgoing-mocks.json");
      await fs.unlink(mockFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  // Database Proxy Configuration Persistence
  async saveDatabaseProxies(proxies) {
    try {
      console.log("💾 DataManager: Saving database proxies...");

      const proxyConfigs = Array.isArray(proxies) ? proxies : [];

      // Ensure each proxy has proper structure with auto-start settings
      const normalizedConfigs = proxyConfigs.map((proxy) => ({
        ...proxy,
        autoStart: proxy.autoStart !== false, // Default to true unless explicitly set to false
        lastStarted: proxy.isRunning
          ? new Date().toISOString()
          : proxy.lastStarted,
      }));

      const proxyData = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        proxies: normalizedConfigs,
      };

      await fs.writeFile(
        this.databaseProxiesFile,
        JSON.stringify(proxyData, null, 2)
      );

      console.log(
        `✅ DataManager: Successfully saved ${normalizedConfigs.length} database proxies`
      );
    } catch (error) {
      console.error("❌ DataManager: Failed to save database proxies:", error);
    }
  }

  async loadDatabaseProxies() {
    try {
      console.log("📂 DataManager: Loading database proxies...");
      const data = await fs.readFile(this.databaseProxiesFile, "utf8");

      if (!data.trim()) {
        console.log("📂 No database proxy data found (empty file)");
        return [];
      }

      const parsedData = JSON.parse(data);

      // Handle both old format (direct array) and new format (object with version)
      let proxyConfigs;
      if (Array.isArray(parsedData)) {
        // Old format - migrate to new format
        proxyConfigs = parsedData;
      } else {
        // New format
        proxyConfigs = parsedData.proxies || [];
      }

      const normalizedConfigs = Array.isArray(proxyConfigs) ? proxyConfigs : [];

      console.log(
        `📂 Successfully loaded ${normalizedConfigs.length} database proxy configurations`
      );
      return normalizedConfigs;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(
          "📂 No database proxy configuration file found, starting fresh"
        );
        return [];
      } else if (error instanceof SyntaxError) {
        console.error(
          "📂 Corrupted database proxy config file, backing up and starting fresh"
        );
        try {
          await fs.copyFile(
            this.databaseProxiesFile,
            `${this.databaseProxiesFile}.backup-${Date.now()}`
          );
          await fs.unlink(this.databaseProxiesFile);
        } catch (backupError) {
          console.error(
            "❌ Failed to backup corrupted database proxy file:",
            backupError
          );
        }
        return [];
      } else {
        console.error(
          "❌ Failed to load database proxy configurations:",
          error
        );
        return [];
      }
    }
  }

  async deleteDatabaseProxies() {
    try {
      await fs.unlink(this.databaseProxiesFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  // Database Request Persistence
  async saveDatabaseRequest(proxyPort, request) {
    try {
      const requestFile = path.join(
        this.databaseRequestsDir,
        `database-requests-${proxyPort}.json`
      );

      let existingRequests = [];
      try {
        const data = await fs.readFile(requestFile, "utf8");
        if (data.trim()) {
          const parsed = JSON.parse(data);
          existingRequests = parsed.requests || [];
        }
      } catch (error) {
        // File doesn't exist or is corrupted, start fresh
      }

      existingRequests.unshift(request);

      const maxRequests = 500;
      if (existingRequests.length > maxRequests) {
        existingRequests = existingRequests.slice(0, maxRequests);
      }

      const requestData = {
        proxyPort,
        requests: existingRequests,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
      };

      await fs.writeFile(requestFile, JSON.stringify(requestData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadDatabaseRequests(proxyPort) {
    try {
      const requestFile = path.join(
        this.databaseRequestsDir,
        `database-requests-${proxyPort}.json`
      );
      const data = await fs.readFile(requestFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const requestData = JSON.parse(data);
      return requestData.requests || [];
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  async deleteAllDatabaseRequests() {
    try {
      const files = await fs.readdir(this.databaseRequestsDir);
      for (const file of files) {
        if (file.startsWith("database-requests-")) {
          await fs.unlink(path.join(this.databaseRequestsDir, file));
        }
      }
    } catch (error) {
      // Handle error silently
    }
  }

  async deleteDatabaseRequestsForProxy(proxyPort) {
    try {
      const requestFile = path.join(
        this.databaseRequestsDir,
        `database-requests-${proxyPort}.json`
      );
      await fs.unlink(requestFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }

  // Database Mock Persistence - Grouped by Database Name
  async saveDatabaseMocks(mocks) {
    try {
      // Group mocks by database name (proxyName)
      const mocksByDatabase = {};
      const mockArray = Array.isArray(mocks)
        ? mocks
        : Array.from(mocks.values());

      for (const mock of mockArray) {
        const databaseName =
          mock.proxyName || `port-${mock.proxyPort}` || "unknown";
        const sanitizedName = databaseName.replace(/[^a-zA-Z0-9-_]/g, "-");

        if (!mocksByDatabase[sanitizedName]) {
          mocksByDatabase[sanitizedName] = [];
        }
        mocksByDatabase[sanitizedName].push(mock);
      }

      // Save each database's mocks in a separate file
      for (const [databaseName, databaseMocks] of Object.entries(
        mocksByDatabase
      )) {
        const mockFile = path.join(
          this.databaseMocksDir,
          `${databaseName}-mocks.json`
        );
        const mockData = {
          databaseName,
          mocks: databaseMocks,
          lastUpdated: new Date().toISOString(),
          version: "1.0",
          mockCount: databaseMocks.length,
        };

        await fs.writeFile(mockFile, JSON.stringify(mockData, null, 2));
      }

      // Also maintain the main database-mocks.json file for backward compatibility
      const mockFile = path.join(this.databaseMocksDir, "database-mocks.json");
      const mockData = {
        mocks: mockArray,
        lastUpdated: new Date().toISOString(),
        version: "1.0",
        groupedByDatabase: true, // Flag to indicate this format is used
      };

      await fs.writeFile(mockFile, JSON.stringify(mockData, null, 2));
    } catch (error) {
      // Handle error silently
    }
  }

  async loadDatabaseMocks() {
    try {
      // First try to load from grouped files
      const mockFiles = await fs.readdir(this.databaseMocksDir).catch(() => []);
      const groupedFiles = mockFiles.filter(
        (file) => file.endsWith("-mocks.json") && file !== "database-mocks.json"
      );

      if (groupedFiles.length > 0) {
        // Load from grouped files
        const allMocks = [];
        for (const file of groupedFiles) {
          try {
            const filePath = path.join(this.databaseMocksDir, file);
            const data = await fs.readFile(filePath, "utf8");

            if (data.trim()) {
              const mockData = JSON.parse(data);
              if (Array.isArray(mockData.mocks)) {
                allMocks.push(...mockData.mocks);
              }
            }
          } catch (error) {
            // Skip corrupted files
            continue;
          }
        }
        return allMocks;
      }

      // Fallback to main file for backward compatibility
      const mockFile = path.join(this.databaseMocksDir, "database-mocks.json");
      const data = await fs.readFile(mockFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const mockData = JSON.parse(data);
      return Array.isArray(mockData.mocks) ? mockData.mocks : [];
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  // Load database mocks for a specific database/proxy
  async loadDatabaseMocksForDatabase(databaseName) {
    try {
      const sanitizedName = databaseName.replace(/[^a-zA-Z0-9-_]/g, "-");
      const mockFile = path.join(
        this.databaseMocksDir,
        `${sanitizedName}-mocks.json`
      );
      const data = await fs.readFile(mockFile, "utf8");

      if (!data.trim()) {
        return [];
      }

      const mockData = JSON.parse(data);
      return Array.isArray(mockData.mocks) ? mockData.mocks : [];
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      } else if (error instanceof SyntaxError) {
        return [];
      } else {
        return [];
      }
    }
  }

  async deleteDatabaseMocks() {
    try {
      // Delete the main file
      await fs.unlink(path.join(this.databaseMocksDir, "database-mocks.json"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }

    try {
      // Delete all grouped database mock files
      const mockFiles = await fs.readdir(this.databaseMocksDir).catch(() => []);
      const groupedFiles = mockFiles.filter(
        (file) => file.endsWith("-mocks.json") && file !== "database-mocks.json"
      );

      for (const file of groupedFiles) {
        try {
          await fs.unlink(path.join(this.databaseMocksDir, file));
        } catch (error) {
          // Continue with other files if one fails
        }
      }
    } catch (error) {
      // Handle error silently
    }
  }

  // Delete database mocks for a specific database/proxy
  async deleteDatabaseMocksForDatabase(databaseName) {
    try {
      const sanitizedName = databaseName.replace(/[^a-zA-Z0-9-_]/g, "-");
      const mockFile = path.join(
        this.databaseMocksDir,
        `${sanitizedName}-mocks.json`
      );
      await fs.unlink(mockFile);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Handle error silently
      }
    }
  }
}

module.exports = DataManager;
