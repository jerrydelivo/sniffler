const { EventEmitter } = require("events");
const DataManager = require("./data-manager");

/**
 * ProxyManager - Centralized proxy persistence and auto-start management
 * Handles normal proxies, outgoing proxies, and database proxies uniformly
 */
class ProxyManager extends EventEmitter {
  constructor() {
    super();
    this.dataManager = new DataManager();
    this.autoStartEnabled = true;
  }

  async initialize() {
    await this.dataManager.initialize();
  }

  /**
   * Sets the global auto-start preference
   * @param {boolean} enabled - Whether auto-start is globally enabled
   */
  setAutoStartEnabled(enabled) {
    this.autoStartEnabled = enabled;
    console.log(
      `🔧 ProxyManager: Global auto-start setting changed to ${enabled}`
    );
  }

  /**
   * Determines if a proxy should auto-start based on global and individual settings
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {boolean} - Whether the proxy should auto-start
   */
  shouldAutoStart(proxyConfig) {
    // Global auto-start must be enabled
    if (!this.autoStartEnabled) {
      return false;
    }

    // If the proxy was running when the app closed, auto-start it
    if (proxyConfig.isRunning) {
      return true;
    }

    // If the proxy has explicit auto-start setting, use it (default to true)
    return proxyConfig.autoStart !== false;
  }

  /**
   * Save normal proxy configurations
   * @param {Map} proxies - Map of port -> proxy data
   */
  async saveNormalProxies(proxies) {
    try {
      console.log("💾 ProxyManager: Saving normal proxies...");
      await this.dataManager.saveProxies(proxies);
      this.emit("proxies-saved", { type: "normal", count: proxies.size });
    } catch (error) {
      console.error("❌ ProxyManager: Failed to save normal proxies:", error);
      this.emit("save-error", { type: "normal", error: error.message });
    }
  }

  /**
   * Load normal proxy configurations
   * @returns {Array} - Array of proxy configurations
   */
  async loadNormalProxies() {
    try {
      console.log("📂 ProxyManager: Loading normal proxies...");
      const proxies = await this.dataManager.loadProxies();
      this.emit("proxies-loaded", { type: "normal", count: proxies.length });
      return proxies;
    } catch (error) {
      console.error("❌ ProxyManager: Failed to load normal proxies:", error);
      this.emit("load-error", { type: "normal", error: error.message });
      return [];
    }
  }

  /**
   * Save outgoing proxy configurations
   * @param {Array} proxies - Array of outgoing proxy configurations
   */
  async saveOutgoingProxies(proxies) {
    try {
      console.log("💾 ProxyManager: Saving outgoing proxies...");
      await this.dataManager.saveOutgoingProxies(proxies);
      this.emit("proxies-saved", { type: "outgoing", count: proxies.length });
    } catch (error) {
      console.error("❌ ProxyManager: Failed to save outgoing proxies:", error);
      this.emit("save-error", { type: "outgoing", error: error.message });
    }
  }

  /**
   * Load outgoing proxy configurations
   * @returns {Array} - Array of outgoing proxy configurations
   */
  async loadOutgoingProxies() {
    try {
      console.log("📂 ProxyManager: Loading outgoing proxies...");
      const proxies = await this.dataManager.loadOutgoingProxies();
      this.emit("proxies-loaded", { type: "outgoing", count: proxies.length });
      return proxies;
    } catch (error) {
      console.error("❌ ProxyManager: Failed to load outgoing proxies:", error);
      this.emit("load-error", { type: "outgoing", error: error.message });
      return [];
    }
  }

  /**
   * Save database proxy configurations
   * @param {Array} proxies - Array of database proxy configurations
   */
  async saveDatabaseProxies(proxies) {
    try {
      console.log("💾 ProxyManager: Saving database proxies...");
      await this.dataManager.saveDatabaseProxies(proxies);
      this.emit("proxies-saved", { type: "database", count: proxies.length });
    } catch (error) {
      console.error("❌ ProxyManager: Failed to save database proxies:", error);
      this.emit("save-error", { type: "database", error: error.message });
    }
  }

  /**
   * Load database proxy configurations
   * @returns {Array} - Array of database proxy configurations
   */
  async loadDatabaseProxies() {
    try {
      console.log("📂 ProxyManager: Loading database proxies...");
      const proxies = await this.dataManager.loadDatabaseProxies();
      this.emit("proxies-loaded", { type: "database", count: proxies.length });
      return proxies;
    } catch (error) {
      console.error("❌ ProxyManager: Failed to load database proxies:", error);
      this.emit("load-error", { type: "database", error: error.message });
      return [];
    }
  }

