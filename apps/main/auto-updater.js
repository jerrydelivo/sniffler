const { autoUpdater } = require("electron-updater");
const { dialog, BrowserWindow } = require("electron");
const log = require("electron-log");

class SnifflerAutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateCheckInterval = null;
    this.isUpdateAvailable = false;
    this.updateInfo = null;
    this.isUpdateInProgress = false; // Flag to track update installation
    this.isSilentCheckInProgress = false; // Flag to suppress noisy errors during silent checks

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

    // Allow prerelease versions to be detected
    autoUpdater.allowPrerelease = true;

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
      // Suppress expected/noisy errors when update feed isn't configured or no releases exist
      const errMsg = (err && (err.message || String(err))) || "";
      const isNoUpdateError =
        /latest\.yml|no latest|not found|404|ENOENT|ENOTFOUND|ECONNREFUSED|ERR_NAME_NOT_RESOLVED|No published versions/i.test(
          errMsg
        );

      if (this.isSilentCheckInProgress || isNoUpdateError) {
        // For silent checks or expected missing-feed errors, just log and do not surface to UI
        log.warn(
          `Update check: feed unavailable or no update found (${errMsg}). Suppressing error notification.`
        );
        return;
      }

      // For unexpected errors only, log and notify renderer in a generic way
      log.error("Update error:", errMsg);
      this.sendToRenderer("update-error", {
        message: "Update service unavailable",
      });
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

    // Additional event handlers to improve restart reliability
    autoUpdater.on("before-quit-for-update", () => {
      log.info("electron-updater: before-quit-for-update event fired");
      this.isUpdateInProgress = true;
    });
  }

  sendToRenderer(event, data = {}) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send("auto-updater", { event, ...data });
    }
  }

  async showUpdateNotification(info) {
    log.info("Showing update notification for version:", info.version);

    // Send to renderer for better UI - ONLY use custom modal
    log.info("Sending update-notification-needed to renderer for custom modal");
    this.sendToRenderer("update-notification-needed", {
      version: info.version,
      currentVersion: autoUpdater.currentVersion,
      releaseNotes: info.releaseNotes,
    });

    // NO native dialog - we now only use the custom modal
    // The renderer will handle all user interaction through the UpdateModal component
    log.info("Custom modal sent to renderer - no native dialog shown");

    // Return immediately - renderer will handle user choice
    return;

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
    // Send to renderer for better UI - ONLY use custom modal
    log.info("Sending update-install-ready to renderer for custom modal");
    this.sendToRenderer("update-install-ready", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });

    // NO native dialog - we now only use the custom modal for install prompt too
    log.info("Custom install modal sent to renderer - no native dialog shown");

    // Return immediately - renderer will handle user choice through UpdateModal
    return;

    // OLD CODE - native dialog removed to prevent modal conflicts
    /*
    const response = await dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "🎉 Update Ready to Install - Sniffler",
      message: `Sniffler ${info.version} has been downloaded and is ready to install!`,
      detail:
        "✅ Download complete and verified\n\n🔄 The application will close and restart to complete the installation.\n\n💾 Any running proxies will be automatically restored.\n\n⚠️ IMPORTANT: Save any work and close other applications if needed.",
      buttons: [
        "🚀 Install Now & Restart",
        "⏳ Install When I Close App",
        "⏰ Install Later",
      ],
      defaultId: 0,
      cancelId: 2,
    });
    */

    // No response handling needed - custom modal handles all user interaction via IPC
  }

  // Public methods for manual control
  async checkForUpdates(silent = false) {
    try {
      log.info("Manual update check triggered");
      // Mark that we're performing a silent check to filter expected errors
      this.isSilentCheckInProgress = !!silent;

      // Check if app is packed (production) - electron-updater only works in packed apps
      if (!autoUpdater.app.isPackaged) {
        log.info("Development mode - simulating update check for testing");

        // In development mode, we can simulate the update check process
        // This allows testing the update intervals and UI without requiring a packed app
        // Never show native dialogs for update checks; keep UX quiet and renderer-driven
        if (!silent) {
          log.info(
            "Development mode update check - no actual updates available"
          );
        }

        return { hasUpdate: false, isDevelopment: true };
      }

      const result = await autoUpdater.checkForUpdates();

      // Handle case where result might be null (shouldn't happen in packed apps, but safety check)
      if (!result) {
        log.warn("Update check returned null result");
        return { hasUpdate: false };
      }

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
      // Don't show native error dialogs; return friendly response
      return { hasUpdate: false, error: "Update server not available" };
    } finally {
      // Always clear the flag after the check completes
      this.isSilentCheckInProgress = false;
    }
  }

  downloadUpdate(showProgress = false) {
    log.info("Starting update download");
    autoUpdater.downloadUpdate();

    if (showProgress) {
      this.sendToRenderer("update-download-started");
    }
  }

  async installUpdate() {
    log.info("Installing update and restarting app");

    // Set the flag to indicate update is in progress
    this.isUpdateInProgress = true;

    try {
      // Notify renderer that installation is starting
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("update-installing", {
          message: "Preparing to install update...",
        });
      }

      // Import app from electron to control the app lifecycle
      const { app } = require("electron");

      log.info("Preparing app for update installation...");

      // DON'T close windows yet - let the restart handle it
      log.info("Skipping window closure - let restart process handle it");

      // Enhanced restart mechanism with platform-specific handling
      log.info(`Platform detected: ${process.platform}`);
      log.info("Attempting update installation and restart...");

      if (process.platform === "win32") {
        // Windows-specific restart handling (both x64 and x32)
        log.info("Using enhanced Windows restart mechanism");
        log.info(`Windows architecture: ${process.arch}`);

        try {
          // Set up install on quit FIRST
          autoUpdater.autoInstallOnAppQuit = true;
          log.info("✅ Set autoInstallOnAppQuit = true for Windows");

          // Method 1: Direct quitAndInstall (most reliable)
          log.info("Windows Method 1: Direct quitAndInstall...");

          // Ensure flag is set and immediately accessible
          this.isUpdateInProgress = true;
          log.info(
            `✅ Confirmed isUpdateInProgress = ${this.isUpdateInProgress}`
          );

          setTimeout(() => {
            try {
              log.info(
                "🚀 Executing quitAndInstall with forceRunAfter=true..."
              );
              log.info(
                "🚀 This should trigger app quit -> before-quit handler will see isUpdateInProgress=true"
              );
              log.info(
                `🚀 Final check: isUpdateInProgress = ${this.isUpdateInProgress}`
              );
              autoUpdater.quitAndInstall(false, true);
              log.info(
                "✅ quitAndInstall executed - waiting for app to quit..."
              );

              // Add timeout to detect if quitAndInstall didn't work
              setTimeout(() => {
                log.warn(
                  "⚠️ quitAndInstall didn't close app after 2 seconds, trying fallback"
                );
                this.forceQuitForUpdate();
              }, 2000);
            } catch (quitError) {
              log.error("❌ quitAndInstall failed:", quitError);

              // Method 2: Manual app quit
              log.info("Windows Method 2: Manual app.quit()...");
              setTimeout(() => {
                log.info("🔄 Calling app.quit() manually...");
                log.info(
                  "🔄 This should trigger before-quit with isUpdateInProgress=true"
                );
                log.info(
                  `🔄 Manual quit check: isUpdateInProgress = ${this.isUpdateInProgress}`
                );
                app.quit();
              }, 1000);
            }
          }, 500);
        } catch (windowsError) {
          log.error("❌ Windows restart setup failed:", windowsError);

          // Fallback: Force quit with exit
          log.info("Windows Fallback: Force exit...");
          setTimeout(() => {
            log.info("🔄 Calling process.exit(0)...");
            process.exit(0);
          }, 2000);
        }
      } else {
        // Non-Windows platforms - use standard electron-updater method
        log.info("Using standard restart mechanism for non-Windows platform");

        try {
          // Use setImmediate to ensure this runs after the current call stack
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });

          // Also set a backup timer
          setTimeout(() => {
            log.warn("quitAndInstall may have failed, trying app.quit...");
            app.quit();
          }, 2000);
        } catch (quitInstallError) {
          log.error(
            "Standard quitAndInstall failed:",
            quitInstallError.message
          );
        }
      }

      // Universal fallback methods (for both Windows and non-Windows)
      if (process.platform === "win32") {
        // Windows fallback methods
        setTimeout(() => {
          log.info(
            "Windows Fallback 1: Setting autoInstallOnAppQuit and app.quit()..."
          );
          autoUpdater.autoInstallOnAppQuit = true;
          app.quit();
        }, 3000);

        setTimeout(() => {
          log.info("Windows Fallback 2: app.exit(0)...");
          app.exit(0);
        }, 5000);

        setTimeout(() => {
          log.info("Windows Fallback 3: process.exit(0)...");
          process.exit(0);
        }, 7000);
      } else {
        // Non-Windows fallback methods
        setTimeout(() => {
          log.info(
            "Fallback 1: Setting autoInstallOnAppQuit and forcing quit..."
          );
          autoUpdater.autoInstallOnAppQuit = true;
          app.quit();
        }, 2500);

        setTimeout(() => {
          log.info("Fallback 2: app.exit(0)...");
          app.exit(0);
        }, 4000);

        setTimeout(() => {
          log.info("Fallback 3: process.exit(0)...");
          process.exit(0);
        }, 6000);
      }
    } catch (error) {
      log.error("Error during update installation:", error);
      this.isUpdateInProgress = false; // Reset flag on error

      // Enhanced fallback with user instructions
      const { shell, app } = require("electron");

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const response = await dialog.showMessageBox(this.mainWindow, {
          type: "warning",
          title: "🔧 Manual Installation Required",
          message: "Automatic installation encountered an issue.",
          detail:
            "The update has been downloaded but automatic restart failed.\n\n" +
            "📁 Options:\n" +
            "1. Open download folder and run installer manually\n" +
            "2. Close Sniffler now and installer will start\n" +
            "3. Set update to install when you close Sniffler later\n\n" +
            "💡 The installer is ready and will preserve all your settings.",
          buttons: [
            "📁 Open Download Folder",
            "🚪 Close App Now",
            "⏰ Install on Exit",
          ],
          defaultId: 1, // Default to "Close App Now"
          cancelId: 2,
        });

        if (response.response === 0) {
          // Open download folder - try multiple possible locations
          try {
            const possiblePaths = [
              process.env.LOCALAPPDATA + "\\sniffler-updater\\pending",
              process.env.USERPROFILE +
                "\\AppData\\Local\\sniffler-updater\\pending",
              process.env.TEMP + "\\sniffler-updater",
            ];

            // Try to open the first path that exists
            const fs = require("fs");
            for (const path of possiblePaths) {
              if (fs.existsSync(path)) {
                shell.showItemInFolder(path);
                break;
              }
            }
          } catch (shellError) {
            log.error("Failed to open download folder:", shellError);
            // Fallback - just open temp directory
            shell.openPath(process.env.TEMP);
          }
        } else if (response.response === 1) {
          // Close app now - this should trigger the installer
          log.info("User chose to close app now for manual installation");
          autoUpdater.autoInstallOnAppQuit = true;
          setTimeout(() => {
            app.quit();
          }, 500);
        } else if (response.response === 2) {
          // Set install on quit
          autoUpdater.autoInstallOnAppQuit = true;
          log.info("Update will install when app is closed manually");

          // Notify renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("update-queued", {
              message:
                "✅ Update will install automatically when you close Sniffler",
            });
          }
        }
      }
    }
  }

  // Auto-check for updates
  startAutoCheck(intervalHours = 24) {
    // Convert to minutes for better logging
    const intervalMinutes = intervalHours * 60;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    log.info(`🔄 Auto-updater configuration:`);
    log.info(
      `   Interval: ${intervalHours} hours (${intervalMinutes.toFixed(
        1
      )} minutes)`
    );
    log.info(`   Interval MS: ${intervalMs}`);
    log.info(
      `   App packaged: ${
        autoUpdater.app ? autoUpdater.app.isPackaged : "unknown"
      }`
    );

    if (intervalMinutes < 60) {
      log.info(
        `Starting auto-update check every ${intervalMinutes.toFixed(1)} minutes`
      );
    } else {
      log.info(`Starting auto-update check every ${intervalHours} hours`);
    }

    // Clear existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      log.info("Cleared existing update check interval");
    }

    // Always check immediately on startup if interval is short (for testing)
    if (intervalHours <= 1) {
      log.info(
        `⏰ Scheduling initial update check in 5 seconds (testing mode)`
      );
      setTimeout(() => {
        log.info("🚀 Running initial update check (testing mode)");
        this.checkForUpdates(true);
      }, 5000); // Wait 5 seconds after app start
    } else {
      // For longer intervals, still do an initial check but make it optional
      log.info(
        `⏰ Scheduling initial update check in 10 seconds (production mode)`
      );
      setTimeout(() => {
        log.info("🚀 Running initial update check (startup)");
        this.checkForUpdates(true);
      }, 10000); // Wait 10 seconds for production intervals
    }

    // Set up periodic checks
    this.updateCheckInterval = setInterval(() => {
      log.info("⏰ Running scheduled update check");
      this.checkForUpdates(true);
    }, intervalMs);

    log.info(
      `Next scheduled update check in ${
        intervalMinutes < 60
          ? intervalMinutes.toFixed(1) + " minutes"
          : intervalHours + " hours"
      }`
    );
  }

  stopAutoCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      log.info("Auto-update check stopped");
    }
  }

  // Force quit for update when normal methods fail
  forceQuitForUpdate() {
    const { app } = require("electron");

    log.warn("🔧 Force quit for update - all normal methods failed");
    log.info(`🔧 isUpdateInProgress flag: ${this.isUpdateInProgress}`);

    try {
      // Ensure the flag is still set
      this.isUpdateInProgress = true;

      // Close the main window first
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        log.info("🔧 Closing main window forcefully");
        this.mainWindow.close();
      }

      // Try app.quit() with flag set
      setTimeout(() => {
        log.info("🔧 Attempting force app.quit()");
        app.quit();
      }, 500);

      // Ultimate fallback - process.exit
      setTimeout(() => {
        log.warn("🔧 Ultimate fallback - calling process.exit(0)");
        process.exit(0);
      }, 2000);
    } catch (error) {
      log.error("🔧 Force quit failed:", error);
      process.exit(0);
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
      checkInterval, // Don't set default here
      autoDownload = false,
      autoInstall = false,
    } = settings;

    // Use explicit check for undefined/null instead of falsy check
    const actualInterval = checkInterval;

    log.info("Auto-updater settings received:", settings);
    log.info(
      `Processed interval: ${actualInterval} hours (${(
        actualInterval * 60
      ).toFixed(1)} minutes)`
    );

    if (autoCheck) {
      this.startAutoCheck(actualInterval);
    } else {
      this.stopAutoCheck();
    }

    // Configure auto-download
    autoUpdater.autoDownload = autoDownload;
    autoUpdater.autoInstallOnAppQuit = autoInstall;

    log.info("Auto-updater settings applied successfully");
  }
}

module.exports = SnifflerAutoUpdater;
