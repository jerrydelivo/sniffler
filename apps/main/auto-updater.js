const { autoUpdater } = require("electron-updater");
const { dialog, BrowserWindow } = require("electron");
const log = require("electron-log");

class SnifflerAutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateCheckInterval = null;
    this.isUpdateAvailable = false;
    this.updateInfo = null;

    // Configure electron-updater
    this.setupAutoUpdater();

    // Configure logging
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = "info";

    log.info("SnifflerAutoUpdater initialized");
  }

  setupAutoUpdater() {
    // Configure update server (GitHub releases)
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "jerrydelivo", // Replace with your GitHub username
      repo: "sniffler-releases", // Replace with your releases repo name
      private: false, // Set to true if your releases repo is private
    });

    // Auto-updater event handlers
    autoUpdater.on("checking-for-update", () => {
      log.info("Checking for update...");
      this.sendToRenderer("update-checking");
    });

    autoUpdater.on("update-available", (info) => {
      log.info("Update available:", info);
      this.isUpdateAvailable = true;
      this.updateInfo = info;
      this.sendToRenderer("update-available", {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      });

      // Show notification to user
      this.showUpdateNotification(info);
    });

    autoUpdater.on("update-not-available", (info) => {
      log.info("Update not available:", info);
      this.sendToRenderer("update-not-available");
    });

    autoUpdater.on("error", (err) => {
      log.error("Update error:", err);
      this.sendToRenderer("update-error", { message: err.message });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      log.info("Download progress:", progressObj);
      this.sendToRenderer("update-download-progress", {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      log.info("Update downloaded:", info);
      this.sendToRenderer("update-downloaded", {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });

      // Show install prompt
      this.showInstallPrompt(info);
    });
  }

  sendToRenderer(event, data = {}) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send("auto-updater", { event, ...data });
    }
  }

  async showUpdateNotification(info) {
    const response = await dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "Update Available",
      message: `Sniffler ${info.version} is available!`,
      detail: `You are currently using version ${autoUpdater.currentVersion}.\n\nWould you like to download the update now?`,
      buttons: ["Download Now", "Download in Background", "Later"],
      defaultId: 0,
      cancelId: 2,
    });

    if (response.response === 0) {
      // Download now (with progress dialog)
      this.downloadUpdate(true);
    } else if (response.response === 1) {
      // Download in background
      this.downloadUpdate(false);
    }
    // If "Later" is selected, do nothing
  }

  async showInstallPrompt(info) {
    const response = await dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "Update Ready to Install",
      message: `Sniffler ${info.version} has been downloaded and is ready to install.`,
      detail:
        "The application will restart to complete the installation. Any running proxies will be stopped and restarted automatically.",
      buttons: ["Install Now", "Install Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (response.response === 0) {
      // Install now
      this.installUpdate();
    }
  }

  // Public methods for manual control
  async checkForUpdates(silent = false) {
    try {
      log.info("Manual update check triggered");
      const result = await autoUpdater.checkForUpdates();

      if (silent && !result.updateInfo) {
        // Only show "no updates" message if not silent
        return { hasUpdate: false };
      }

      return {
        hasUpdate: !!result.updateInfo,
        updateInfo: result.updateInfo,
      };
    } catch (error) {
      log.error("Manual update check failed:", error);
      if (!silent) {
        await dialog.showMessageBox(this.mainWindow, {
          type: "error",
          title: "Update Check Failed",
          message: "Failed to check for updates",
          detail: error.message,
        });
      }
      return { hasUpdate: false, error: error.message };
    }
  }

  downloadUpdate(showProgress = false) {
    log.info("Starting update download");
    autoUpdater.downloadUpdate();

    if (showProgress) {
      this.sendToRenderer("update-download-started");
    }
  }

  installUpdate() {
    log.info("Installing update and restarting app");
    autoUpdater.quitAndInstall(false, true);
  }

  // Auto-check for updates
  startAutoCheck(intervalHours = 24) {
    log.info(`Starting auto-update check every ${intervalHours} hours`);

    // Clear existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    // Check immediately (silently)
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 5000); // Wait 5 seconds after app start

    // Set up periodic checks
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates(true);
    }, intervalHours * 60 * 60 * 1000);
  }

  stopAutoCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      log.info("Auto-update check stopped");
    }
  }

  // Get current status
  getStatus() {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      updateInfo: this.updateInfo,
      currentVersion: autoUpdater.currentVersion,
    };
  }

  // Update settings
  updateSettings(settings) {
    const {
      autoCheck = true,
      checkInterval = 24,
      autoDownload = false,
      autoInstall = false,
    } = settings;

    if (autoCheck) {
      this.startAutoCheck(checkInterval);
    } else {
      this.stopAutoCheck();
    }

    // Configure auto-download
    autoUpdater.autoDownload = autoDownload;
    autoUpdater.autoInstallOnAppQuit = autoInstall;

    log.info("Auto-updater settings updated:", settings);
  }
}

module.exports = SnifflerAutoUpdater;