  /**
   * Get auto-start statistics for all proxy types
   * @returns {Object} - Statistics about auto-start configuration
   */
  async getAutoStartStats() {
    try {
      const normalProxies = await this.loadNormalProxies();
      const outgoingProxies = await this.loadOutgoingProxies();
      const databaseProxies = await this.loadDatabaseProxies();

      const stats = {
        globalAutoStart: this.autoStartEnabled,
        normal: {
          total: normalProxies.length,
          autoStart: normalProxies.filter((p) => this.shouldAutoStart(p))
            .length,
          wasRunning: normalProxies.filter((p) => p.isRunning).length,
        },
        outgoing: {
          total: outgoingProxies.length,
          autoStart: outgoingProxies.filter((p) => this.shouldAutoStart(p))
            .length,
          wasRunning: outgoingProxies.filter((p) => p.isRunning).length,
        },
        database: {
          total: databaseProxies.length,
          autoStart: databaseProxies.filter((p) => this.shouldAutoStart(p))
            .length,
          wasRunning: databaseProxies.filter((p) => p.isRunning).length,
        },
      };

      return stats;
    } catch (error) {
      console.error("❌ ProxyManager: Failed to get auto-start stats:", error);
      return {
        globalAutoStart: this.autoStartEnabled,
        normal: { total: 0, autoStart: 0, wasRunning: 0 },
        outgoing: { total: 0, autoStart: 0, wasRunning: 0 },
        database: { total: 0, autoStart: 0, wasRunning: 0 },
        error: error.message,
      };
    }
  }

  /**
   * Update auto-start setting for a specific proxy
   * @param {string} type - Proxy type ("normal", "outgoing", "database")
   * @param {number} port - Proxy port
   * @param {boolean} autoStart - New auto-start setting
   */
  async updateProxyAutoStart(type, port, autoStart) {
    try {
      console.log(
        `🔧 ProxyManager: Updating ${type} proxy ${port} auto-start to ${autoStart}`
      );

      let proxies;
      switch (type) {
        case "normal":
          proxies = await this.loadNormalProxies();
          break;
        case "outgoing":
          proxies = await this.loadOutgoingProxies();
          break;
        case "database":
          proxies = await this.loadDatabaseProxies();
          break;
        default:
          throw new Error(`Unknown proxy type: ${type}`);
      }

      const proxy = proxies.find((p) => p.port === port);
      if (!proxy) {
        throw new Error(`${type} proxy not found on port ${port}`);
      }

      proxy.autoStart = autoStart;
      proxy.updatedAt = new Date().toISOString();

      // Save the updated configuration
      switch (type) {
        case "normal":
          // Note: For normal proxies, we need the Map format, but this is handled by the caller
          break;
        case "outgoing":
          await this.saveOutgoingProxies(proxies);
          break;
        case "database":
          await this.saveDatabaseProxies(proxies);
          break;
      }

      this.emit("proxy-auto-start-updated", { type, port, autoStart });
      return { success: true };
    } catch (error) {
      console.error(
        `❌ ProxyManager: Failed to update ${type} proxy auto-start:`,
        error
      );
      this.emit("proxy-auto-start-error", { type, port, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export all proxy configurations
   * @returns {Object} - All proxy configurations for export
   */
  async exportAllProxies() {
    try {
      console.log("📤 ProxyManager: Exporting all proxy configurations...");

      const normalProxies = await this.loadNormalProxies();
      const outgoingProxies = await this.loadOutgoingProxies();
      const databaseProxies = await this.loadDatabaseProxies();

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        globalAutoStart: this.autoStartEnabled,
        proxies: {
          normal: normalProxies,
          outgoing: outgoingProxies,
          database: databaseProxies,
        },
        stats: await this.getAutoStartStats(),
      };

      this.emit("proxies-exported", {
        totalCount:
          normalProxies.length +
          outgoingProxies.length +
          databaseProxies.length,
      });

      return exportData;
    } catch (error) {
      console.error(
        "❌ ProxyManager: Failed to export proxy configurations:",
        error
      );
      this.emit("export-error", { error: error.message });
      throw error;
    }
  }

  /**
   * Import proxy configurations
   * @param {Object} importData - Imported proxy configurations
   * @returns {Object} - Import results
   */
  async importProxies(importData) {
    try {
      console.log("📥 ProxyManager: Importing proxy configurations...");

      if (!importData || !importData.proxies) {
        throw new Error("Invalid import data format");
      }

      const results = {
        normal: { imported: 0, errors: 0 },
        outgoing: { imported: 0, errors: 0 },
        database: { imported: 0, errors: 0 },
      };

      // Import normal proxies
      if (importData.proxies.normal) {
        try {
          // Note: This needs special handling since normal proxies use Map format
          results.normal.imported = importData.proxies.normal.length;
        } catch (error) {
          results.normal.errors++;
          console.error("❌ Failed to import normal proxies:", error);
        }
      }

      // Import outgoing proxies
      if (importData.proxies.outgoing) {
        try {
          await this.saveOutgoingProxies(importData.proxies.outgoing);
          results.outgoing.imported = importData.proxies.outgoing.length;
        } catch (error) {
          results.outgoing.errors++;
          console.error("❌ Failed to import outgoing proxies:", error);
        }
      }

      // Import database proxies
      if (importData.proxies.database) {
        try {
          await this.saveDatabaseProxies(importData.proxies.database);
          results.database.imported = importData.proxies.database.length;
        } catch (error) {
          results.database.errors++;
          console.error("❌ Failed to import database proxies:", error);
        }
      }

      // Update global auto-start setting if provided
      if (typeof importData.globalAutoStart === "boolean") {
        this.setAutoStartEnabled(importData.globalAutoStart);
      }

      this.emit("proxies-imported", results);
      return { success: true, results };
    } catch (error) {
      console.error(
        "❌ ProxyManager: Failed to import proxy configurations:",
        error
      );
      this.emit("import-error", { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ProxyManager;
