const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell,
  nativeImage,
} = require("electron");
const path = require("path");
// Load environment variables from apps/main/.env to configure runtime (e.g., licensing API URL)
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.join(__dirname, ".env") });
  if (process.env.SNIFFLER_LICENSING_API_URL) {
    console.log(
      `🔧 Loaded SNIFFLER_LICENSING_API_URL from .env: ${process.env.SNIFFLER_LICENSING_API_URL}`
    );
  }
} catch (e) {
  // Optional: dotenv not strictly required in production packaged app
}
const fs = require("fs").promises;
const SnifflerProxy = require("./proxy");
const DatabaseSniffer = require("./database-sniffer");
const DatabaseProxyInterceptor = require("./database-proxy-interceptor");
const DataManager = require("./data-manager");
const ProxyManager = require("./proxy-manager");
const OutgoingInterceptor = require("./outgoing-interceptor");
const { shouldCreateMockForRequest } = require("./requestPatterns");
const SnifflerAutoUpdater = require("./auto-updater");
const LicenseManager = require("./license-manager");

// Helper function to safely serialize request data for IPC
const sanitizeRequestForIPC = (request) => {
  // Create a deep copy and ensure all data is safely serializable
  const sanitized = {
    ...request,
    // Ensure body is a string, not a Buffer
    body:
      request.body && typeof request.body !== "string"
        ? String(request.body)
        : request.body,
    response: request.response
      ? {
          ...request.response,
          // Ensure response body is a string, not a Buffer
          body:
            request.response.body && typeof request.response.body !== "string"
              ? String(request.response.body)
              : request.response.body,
        }
      : null,
  };
  return sanitized;
};

// Register custom protocol for deep linking
console.log(`🔗 [STARTUP] Registering sniffler:// protocol handler...`);
const protocolResult = app.setAsDefaultProtocolClient("sniffler");
console.log(`🔗 [STARTUP] Protocol registration result: ${protocolResult}`);

// Global error handlers to catch uncaught exceptions and promise rejections
process.on("uncaughtException", (error) => {
  // console.error("💥 Uncaught Exception:", error);
  // console.error("Stack trace:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  // console.error("💥 Unhandled Promise Rejection at:", promise);
  // console.error("Reason:", reason);
  // console.error("Stack trace:", reason?.stack || "No stack trace available");
});

let mainWindow;
let autoUpdater;
let licenseManager;
const proxies = new Map();
const databaseSniffer = new DatabaseSniffer();
const databaseProxyInterceptor = new DatabaseProxyInterceptor();
const dataManager = new DataManager();
const proxyManager = new ProxyManager();
const outgoingInterceptor = new OutgoingInterceptor();
const appVersion = require("../../package.json").version;

// Ensure Windows uses our App User Model ID so taskbar/title icons are correct
try {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.sniffle.app");
  }
} catch {}

// Determine if developer tools should be enabled (dev-only)
// This is controlled via the SNIFFLER_DEVTOOLS env var, which we set in the dev script.
const devToolsEnabled = process.env.SNIFFLER_DEVTOOLS === "1";

// Helper function to save settings
const saveSettings = async () => {
  try {
    await dataManager.saveSettings(appSettings);
  } catch (error) {
    // console.error("Failed to save settings:", error);
  }
};

// Helper function to configure startup behavior
const configureStartup = (enable) => {
  try {
    if (process.platform === "win32") {
      app.setLoginItemSettings({
        openAtLogin: enable,
        path: process.execPath,
        args: ["--hidden"], // Start minimized
      });
    }
  } catch (error) {
    // console.error("Failed to configure startup:", error);
  }
};

// Handle custom protocol URLs (sniffler://)
const handleProtocolUrl = (url) => {
  try {
    console.log(`🔗 [PROTOCOL HANDLER] Processing protocol URL: ${url}`);
    console.log(
      `🔗 [PROTOCOL HANDLER] URL received at: ${new Date().toISOString()}`
    );

    const urlObj = new URL(url);
    const protocol = urlObj.protocol; // 'sniffler:'
    const action = urlObj.hostname; // e.g., 'payment-success'
    const searchParams = urlObj.searchParams;

    console.log(
      `🔗 [PROTOCOL HANDLER] Protocol: ${protocol}, Action: ${action}`
    );

    // Handle different actions
    switch (action) {
      case "payment-success":
        const sessionId = searchParams.get("session_id");
        console.log(`💳 Payment success detected, session ID: ${sessionId}`);

        // Focus the main window
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.show(); // Ensure window is visible

          // Send payment success event to renderer
          mainWindow.webContents.send("stripe-payment-success", {
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
          });

          // Also show a system notification
          const { Notification } = require("electron");
          if (Notification.isSupported()) {
            new Notification({
              title: "Payment Successful!",
              body: "Your Sniffler Pro license is being activated...",
              icon: path.join(__dirname, "../../build/icon.png"),
            }).show();
          }

          console.log(`📤 Sent payment success event to renderer`);
        } else {
          console.warn(
            `⚠️ Cannot handle payment success - main window not available`
          );
        }
        break;

      case "payment-cancelled":
        console.log(`💳 Payment cancelled detected`);

        // Focus the main window
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();

          // Send payment cancelled event to renderer
          mainWindow.webContents.send("stripe-payment-cancelled", {
            timestamp: new Date().toISOString(),
          });

          console.log(`📤 Sent payment cancelled event to renderer`);
        } else {
          console.warn(
            `⚠️ Cannot handle payment cancellation - main window not available`
          );
        }
        break;

      default:
        console.warn(`⚠️ Unknown protocol action: ${action}`);

        // Still focus the window if it's available
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        break;
    }
  } catch (error) {
    console.error(`❌ Error handling protocol URL: ${error.message}`);

    // Still try to focus the window on any protocol URL
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  }
};

// App settings with defaults
let appSettings = {
  autoStartProxy: true, // Re-enabled - was disabled for debugging
  runAtStartup: false, // New setting to run Sniffler at Windows startup - default to false for less intrusive behavior
  defaultProxyPort: 8080,
  maxRequestHistory: 100, // Changed from 1000 to 100 as per user request
  maxMockHistory: 1000, // Maximum number of mocks to keep
  autoSaveRequestsAsMocks: true, // Unified setting for auto-saving all request types as mocks
  autoReplaceMocksOnDifference: false, // DEFAULT TO FALSE - Auto-replace mocks when responses differ
  enablePatternMatching: true, // TEMPORARILY SET TO TRUE FOR TESTING - Enable smart pattern matching for mocks
  mockOutgoingRequests: true, // Mock outgoing requests during testing
  mockDatabaseRequests: true, // Mock database requests during testing
  enableDatabaseDeduplication: true, // Enable database query deduplication by default
  databaseDeduplicationWindow: 1000, // 1 second window for deduplication
  filterDatabaseHealthChecks: true, // Filter out database health check queries like SELECT NOW()
  // Auto-update settings
  autoCheckForUpdates: true, // Check for updates automatically
  updateCheckInterval: 12, // Check every 12 hours (and also once shortly after startup)
  autoDownloadUpdates: false, // Don't auto-download (ask user first)
  autoInstallUpdates: false, // Don't auto-install (ask user first)
};

// Initialize interceptors with current settings
function initializeInterceptors() {
  // Update interceptor settings with current app settings
  databaseProxyInterceptor.updateSettings({
    maxRequestHistory: appSettings.maxRequestHistory,
    maxMockHistory: appSettings.maxMockHistory,
    autoSaveRequestsAsMocks: appSettings.autoSaveRequestsAsMocks,
    enableDeduplication: appSettings.enableDatabaseDeduplication,
    deduplicationWindow: appSettings.databaseDeduplicationWindow,
    filterHealthChecks: appSettings.filterDatabaseHealthChecks,
  });

  outgoingInterceptor.updateSettings({
    maxRequestHistory: appSettings.maxRequestHistory,
    maxMockHistory: appSettings.maxMockHistory,
    autoSaveRequestsAsMocks: appSettings.autoSaveRequestsAsMocks,
  });
}

// License info - will be updated by license manager
let licenseInfo = {
  type: "free",
  isPremium: false,
  status: "free",
  message: "Free version - some features limited",
  isValid: true,
};

// Load persisted proxy configurations
async function loadPersistedProxies() {
  try {
    console.log("🔄 Loading persisted normal proxies...");
    const proxyConfigs = await proxyManager.loadNormalProxies();

    // Ensure proxyConfigs is an array
    if (!Array.isArray(proxyConfigs)) {
      console.log(
        "⚠️ Invalid proxy configs, skipping normal proxy restoration"
      );
      return;
    }

    console.log(
      `📋 Found ${proxyConfigs.length} normal proxy configurations to restore`
    );

    let restoredCount = 0;
    let autoStartedCount = 0;
    let failedCount = 0;

    for (const config of proxyConfigs) {
      try {
        console.log(
          `🔧 Restoring normal proxy: ${config.name} on port ${config.port}`
        );

        const proxy = new SnifflerProxy({
          port: config.port,
          name: config.name,
          targetHost: config.targetHost,
          targetPort: config.targetPort,
          isRunning: config.isRunning,
          maxRequestHistory: appSettings.maxRequestHistory,
          maxMockHistory: appSettings.maxMockHistory,
          autoSaveAsMocks: appSettings.autoSaveRequestsAsMocks,
          autoReplaceMocksOnDifference:
            appSettings.autoReplaceMocksOnDifference,
          enablePatternMatching: appSettings.enablePatternMatching,
        });

        // Load persisted mocks for this proxy
        const savedMocks = await dataManager.loadMocks(config.port);
        if (savedMocks.length > 0) {
          console.log(
            `📦 Loading ${savedMocks.length} mocks for proxy ${config.port}`
          );
          proxy.importMocks({ mocks: savedMocks });
        }

        // Load persisted requests (always load)
        const savedRequests = await dataManager.loadRequests(config.port);
        if (savedRequests.length > 0) {
          console.log(
            `📝 Loading ${savedRequests.length} requests for proxy ${config.port}`
          );
          proxy.requests = savedRequests;
        }

        // Set up event listeners for this proxy in a single, idempotent place
        setupProxyEventListeners(config.port, proxy);

        proxies.set(config.port, {
          proxy,
          name: config.name,
          targetHost: config.targetHost,
          targetPort: config.targetPort,
          createdAt: config.createdAt,
          autoStart: config.autoStart !== false, // Default to true
          disabled: config.disabled || false, // Include disabled state
        });

        restoredCount++;

        // Use ProxyManager to determine if proxy should auto-start
        const shouldAutoStart =
          proxyManager.shouldAutoStart(config) && !config.disabled;

        if (shouldAutoStart) {
          try {
            console.log(
              `🚀 Auto-starting normal proxy on port ${config.port}: ${config.name}`
            );

            // Test target connection first
            const connectionTest = await proxy.testTargetConnection();
            if (!connectionTest.success) {
              console.error(
                `❌ Target server not reachable for proxy ${config.port}: ${connectionTest.message}`
              );
              // Mark as not running since target is not available
              proxy.isRunning = false;
            } else {
              console.log(
                `✅ Target server reachable for proxy ${config.port}`
              );
              await proxy.start();
              console.log(
                `✅ Successfully auto-started normal proxy on port ${config.port}`
              );
              autoStartedCount++;

              // Verify it's actually listening
              const net = require("net");
              const isListening = await new Promise((resolve) => {
                const server = net.createServer();
                server.listen(config.port, (err) => {
                  if (err) {
                    resolve(true); // Port is in use, proxy is running
                  } else {
                    server.close();
                    resolve(false); // Port is available, proxy failed to start
                  }
                });
                server.on("error", () => resolve(true)); // Port is in use
              });

              if (!isListening) {
                console.error(
                  `❌ Normal proxy on port ${config.port} failed to bind to port`
                );
                proxy.isRunning = false;
              } else {
                console.log(
                  `✅ Confirmed normal proxy on port ${config.port} is listening`
                );
              }
            }
          } catch (startError) {
            console.error(
              `❌ Failed to auto-start normal proxy on port ${config.port}:`,
              startError.message
            );
            // Make sure proxy state reflects the failure
            proxy.isRunning = false;
            failedCount++;
          }
        } else {
          console.log(
            `⏸️ Skipping auto-start for normal proxy on port ${config.port}: shouldAutoStart=${shouldAutoStart}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to restore normal proxy ${config.name}:`,
          error.message
        );
        failedCount++;
      }
    }

    console.log(
      `📊 Normal proxy restoration summary: ${restoredCount} restored, ${autoStartedCount} auto-started, ${failedCount} failed`
    );
  } catch (error) {
    console.error("❌ Failed to load persisted normal proxies:", error);
  }
}

// Save proxy configurations
async function saveProxyConfigurations() {
  await proxyManager.saveNormalProxies(proxies);

  // Save mocks for each proxy
  for (const [port, proxyData] of proxies) {
    const mocks = proxyData.proxy.getMocks();
    if (mocks.length > 0) {
      await dataManager.saveMocks(port, mocks);
    }

    // Save requests (always enabled)
    const requests = proxyData.proxy.getRequests();
    if (requests.length > 0) {
      await dataManager.saveRequests(
        port,
        requests,
        appSettings.maxRequestHistory
      );
    }
  }
}

function createWindow() {
  try {
    console.log("🖥️ Creating main window...");
    // Check if we should start hidden (for startup)
    const shouldStartHidden = process.argv.includes("--hidden");

    // Determine proper window icon (avoid default Electron icon)
    let windowIcon = undefined;
    try {
      const fsSync = require("fs");
      const icoPath = path.join(__dirname, "../../build/icon.ico");
      const pngPath = path.join(__dirname, "../../build/icon.png");

      // On Windows, always use the .ico path for reliable title bar/taskbar icon
      if (process.platform === "win32" && fsSync.existsSync(icoPath)) {
        windowIcon = icoPath;
      } else if (fsSync.existsSync(pngPath)) {
        const pngImg = nativeImage.createFromPath(pngPath);
        if (!pngImg.isEmpty()) {
          windowIcon = pngImg;
        }
      }
    } catch {}

    console.log("🔧 Creating BrowserWindow instance...");
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      show: !shouldStartHidden, // Don't show if starting hidden
      icon: windowIcon, // Use Sniffler app icon (dev); packaged apps use exe icon
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        devTools: devToolsEnabled, // Enable DevTools only in dev
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
      // Focus related settings
      focusable: true,
      skipTaskbar: false,
      alwaysOnTop: false,
    });

    console.log(
      `🖥️ BrowserWindow created, shouldStartHidden: ${shouldStartHidden}`
    );

    // Load the development server or fallback to local file
    const loadApp = async () => {
      try {
        console.log("📡 Attempting to load development server...");
        await mainWindow.loadURL("http://localhost:8765");
        console.log("✅ Development server loaded successfully");
        flushQueuedUiEvents();
      } catch (error) {
        console.log("⚠️ Development server failed, loading local file...");
        const rendererPath = path.join(
          __dirname,
          "../renderer/dist/index.html"
        );
        console.log("📂 Renderer path:", rendererPath);
        await mainWindow.loadFile(rendererPath);
        console.log("✅ Local file loaded successfully");
        flushQueuedUiEvents();
      }
    };

    console.log("🔄 Starting app load...");
    loadApp().catch((err) => {
      console.error("❌ Error in loadApp:", err);
    });

    // Set up event listeners for all existing proxies after window is created
    console.log("🔌 Setting up event listeners...");
    for (const [port, proxyData] of proxies) {
      setupProxyEventListeners(port, proxyData.proxy);
    }
    console.log("✅ Event listeners setup complete");

    // If starting hidden, minimize to system tray (if available) or just hide
    if (shouldStartHidden) {
      mainWindow.hide();
    }

    // Initialize auto-updater
    try {
      autoUpdater = new SnifflerAutoUpdater(mainWindow);
      autoUpdater.updateSettings({
        autoCheck: appSettings.autoCheckForUpdates,
        checkInterval: appSettings.updateCheckInterval,
        autoDownload: appSettings.autoDownloadUpdates,
        autoInstall: appSettings.autoInstallUpdates,
      });
      console.log("✅ Auto-updater initialized successfully");
      // Perform an immediate silent check on startup (in addition to scheduled one)
      try {
        autoUpdater.checkForUpdates(true);
      } catch (e) {
        // Swallow any early check errors silently
      }
    } catch (error) {
      console.error("❌ Failed to initialize auto-updater:", error);
    }

    // Enable developer tools keyboard shortcuts only in dev
    if (devToolsEnabled) {
      mainWindow.webContents.on("before-input-event", (event, input) => {
        // F12 to toggle developer tools
        if (input.key === "F12") {
          mainWindow.webContents.toggleDevTools();
        }
        // Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac) to toggle developer tools
        if ((input.control || input.meta) && input.shift && input.key === "I") {
          mainWindow.webContents.toggleDevTools();
        }
        // Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac) to open console
        if ((input.control || input.meta) && input.shift && input.key === "J") {
          mainWindow.webContents.toggleDevTools();
        }
      });
    }

    // Create application menu with developer tools option
    // Build and set application menu only in dev
    if (devToolsEnabled) {
      const template = [
        {
          label: "View",
          submenu: [
            {
              label: "Reload",
              accelerator: "CmdOrCtrl+R",
              click: () => {
                mainWindow.webContents.reload();
              },
            },
            {
              label: "Force Reload",
              accelerator: "CmdOrCtrl+Shift+R",
              click: () => {
                mainWindow.webContents.reloadIgnoringCache();
              },
            },
            {
              label: "Toggle Developer Tools",
              accelerator:
                process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
              click: () => {
                mainWindow.webContents.toggleDevTools();
              },
            },
            { type: "separator" },
            {
              label: "Actual Size",
              accelerator: "CmdOrCtrl+0",
              click: () => {
                mainWindow.webContents.setZoomLevel(0);
              },
            },
            {
              label: "Zoom In",
              accelerator: "CmdOrCtrl+Plus",
              click: () => {
                const currentZoom = mainWindow.webContents.getZoomLevel();
                mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
              },
            },
            {
              label: "Zoom Out",
              accelerator: "CmdOrCtrl+-",
              click: () => {
                const currentZoom = mainWindow.webContents.getZoomLevel();
                mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
              },
            },
          ],
        },
      ];

      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    }

    // Add context menu; include inspect/devtools only in dev
    mainWindow.webContents.on("context-menu", (event, params) => {
      const baseItems = [
        {
          label: "Reload",
          click: () => {
            mainWindow.webContents.reload();
          },
        },
      ];

      const devItems = devToolsEnabled
        ? [
            { type: "separator" },
            {
              label: "Inspect Element",
              click: () => {
                mainWindow.webContents.inspectElement(params.x, params.y);
              },
            },
            {
              label: "Toggle Developer Tools",
              click: () => {
                mainWindow.webContents.toggleDevTools();
              },
            },
          ]
        : [];

      const contextMenu = Menu.buildFromTemplate([...baseItems, ...devItems]);
      contextMenu.popup();
    });

    // Handle mouse back/forward buttons on Windows
    // Prevent navigating to a blank page by only going back/forward if history exists
    mainWindow.on("app-command", (event, command) => {
      try {
        if (command === "browser-backward") {
          // Prevent any default navigation
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (mainWindow.webContents.canGoBack()) {
            mainWindow.webContents.goBack();
          }
          // If there's no history, do nothing
        } else if (command === "browser-forward") {
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (mainWindow.webContents.canGoForward()) {
            mainWindow.webContents.goForward();
          }
        }
      } catch (e) {
        // Swallow any errors to avoid crashing on input handling
      }
    });

    // Intercept keyboard back/forward (Alt+Left/Right, BrowserBack/Forward)
    mainWindow.webContents.on("before-input-event", (event, input) => {
      try {
        const isBack =
          input.key === "BrowserBack" ||
          (input.alt && input.code === "ArrowLeft");
        const isForward =
          input.key === "BrowserForward" ||
          (input.alt && input.code === "ArrowRight");

        if (isBack) {
          event.preventDefault();
          if (mainWindow.webContents.canGoBack()) {
            mainWindow.webContents.goBack();
          }
        } else if (isForward) {
          event.preventDefault();
          if (mainWindow.webContents.canGoForward()) {
            mainWindow.webContents.goForward();
          }
        }
      } catch (e) {
        // ignore
      }
    });

    // Safety: block accidental navigation to about:blank
    mainWindow.webContents.on("will-navigate", (event, url) => {
      try {
        if (url === "about:blank" || url === "about:blank#blocked") {
          event.preventDefault();
        }
      } catch (e) {
        // ignore
      }
    });

    // Handle window close
    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    mainWindow.on("close", async (event) => {
      // Prevent the window from closing immediately
      event.preventDefault();

      try {
        // Stop all proxies
        const stopPromises = Array.from(proxies.values()).map(
          async ({ proxy }) => {
            try {
              if (proxy.isRunning) {
                await proxy.stop();
              }
            } catch (error) {
              // console.error("Error stopping proxy:", error);
            }
          }
        );

        // Stop database sniffer
        try {
          await databaseSniffer.stopAll();
        } catch (error) {
          // console.error("Error stopping database sniffer:", error);
        }

        // Stop outgoing proxies
        try {
          await outgoingInterceptor.stopAll();
          await saveOutgoingProxies();
          await saveOutgoingRequests();
        } catch (error) {
          // console.error("Error stopping outgoing proxies:", error);
        } // Wait for cleanup
        await Promise.all(stopPromises);

        // Save data
        await saveSettings();
        await saveProxyConfigurations();

        // Now close the window
        mainWindow.destroy();
      } catch (error) {
        // console.error("Error during window close:", error);
        // Force close if cleanup fails
        mainWindow.destroy();
      }
    });
  } catch (error) {
    console.error("❌ Error in createWindow function:", error);
    console.error("❌ Stack trace:", error.stack);
  }
}

// Initialize license manager
async function initializeLicenseManager() {
  try {
    console.log("🔐 Initializing license manager...");
    licenseManager = new LicenseManager();

    // Initialize and check license
    const status = await licenseManager.initialize();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    console.log("🔐 License status:", licenseInfo);

    // Send license status to renderer if window is ready
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }
  } catch (error) {
    console.error("❌ Failed to initialize license manager:", error);
    // Fallback to free version
    licenseInfo = {
      type: "free",
      isPremium: false,
      status: "free",
      message: "Free version - some features limited",
      isValid: true,
    };
  }
}

// Check if feature is premium-only
function isPremiumFeature(feature) {
  // Allow premium features for both licensed premium users and trial users
  if (!licenseInfo.isPremium && !licenseInfo.isTrial) {
    const premiumFeatures = [
      "mock-creation",
      "mock-management",
      "database-proxies",
      "outgoing-requests",
      "export-import",
      "advanced-features",
    ];
    return premiumFeatures.includes(feature);
  }
  return false;
}

// IPC handlers for proxy management
ipcMain.handle(
  "start-proxy",
  async (event, { port, name, targetHost, targetPort }) => {
    try {
      // Validate configuration
      const finalTargetHost = targetHost || "localhost";
      const finalTargetPort = targetPort || 3000;

      // Check for circular proxy configuration
      if (
        (finalTargetHost === "localhost" || finalTargetHost === "127.0.0.1") &&
        finalTargetPort === port
      ) {
        return {
          success: false,
          error: `Cannot create proxy on port ${port} targeting ${finalTargetHost}:${finalTargetPort}. This would create an infinite loop. Please use a different target port.`,
        };
      }

      // Check if port is already in use
      if (proxies.has(port)) {
        return {
          success: false,
          error: `Port ${port} is already in use by another proxy`,
        };
      }

      const proxy = new SnifflerProxy({
        port,
        name,
        targetHost: finalTargetHost,
        targetPort: finalTargetPort,
        maxRequestHistory: appSettings.maxRequestHistory,
        maxMockHistory: appSettings.maxMockHistory,
        autoSaveAsMocks: appSettings.autoSaveRequestsAsMocks,
        autoReplaceMocksOnDifference: appSettings.autoReplaceMocksOnDifference,
        enablePatternMatching: appSettings.enablePatternMatching,
      });

      // Test target server connection before starting proxy
      const connectionTest = await proxy.testTargetConnection();
      if (!connectionTest.success) {
        return {
          success: false,
          error: connectionTest.message,
          errorType: connectionTest.errorType,
          targetHost: finalTargetHost,
          targetPort: finalTargetPort,
        };
      }

      await proxy.start();

      // Centralized listener setup to avoid duplicates
      setupProxyEventListeners(port, proxy);

      proxy.on("error", (errorData) => {
        if (mainWindow) {
          mainWindow.webContents.send("proxy-error", {
            proxyId: port,
            ...errorData,
          });
        }

        // Log user-friendly error message
        const displayMessage = errorData.userFriendlyMessage || errorData.error;
        // console.error(`Proxy error on port ${port}: ${displayMessage}`);

        // If it's a target server error, provide additional context
      });

      proxies.set(port, {
        proxy,
        name,
        targetHost: finalTargetHost,
        targetPort: finalTargetPort,
        createdAt: new Date().toISOString(),
        disabled: false, // New proxies are enabled by default
      });

      // Save proxy configurations immediately
      await saveProxyConfigurations();

      return {
        success: true,
        port,
        name,
        targetHost: finalTargetHost,
        targetPort: finalTargetPort,
      };
    } catch (error) {
      // console.error("Failed to start proxy:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("restart-all-proxies", async () => {
  try {
    console.log(
      "🔄 ROBUST RESTART: Using professional proxy restart system..."
    );

    // Stop all existing proxies first
    let stopped = 0;
    for (const [port, proxyData] of proxies) {
      try {
        if (proxyData.proxy.isRunning) {
          await proxyData.proxy.stop();
          stopped++;
          console.log(`⏹️ Stopped proxy on port ${port}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error stopping proxy on port ${port}:`, error.message);
      }
    }

    // Clear the proxies map to start fresh
    proxies.clear();
    console.log(`📋 Cleared ${stopped} proxy instances, starting fresh...`);

    // Use the robust startup system to recreate and start all proxies
    const ProxyStartupManager = require("./proxy-startup-manager");
    const startupManager = new ProxyStartupManager(
      proxies,
      proxyManager,
      appSettings
    );

    const startupResults = await startupManager.startAllProxies();

    // Set up event listeners for all successfully created proxies
    for (const [port, proxyData] of proxies) {
      setupProxyEventListeners(port, proxyData.proxy);
    }

    // Save proxy configurations to update running states
    await saveProxyConfigurations();

    console.log(
      `✅ ROBUST RESTART COMPLETE: ${startupResults.started} started, ${startupResults.failed} failed`
    );

    return {
      success: true,
      restarted: startupResults.started,
      failed: startupResults.failed,
      total: startupResults.total,
      message: `Professional restart: ${startupResults.started}/${startupResults.total} proxies started`,
      errors: startupResults.errors,
    };
  } catch (error) {
    console.error("💥 FATAL ERROR in robust restart system:", error);
    return {
      success: false,
      error: error.message,
      message: "Fatal error during restart",
    };
  }
});

ipcMain.handle("stop-proxy", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    await proxyData.proxy.stop();
    proxies.delete(port);
    return { success: true };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("force-start-proxy", async (event, port) => {
  try {
    const proxyData = proxies.get(port);
    if (!proxyData) {
      return { success: false, error: "Proxy not found" };
    }

    console.log(`🔧 Force starting proxy on port ${port}...`);

    // First stop if it thinks it's running
    if (proxyData.proxy.isRunning) {
      console.log(`⏹️ Stopping proxy on port ${port} first...`);
      try {
        await proxyData.proxy.stop();
        console.log(`✅ Stopped proxy on port ${port}`);
      } catch (stopError) {
        console.log(
          `⚠️ Error stopping proxy (continuing anyway): ${stopError.message}`
        );
      }
    }

    // Test target connection first
    console.log(`🔍 Testing target connection for proxy on port ${port}...`);
    const connectionTest = await proxyData.proxy.testTargetConnection();
    if (!connectionTest.success) {
      console.log(
        `❌ Target connection test failed: ${connectionTest.message}`
      );
      return {
        success: false,
        error: `Target server not reachable: ${connectionTest.message}`,
        targetTest: connectionTest,
      };
    }
    console.log(`✅ Target connection test passed`);

    // Now start it
    console.log(`🚀 Starting proxy on port ${port}...`);
    await proxyData.proxy.start();
    console.log(`✅ Successfully force-started proxy on port ${port}`);

    // Verify it's actually listening
    const net = require("net");
    const isListening = await new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, (err) => {
        if (err) {
          resolve(true); // Port is in use, so our proxy is likely running
        } else {
          server.close();
          resolve(false); // Port is available, proxy didn't start
        }
      });
      server.on("error", () => resolve(true)); // Port is in use
    });

    console.log(
      `🔍 Port ${port} listening check: ${isListening ? "YES" : "NO"}`
    );

    // Save the updated state
    await saveProxyConfigurations();

    return {
      success: true,
      port,
      isRunning: proxyData.proxy.isRunning,
      actuallyListening: isListening,
      targetTest: connectionTest,
    };
  } catch (error) {
    console.error(
      `❌ Failed to force-start proxy on port ${port}:`,
      error.message
    );
    return { success: false, error: error.message };
  }
});

ipcMain.handle("verify-proxy-status", async (event, port) => {
  try {
    const proxyData = proxies.get(port);
    if (!proxyData) {
      return { success: false, error: "Proxy not found" };
    }

    // Check if proxy thinks it's running
    const proxyThinksRunning = proxyData.proxy.isRunning;

    // Check if port is actually listening
    const net = require("net");
    const actuallyListening = await new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, (err) => {
        if (err) {
          resolve(true); // Port is in use
        } else {
          server.close();
          resolve(false); // Port is available
        }
      });
      server.on("error", () => resolve(true)); // Port is in use
    });

    // Test target connection
    const connectionTest = await proxyData.proxy.testTargetConnection();

    console.log(`🔍 Proxy ${port} status check:`);
    console.log(`  - Proxy thinks running: ${proxyThinksRunning}`);
    console.log(`  - Actually listening: ${actuallyListening}`);
    console.log(`  - Target reachable: ${connectionTest.success}`);

    return {
      success: true,
      port,
      proxyThinksRunning,
      actuallyListening,
      targetTest: connectionTest,
      mismatch: proxyThinksRunning !== actuallyListening,
    };
  } catch (error) {
    console.error(
      `❌ Failed to verify proxy status for port ${port}:`,
      error.message
    );
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-proxies", () => {
  return Array.from(proxies.entries()).map(
    ([port, { name, targetHost, targetPort, proxy, disabled }]) => ({
      port,
      name,
      targetHost: targetHost || "localhost",
      targetPort: targetPort || 3000,
      isRunning: proxy.isRunning, // Include actual running state
      disabled: disabled || false, // Include disabled state
      stats: proxy.getStats ? proxy.getStats() : null,
    })
  );
});

ipcMain.handle(
  "test-target-connection",
  async (event, { targetHost, targetPort }) => {
    try {
      const testProxy = new SnifflerProxy({
        port: 0, // dummy port for testing
        targetHost: targetHost || "localhost",
        targetPort: targetPort || 3000,
        maxRequestHistory: 10, // Small limit for test connections
        maxMockHistory: 10, // Small limit for test connections
        autoSaveAsMocks: false, // Don't auto-save for test connections
        autoReplaceMocksOnDifference: false, // Don't auto-replace for test connections
        enablePatternMatching: false, // Don't use pattern matching for test connections
      });

      const result = await testProxy.testTargetConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to test connection: ${error.message}`,
        error: error.message,
      };
    }
  }
);

ipcMain.handle("update-proxy-name", async (event, port, newName) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    proxyData.name = newName;
    await saveProxyConfigurations(); // Save the updated proxy configuration
    return { success: true };
  }
  return { success: false, error: "Proxy not found" };
});

// Handler to update proxy configuration (name, port, target host/port)
ipcMain.handle("update-proxy-config", async (event, port, updates) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    try {
      // Only allow updates when proxy is disabled or stopped
      if (!proxyData.disabled && proxyData.proxy.isRunning) {
        return {
          success: false,
          error:
            "Cannot update running proxy configuration. Disable the proxy first.",
        };
      }

      // Check if port is being changed
      const newPort = updates.port ? parseInt(updates.port) : port;

      // Validate new port if being changed
      if (updates.port !== undefined && newPort !== port) {
        if (newPort < 1 || newPort > 65535) {
          return {
            success: false,
            error: "Port must be between 1 and 65535",
          };
        }

        // Check if new port is already in use
        if (proxies.has(newPort)) {
          return {
            success: false,
            error: `Port ${newPort} is already in use by another proxy`,
          };
        }
      }

      // Validate target configuration to prevent circular proxy loops
      if (updates.targetHost && updates.targetPort) {
        const targetHost = updates.targetHost;
        const targetPort = parseInt(updates.targetPort);

        if (
          (targetHost === "localhost" || targetHost === "127.0.0.1") &&
          targetPort === newPort
        ) {
          return {
            success: false,
            error: `Cannot target ${targetHost}:${targetPort}. This would create an infinite loop.`,
          };
        }
      }

      // If port is being changed, we need to create a new proxy and remove the old one
      if (updates.port !== undefined && newPort !== port) {
        // Create new proxy data with updated values
        const newProxyData = {
          ...proxyData,
          port: newPort,
          name: updates.name !== undefined ? updates.name : proxyData.name,
          targetHost:
            updates.targetHost !== undefined
              ? updates.targetHost
              : proxyData.targetHost,
          targetPort:
            updates.targetPort !== undefined
              ? parseInt(updates.targetPort)
              : proxyData.targetPort,
        };

        // Create new proxy instance
        const newProxy = new SnifflerProxy({
          port: newPort,
          name: newProxyData.name,
          targetHost: newProxyData.targetHost,
          targetPort: newProxyData.targetPort,
          isRunning: false,
          maxRequestHistory: appSettings.maxRequestHistory,
          maxMockHistory: appSettings.maxMockHistory,
          autoSaveAsMocks: appSettings.autoSaveRequestsAsMocks,
          autoReplaceMocksOnDifference:
            appSettings.autoReplaceMocksOnDifference,
        });

        newProxyData.proxy = newProxy;

        // Add new proxy and remove old one
        proxies.set(newPort, newProxyData);
        proxies.delete(port);

        // Save the updated proxy configuration
        await saveProxyConfigurations();

        return {
          success: true,
          portChanged: true,
          oldPort: port,
          newPort: newPort,
        };
      } else {
        // Update existing proxy data (no port change)
        if (updates.name !== undefined) {
          proxyData.name = updates.name;
        }
        if (updates.targetHost !== undefined) {
          proxyData.targetHost = updates.targetHost;
          proxyData.proxy.targetHost = updates.targetHost;
        }
        if (updates.targetPort !== undefined) {
          const targetPort = parseInt(updates.targetPort);
          proxyData.targetPort = targetPort;
          proxyData.proxy.targetPort = targetPort;
        }

        // Save the updated proxy configuration
        await saveProxyConfigurations();

        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Proxy not found" };
});

// New handler to update proxy auto-start setting
ipcMain.handle("update-proxy-auto-start", async (event, port, autoStart) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    proxyData.autoStart = autoStart;
    await saveProxyConfigurations(); // Save the updated proxy configuration
    return { success: true };
  }
  return { success: false, error: "Proxy not found" };
});

// Handler to get proxy auto-start setting
ipcMain.handle("get-proxy-auto-start", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    return { success: true, autoStart: proxyData.autoStart !== false };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("diagnose-proxies", async () => {
  try {
    console.log("🔍 Running proxy diagnostics...");

    // Check saved proxy configurations
    const savedProxies = await dataManager.loadProxies();
    console.log(`📋 Found ${savedProxies.length} saved proxy configurations`);

    const diagnostics = {
      savedProxies: savedProxies.map((config) => ({
        port: config.port,
        name: config.name,
        isRunning: config.isRunning,
        targetHost: config.targetHost,
        targetPort: config.targetPort,
      })),
      activeProxies: [],
      portChecks: [],
    };

    // Check in-memory proxies
    for (const [port, proxyData] of proxies) {
      console.log(`🔍 Checking proxy on port ${port}...`);

      const proxyInfo = {
        port,
        name: proxyData.name,
        targetHost: proxyData.targetHost,
        targetPort: proxyData.targetPort,
        proxyThinksRunning: proxyData.proxy.isRunning,
        actuallyListening: false,
        targetReachable: false,
        error: null,
      };

      // Check if port is actually listening
      try {
        const net = require("net");
        proxyInfo.actuallyListening = await new Promise((resolve) => {
          const server = net.createServer();
          server.listen(port, (err) => {
            if (err) {
              resolve(true); // Port is in use
            } else {
              server.close();
              resolve(false); // Port is available
            }
          });
          server.on("error", () => resolve(true)); // Port is in use
        });
      } catch (error) {
        proxyInfo.error = `Port check failed: ${error.message}`;
      }

      // Test target connection
      try {
        const connectionTest = await proxyData.proxy.testTargetConnection();
        proxyInfo.targetReachable = connectionTest.success;
        if (!connectionTest.success) {
          proxyInfo.targetError = connectionTest.message;
        }
      } catch (error) {
        proxyInfo.targetError = `Target test failed: ${error.message}`;
      }

      diagnostics.activeProxies.push(proxyInfo);
      console.log(
        `  - Port ${port}: thinks running=${proxyInfo.proxyThinksRunning}, actually listening=${proxyInfo.actuallyListening}, target reachable=${proxyInfo.targetReachable}`
      );
    }

    // Check specific ports that should be running
    const portsToCheck = [4000, 8080, 3001, 3002];
    for (const port of portsToCheck) {
      const net = require("net");
      const isListening = await new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, (err) => {
          if (err) {
            resolve(true); // Port is in use
          } else {
            server.close();
            resolve(false); // Port is available
          }
        });
        server.on("error", () => resolve(true)); // Port is in use
      });

      diagnostics.portChecks.push({ port, isListening });
      console.log(`🔍 Port ${port} listening: ${isListening}`);
    }

    console.log("📊 Proxy diagnostics complete");
    return { success: true, diagnostics };
  } catch (error) {
    console.error("❌ Diagnostics failed:", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("disable-proxy", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    try {
      // Stop the proxy if it's running
      if (proxyData.proxy.isRunning) {
        await proxyData.proxy.stop();
      }

      // Mark as disabled
      proxyData.disabled = true;

      // Save the updated proxy configuration
      await saveProxyConfigurations();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("enable-proxy", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    try {
      // Mark as enabled
      proxyData.disabled = false;

      // Start the proxy
      await proxyData.proxy.start();

      // Save the updated proxy configuration
      await saveProxyConfigurations();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("delete-proxy", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    try {
      if (proxyData.proxy.isRunning) {
        await proxyData.proxy.stop();
      }
      proxies.delete(port);

      // Clean up persisted data for this proxy
      await dataManager.deleteMocks(port);
      await dataManager.deleteRequests(port);
      await saveProxyConfigurations(); // Save the updated proxy configuration

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Proxy not found" };
});

// Mock management handlers
ipcMain.handle("add-mock", async (event, { port, method, url, response }) => {
  // Check if user has premium access for mock creation
  if (isPremiumFeature("mock-creation")) {
    return {
      success: false,
      error:
        "Mock creation requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  const proxyData = proxies.get(port);
  if (proxyData) {
    // Check pattern matching if enabled
    if (appSettings.enablePatternMatching) {
      const existingRequests = proxyData.proxy.getRequests();
      const existingMocks = proxyData.proxy.getMocks();

      const patternDecision = shouldCreateMockForRequest(
        method,
        url,
        port,
        existingRequests,
        existingMocks,
        appSettings.enablePatternMatching
      );

      if (!patternDecision.shouldMock) {
        return {
          success: false,
          error: `Mock creation skipped: ${patternDecision.reason}`,
          patternBlocked: true,
          reason: patternDecision.reason,
        };
      }
    }

    const mock = proxyData.proxy.addMock(method, url, response);
    // Auto-save mocks
    await dataManager.saveMocks(port, proxyData.proxy.getMocks());
    return { success: true, mock };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("remove-mock", async (event, { port, method, url }) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    const removed = proxyData.proxy.removeMock(method, url);
    if (removed) {
      // Auto-save mocks
      await dataManager.saveMocks(port, proxyData.proxy.getMocks());
    }
    return { success: removed };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle(
  "update-mock",
  async (event, { port, method, url, response }) => {
    const proxyData = proxies.get(port);
    if (proxyData) {
      // Remove the old mock and add the new one
      const removed = proxyData.proxy.removeMock(method, url);
      if (removed) {
        const mock = proxyData.proxy.addMock(method, url, response);
        // Auto-save mocks
        await dataManager.saveMocks(port, proxyData.proxy.getMocks());
        return { success: true, mock };
      }
      return { success: false, error: "Mock not found to update" };
    }
    return { success: false, error: "Proxy not found" };
  }
);

ipcMain.handle("toggle-mock", async (event, { port, method, url }) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    const mock = proxyData.proxy.toggleMock(method, url);
    if (mock) {
      // Auto-save mocks
      await dataManager.saveMocks(
        port,
        proxyData.proxy.getMocks(),
        appSettings.maxMockHistory
      );
    }
    return { success: !!mock, mock };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("get-mocks", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    return { success: true, mocks: proxyData.proxy.getMocks() };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("clear-requests", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    try {
      proxyData.proxy.clearRequests();
      // Also clear persisted requests
      await dataManager.deleteRequests(port);
      await saveProxyConfigurations(); // Save the updated proxy configuration
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle("get-requests", async (event, port) => {
  const proxyData = proxies.get(port);
  if (proxyData) {
    // Normalize request statuses for UI compatibility (completed -> success)
    const normalized = proxyData.proxy.getRequests().map((r) => ({
      ...r,
      status: r?.status === "completed" ? "success" : r?.status,
    }));
    return { success: true, requests: normalized };
  }
  return { success: false, error: "Proxy not found" };
});

ipcMain.handle(
  "send-request",
  async (event, { port, method, url, headers, body }) => {
    try {
      const proxyData = proxies.get(port);
      if (!proxyData) {
        return { success: false, error: "Proxy not found" };
      }

      const https = require("https");
      const http = require("http");
      const { URL } = require("url");

      // Build the full URL using the proxy's target configuration
      let fullUrl;
      try {
        // Handle relative URLs
        if (url.startsWith("/")) {
          const protocol = proxyData.targetPort === 443 ? "https:" : "http:";
          fullUrl = `${protocol}//${proxyData.targetHost}:${proxyData.targetPort}${url}`;
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          fullUrl = url;
        } else {
          // Assume it's a path without leading slash
          const protocol = proxyData.targetPort === 443 ? "https:" : "http:";
          fullUrl = `${protocol}//${proxyData.targetHost}:${proxyData.targetPort}/${url}`;
        }
      } catch (error) {
        return { success: false, error: `Invalid URL: ${error.message}` };
      }

      const urlObj = new URL(fullUrl);
      const isHttps = urlObj.protocol === "https:";
      const requestModule = isHttps ? https : http;

      return new Promise((resolve) => {
        const startTime = Date.now();

        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: method,
          headers: headers || {},
          timeout: 30000, // 30 second timeout
        };

        // Add content-length header for body requests
        if (
          body &&
          (method === "POST" || method === "PUT" || method === "PATCH")
        ) {
          requestOptions.headers["Content-Length"] = Buffer.byteLength(body);
        }

        const req = requestModule.request(requestOptions, (res) => {
          let responseBody = "";

          res.on("data", (chunk) => {
            responseBody += chunk;
          });

          res.on("end", () => {
            const duration = Date.now() - startTime;

            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseBody,
            };

            // Create a request object similar to what the proxy generates
            const requestObj = {
              id: Date.now() + Math.random(),
              timestamp: new Date().toISOString(),
              method: method,
              url: url, // Use the original path
              headers: headers,
              body: body,
              proxyPort: port,
              status:
                res.statusCode >= 200 && res.statusCode < 400
                  ? "success"
                  : "failed",
              response: response,
              duration: duration,
            };

            // Add the request to the proxy's request history
            if (proxyData.proxy) {
              proxyData.proxy.requests = proxyData.proxy.requests || [];
              proxyData.proxy.requests.push(requestObj);

              // Limit request history
              if (
                proxyData.proxy.requests.length >
                (proxyData.proxy.maxRequestHistory ||
                  appSettings.maxRequestHistory ||
                  1000)
              ) {
                proxyData.proxy.requests = proxyData.proxy.requests.slice(
                  -(
                    proxyData.proxy.maxRequestHistory ||
                    appSettings.maxRequestHistory ||
                    1000
                  )
                );
              }

              // Update proxy stats
              proxyData.proxy.stats = proxyData.proxy.stats || {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
              };
              proxyData.proxy.stats.totalRequests++;
              if (requestObj.status === "success") {
                proxyData.proxy.stats.successfulRequests++;
              } else {
                proxyData.proxy.stats.failedRequests++;
              }

              // Auto-save requests (always enabled)
              dataManager
                .saveRequests(
                  port,
                  proxyData.proxy.requests,
                  appSettings.maxRequestHistory
                )
                .catch((error) => {
                  // console.error("Failed to auto-save requests:", error);
                });

              // Emit events to notify the frontend
              if (mainWindow) {
                mainWindow.webContents.send("proxy-request", {
                  proxyId: port,
                  request: requestObj,
                });

                mainWindow.webContents.send("proxy-response", {
                  proxyId: port,
                  request: requestObj,
                  response: response,
                });
              }
            }

            resolve({
              success: true,
              request: requestObj,
              response: response,
            });
          });
        });

        req.on("error", (error) => {
          const duration = Date.now() - startTime;

          const requestObj = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            method: method,
            url: url,
            headers: headers,
            body: body,
            proxyPort: port,
            status: "failed",
            error: error.message,
            duration: duration,
          };

          // Add the failed request to the proxy's request history
          if (proxyData.proxy) {
            proxyData.proxy.requests = proxyData.proxy.requests || [];
            proxyData.proxy.requests.push(requestObj);

            // Update stats
            proxyData.proxy.stats = proxyData.proxy.stats || {
              totalRequests: 0,
              successfulRequests: 0,
              failedRequests: 0,
            };
            proxyData.proxy.stats.totalRequests++;
            proxyData.proxy.stats.failedRequests++;

            // Auto-save requests (always enabled)
            dataManager
              .saveRequests(
                port,
                proxyData.proxy.requests,
                appSettings.maxRequestHistory
              )
              .catch((error) => {
                // console.error("Failed to auto-save requests:", error);
              });

            // Emit events to notify the frontend
            if (mainWindow) {
              mainWindow.webContents.send("proxy-request", {
                proxyId: port,
                request: requestObj,
              });
            }
          }

          resolve({
            success: false,
            error: error.message,
            request: requestObj,
          });
        });

        req.on("timeout", () => {
          req.destroy();
          const duration = Date.now() - startTime;

          const requestObj = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            method: method,
            url: url,
            headers: headers,
            body: body,
            proxyPort: port,
            status: "timeout",
            error: "Request timeout",
            duration: duration,
          };

          // Add the timeout request to the proxy's request history
          if (proxyData.proxy) {
            proxyData.proxy.requests = proxyData.proxy.requests || [];
            proxyData.proxy.requests.push(requestObj);

            // Update stats
            proxyData.proxy.stats = proxyData.proxy.stats || {
              totalRequests: 0,
              successfulRequests: 0,
              failedRequests: 0,
            };
            proxyData.proxy.stats.totalRequests++;
            proxyData.proxy.stats.failedRequests++;

            // Auto-save requests (always enabled)
            dataManager
              .saveRequests(
                port,
                proxyData.proxy.requests,
                appSettings.maxRequestHistory
              )
              .catch((error) => {
                // console.error("Failed to auto-save requests:", error);
              });

            // Emit events to notify the frontend
            if (mainWindow) {
              mainWindow.webContents.send("proxy-request", {
                proxyId: port,
                request: requestObj,
              });
            }
          }

          resolve({
            success: false,
            error: "Request timeout after 30 seconds",
            request: requestObj,
          });
        });

        // Write the request body if present
        if (
          body &&
          (method === "POST" || method === "PUT" || method === "PATCH")
        ) {
          req.write(body);
        }

        req.end();
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// App management handlers
ipcMain.handle("get-app-version", () => {
  return appVersion;
});

// License management IPC handlers
ipcMain.handle("get-license-info", () => {
  if (!licenseManager) {
    return licenseInfo;
  }

  return {
    ...licenseInfo,
    ...licenseManager.getLicenseInfo(),
  };
});

ipcMain.handle("check-license-status", async () => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    const status = await licenseManager.checkLicense();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("set-license-key", async (event, licenseKey) => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    const status = await licenseManager.setLicenseKey(licenseKey);
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("remove-license-key", async () => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    // Clear both key and email to avoid partial state and race conditions
    const status = await licenseManager.clearLicense();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Optional explicit clear endpoint for future use
ipcMain.handle("clear-license", async () => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }
  try {
    const status = await licenseManager.clearLicense();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }
    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Email-based license activation handlers
ipcMain.handle("set-license-email", async (event, email) => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    const status = await licenseManager.setLicenseEmail(email);
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("remove-license-email", async () => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    const status = await licenseManager.removeLicenseEmail();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("start-free-trial", async () => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    const status = await licenseManager.startTrial();
    licenseInfo = {
      ...licenseInfo,
      ...status,
      ...licenseManager.getLicenseInfo(),
    };

    // Send updated status to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("license-status-changed", licenseInfo);
    }

    return { success: true, license: licenseInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "create-checkout-session",
  async (event, { planType, customerEmail }) => {
    if (!licenseManager) {
      return { success: false, error: "License manager not initialized" };
    }

    try {
      const result = await licenseManager.createCheckoutSession(
        planType,
        customerEmail
      );
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("open-checkout-url", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("is-premium-feature", (event, feature) => {
  return isPremiumFeature(feature);
});

// Expose licensing API base for renderer to call admin endpoints consistently
ipcMain.handle("get-licensing-api-base", async () => {
  try {
    if (licenseManager && licenseManager.apiBaseUrl) {
      return { success: true, baseUrl: licenseManager.apiBaseUrl };
    }
    // Fallback: construct from env or default LicenseManager behavior
    const defaultBase =
      process.env.SNIFFLER_LICENSING_API_URL ||
      "https://sniffler-licensing-api-preview.vercel.app/api";
    const normalized = (defaultBase || "").replace(/\/+$/g, "");
    return { success: true, baseUrl: normalized };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle Stripe payment success from custom protocol
ipcMain.handle("process-payment-success", async (event, { sessionId }) => {
  if (!licenseManager) {
    return { success: false, error: "License manager not initialized" };
  }

  try {
    console.log(`💳 Processing payment success for session: ${sessionId}`);

    // Retrieve and automatically activate the license
    const retrievalResult = await licenseManager.retrieveAndActivateLicense(
      sessionId
    );

    if (retrievalResult.success && retrievalResult.activated) {
      console.log(
        `✅ License automatically activated: ${retrievalResult.licenseKey}`
      );

      // Update the license info
      licenseInfo = {
        ...licenseInfo,
        ...retrievalResult,
        ...licenseManager.getLicenseInfo(),
      };

      // Send updated status to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("license-status-changed", licenseInfo);
      }

      return {
        success: true,
        license: licenseInfo,
        licenseKey: retrievalResult.licenseKey,
        allLicenseKeys: retrievalResult.allLicenseKeys,
        message:
          "Payment processed successfully! Your license has been activated automatically.",
        sessionId: sessionId,
        activated: true,
      };
    } else {
      // Fallback to regular license check if automatic activation failed
      console.log(
        "⚠️ Automatic activation failed, falling back to regular check"
      );
      const licenseResult = await licenseManager.checkLicense();

      // Update the license info
      licenseInfo = {
        ...licenseInfo,
        ...licenseResult,
        ...licenseManager.getLicenseInfo(),
      };

      // Send updated status to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("license-status-changed", licenseInfo);
      }

      return {
        success: true,
        license: licenseInfo,
        message:
          "Payment processed successfully! Please check your email for license keys.",
        sessionId: sessionId,
        activated: false,
      };
    }
  } catch (error) {
    console.error(`❌ Error processing payment success: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Handle Stripe payment cancellation from custom protocol
ipcMain.handle("process-payment-cancelled", async (event) => {
  console.log(`💳 Processing payment cancellation`);

  return {
    success: true,
    message: "Payment was cancelled. You can try again anytime.",
    cancelled: true,
  };
});

ipcMain.handle("update-settings", async (event, newSettings) => {
  appSettings = { ...appSettings, ...newSettings };

  // Update auto-updater settings if they changed
  if (
    autoUpdater &&
    ("autoCheckForUpdates" in newSettings ||
      "updateCheckInterval" in newSettings ||
      "autoDownloadUpdates" in newSettings ||
      "autoInstallUpdates" in newSettings)
  ) {
    autoUpdater.updateSettings({
      autoCheck: appSettings.autoCheckForUpdates,
      checkInterval: appSettings.updateCheckInterval,
      autoDownload: appSettings.autoDownloadUpdates,
      autoInstall: appSettings.autoInstallUpdates,
    });
  }

  await saveSettings();
  return { success: true, settings: appSettings };
});

// Auto-updater handlers
ipcMain.handle("check-for-updates", async (event, silent = false) => {
  if (!autoUpdater) {
    return { success: false, error: "Auto-updater not initialized" };
  }

  try {
    const result = await autoUpdater.checkForUpdates(silent);
    // Normalize result so renderer can decide the friendly modal copy
    return { success: true, ...result };
  } catch (error) {
    const message = String(error?.message || error || "");
    const lower = message.toLowerCase();
    // Common cases when updates are not configured/published (no latest.yml, not found, ENOENT, etc.)
    const isNoArtifact =
      lower.includes("latest.yml") ||
      (lower.includes("not found") && lower.includes("release")) ||
      lower.includes("enoent") ||
      lower.includes("cannot find") ||
      lower.includes("no such file") ||
      lower.includes("404");

    if (isNoArtifact) {
      // Treat as "no update available" to avoid noisy errors in environments without a release feed
      return { success: true, updateInfo: null, skipped: true };
    }

    // Fallback: return a friendly error without leaking internal details
    return { success: false, error: "Update server not available" };
  }
});

ipcMain.handle("download-update", async () => {
  if (!autoUpdater) {
    return { success: false, error: "Auto-updater not initialized" };
  }

  try {
    autoUpdater.downloadUpdate(true);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("install-update", async () => {
  if (!autoUpdater) {
    return { success: false, error: "Auto-updater not initialized" };
  }

  try {
    autoUpdater.installUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-update-status", async () => {
  if (!autoUpdater) {
    return { success: false, error: "Auto-updater not initialized" };
  }

  try {
    const status = autoUpdater.getStatus();
    return { success: true, ...status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File operation handlers
ipcMain.handle("export-mocks", async (event, { port, filePath }) => {
  // Check if user has premium access for export functionality
  if (isPremiumFeature("export-import")) {
    return {
      success: false,
      error:
        "Mock export requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  try {
    const proxyData = proxies.get(port);
    if (!proxyData) {
      return { success: false, error: "Proxy not found" };
    }

    const mocks = proxyData.proxy.getMocks();
    const exportData = {
      version: appVersion,
      exportDate: new Date().toISOString(),
      proxyName: proxyData.name,
      proxyPort: port,
      mocks: mocks,
    };

    let saveFilePath = filePath;
    if (!saveFilePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Mocks",
        defaultPath: `sniffler-mocks-${proxyData.name}-${
          new Date().toISOString().split("T")[0]
        }.json`,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled) {
        return { success: false, error: "Export cancelled" };
      }
      saveFilePath = result.filePath;
    }

    await fs.writeFile(saveFilePath, JSON.stringify(exportData, null, 2));
    return { success: true, filePath: saveFilePath };
  } catch (error) {
    // console.error("Export failed:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-mocks", async (event, filePath) => {
  // Check if user has premium access for import functionality
  if (isPremiumFeature("export-import")) {
    return {
      success: false,
      error:
        "Mock import requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  try {
    let importFilePath = filePath;
    if (!importFilePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Import Mocks",
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      });

      if (result.canceled) {
        return { success: false };
      }
      importFilePath = result.filePaths[0];
    }

    const data = await fs.readFile(importFilePath, "utf8");
    const importData = JSON.parse(data);

    // Validate import data structure
    if (!importData.mocks || !Array.isArray(importData.mocks)) {
      return { success: false, error: "Invalid file format" };
    }

    return {
      success: true,
      data: importData,
      mockCount: importData.mocks.length,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("select-folder", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select Folder",
    });

    if (result.canceled) {
      return { success: false };
    }

    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-data-folder", async () => {
  try {
    const { shell } = require("electron");
    const userDataPath = app.getPath("userData");
    await shell.openPath(userDataPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-all-data", async () => {
  try {
    // Stop all proxies
    for (const [port, proxyData] of proxies) {
      if (proxyData.proxy.isRunning) {
        await proxyData.proxy.stop();
      }
    }

    // Clear in-memory data
    proxies.clear();

    // Clear persistent data
    await dataManager.clearAllData();

    // Reset settings to defaults
    appSettings = {
      maxRequestHistory: 1000,
      notifications: true,
    };

    await saveSettings();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("install-certificate", async () => {
  try {
    // This would integrate with system certificate store
    // For now, return success with instructions
    return {
      success: true,
      message: "Please install the root certificate manually for HTTPS support",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("remove-certificate", async () => {
  try {
    // This would remove certificate from system store
    return {
      success: true,
      message: "Certificate removed successfully",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Data management handlers
ipcMain.handle("export-all-data", async () => {
  // Check if user has premium access for export/import
  if (isPremiumFeature("export-import")) {
    return {
      success: false,
      error:
        "Export/Import requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  try {
    const exportData = await dataManager.exportAllData();

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export All Data",
      defaultPath: `sniffler-export-${
        new Date().toISOString().split("T")[0]
      }.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { success: false, error: "Export cancelled" };
    }

    // Save the data to the selected file
    await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2));

    return { success: true, filePath: result.filePath, data: exportData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-all-data", async (event, importData) => {
  try {
    // Validate the data structure
    if (!importData || !importData.version) {
      return {
        success: false,
        error: "Invalid import data - missing version",
      };
    }

    const success = await dataManager.importAllData(importData);
    if (success) {
      // Reload proxies after import
      await loadPersistedProxies();
    }
    return { success, importedData: importData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-proxy-data", async () => {
  try {
    await saveProxyConfigurations();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Enhanced import/export handlers
ipcMain.handle("choose-import-file", async () => {
  try {
    // Show open dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Import File",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    // Read and parse the selected file
    const data = await fs.readFile(result.filePaths[0], "utf8");
    const importData = JSON.parse(data);

    // Validate the data structure
    if (!importData.version) {
      return {
        success: false,
        error: "Invalid export file format - missing version",
      };
    }

    return { success: true, data: importData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "import-selected-projects",
  async (event, { importData, selectedProjectPorts }) => {
    try {
      if (
        !importData ||
        !selectedProjectPorts ||
        selectedProjectPorts.length === 0
      ) {
        return {
          success: false,
          error: "Invalid import data or no projects selected",
        };
      }

      let importedProjects = 0;
      let importedMocks = 0;
      let importedRequests = 0;

      // Filter projects by selected ports
      const selectedProjects = importData.proxies
        ? importData.proxies.filter((proxy) =>
            selectedProjectPorts.includes(proxy.port)
          )
        : [];

      // Import selected projects
      if (selectedProjects.length > 0) {
        // Load current proxies
        const currentProxies = await dataManager.loadProxies();

        // Merge with selected projects (replace existing ones with same port)
        const updatedProxies = currentProxies.filter(
          (currentProxy) => !selectedProjectPorts.includes(currentProxy.port)
        );
        updatedProxies.push(...selectedProjects);

        // Save updated proxies
        await dataManager.saveProxies(updatedProxies);
        importedProjects = selectedProjects.length;
      }

      // Import mocks for selected projects
      if (importData.mocks) {
        for (const port of selectedProjectPorts) {
          if (importData.mocks[port]) {
            await dataManager.saveMocks(port, importData.mocks[port]);
            importedMocks += importData.mocks[port].length;
          }
        }
      }

      // Import requests for selected projects
      if (importData.requests) {
        for (const port of selectedProjectPorts) {
          if (importData.requests[port]) {
            await dataManager.saveRequests(port, importData.requests[port]);
            importedRequests += importData.requests[port].length;
          }
        }
      }

      // Reload proxies after import
      await loadPersistedProxies();

      return {
        success: true,
        stats: {
          projects: importedProjects,
          mocks: importedMocks,
          requests: importedRequests,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("export-single-project", async (event, port) => {
  try {
    // Get project data
    const proxies = await dataManager.loadProxies();
    const project = proxies.find((p) => p.port === port);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const mocks = await dataManager.loadMocks(port);
    const requests = await dataManager.loadRequests(port);

    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      proxies: [project],
      mocks: { [port]: mocks },
      requests: { [port]: requests },
    };

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `Export Project: ${project.name}`,
      defaultPath: `sniffler-project-${project.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}-${
        new Date().toISOString().split("T")[0]
      }.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { success: false, error: "Export cancelled" };
    }

    // Save the data to the selected file
    await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2));

    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("copy-project-mocks", async (event, fromPort, toPort) => {
  // Check if user has premium access for mock copying
  if (isPremiumFeature("mock-creation")) {
    return {
      success: false,
      error:
        "Copying project mocks requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  try {
    const sourceMocks = await dataManager.loadMocks(fromPort);
    if (sourceMocks && sourceMocks.length > 0) {
      // Create copies of mocks with new IDs to avoid conflicts
      const copiedMocks = sourceMocks.map((mock) => ({
        ...mock,
        id: Date.now() + Math.random(), // Generate new ID
        createdAt: new Date().toISOString(),
      }));

      await dataManager.saveMocks(toPort, copiedMocks);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Settings handlers
ipcMain.handle("get-settings", async () => {
  try {
    const settings = await dataManager.loadSettings();
    return { success: true, settings: { ...appSettings, ...settings } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-settings", async (event, settings) => {
  try {
    await dataManager.saveSettings(settings);

    // Update global app settings
    appSettings = { ...appSettings, ...settings };

    // Update auto-save setting for all existing proxies
    if (settings.hasOwnProperty("autoSaveRequestsAsMocks")) {
      for (const [port, proxyData] of proxies) {
        proxyData.proxy.updateSettings({
          autoSaveAsMocks: settings.autoSaveRequestsAsMocks,
        });
      }
    }

    // Update pattern matching setting for all existing proxies
    if (settings.hasOwnProperty("enablePatternMatching")) {
      for (const [port, proxyData] of proxies) {
        proxyData.proxy.updateSettings({
          enablePatternMatching: settings.enablePatternMatching,
        });
      }
    }

    // Update request and mock history limits for all existing proxies
    if (
      settings.hasOwnProperty("maxRequestHistory") ||
      settings.hasOwnProperty("maxMockHistory")
    ) {
      for (const [port, proxyData] of proxies) {
        proxyData.proxy.updateSettings({
          maxRequestHistory: settings.maxRequestHistory,
          maxMockHistory: settings.maxMockHistory,
        });
      }
    }

    // Update database interceptor limits
    if (
      settings.hasOwnProperty("maxRequestHistory") ||
      settings.hasOwnProperty("maxMockHistory") ||
      settings.hasOwnProperty("autoSaveRequestsAsMocks") ||
      settings.hasOwnProperty("enableDatabaseDeduplication") ||
      settings.hasOwnProperty("databaseDeduplicationWindow") ||
      settings.hasOwnProperty("filterDatabaseHealthChecks")
    ) {
      databaseProxyInterceptor.updateSettings({
        maxRequestHistory: settings.maxRequestHistory,
        maxMockHistory: settings.maxMockHistory,
        autoSaveRequestsAsMocks: settings.autoSaveRequestsAsMocks,
        enableDeduplication: settings.enableDatabaseDeduplication,
        deduplicationWindow: settings.databaseDeduplicationWindow,
        filterHealthChecks: settings.filterDatabaseHealthChecks,
      });
    }

    // Update outgoing interceptor limits
    if (
      settings.hasOwnProperty("maxRequestHistory") ||
      settings.hasOwnProperty("maxMockHistory") ||
      settings.hasOwnProperty("autoSaveRequestsAsMocks")
    ) {
      outgoingInterceptor.updateSettings({
        maxRequestHistory: settings.maxRequestHistory,
        maxMockHistory: settings.maxMockHistory,
        autoSaveRequestsAsMocks: settings.autoSaveRequestsAsMocks,
      });
    }

    // Update startup setting
    if (settings.hasOwnProperty("runAtStartup")) {
      configureStartup(settings.runAtStartup);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Developer tools handlers (dev only)
ipcMain.handle("toggle-dev-tools", () => {
  if (!devToolsEnabled) {
    return {
      success: false,
      error: "Developer tools are disabled in production",
    };
  }
  if (mainWindow) {
    mainWindow.webContents.toggleDevTools();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

// Expose dev tools enabled flag to renderer
ipcMain.handle("is-dev-tools-enabled", () => {
  return { success: true, enabled: !!devToolsEnabled };
});

// Test handler to manually save outgoing proxies
ipcMain.handle("test-save-outgoing-proxies", async () => {
  try {
    console.log("🧪 Manual test: Saving outgoing proxies...");
    await saveOutgoingProxies();
    return { success: true };
  } catch (error) {
    console.error("🧪 Manual test failed:", error);
    return { success: false, error: error.message };
  }
});

// Test handler to manually save outgoing requests
ipcMain.handle("test-save-outgoing-requests", async () => {
  try {
    console.log("🧪 Manual test: Saving outgoing requests...");
    await saveOutgoingRequests();
    return { success: true };
  } catch (error) {
    console.error("🧪 Manual test failed:", error);
    return { success: false, error: error.message };
  }
});

// Handler to manually save all outgoing data
ipcMain.handle("save-outgoing-data", async () => {
  try {
    await saveOutgoingProxies();
    await saveOutgoingRequests();
    await saveOutgoingMocks();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Testing mode handlers
ipcMain.handle("set-testing-mode", async (event, isTestingMode) => {
  try {
    // Update outgoing interceptor testing mode
    if (
      outgoingInterceptor &&
      typeof outgoingInterceptor.setTestingMode === "function"
    ) {
      outgoingInterceptor.setTestingMode(isTestingMode);
    }

    // Update database proxy interceptor testing mode
    if (
      databaseProxyInterceptor &&
      typeof databaseProxyInterceptor.setTestingMode === "function"
    ) {
      databaseProxyInterceptor.setTestingMode(isTestingMode);
    }

    // Enable/disable mocking based on user settings and testing mode
    if (isTestingMode) {
      // Load current settings to check if mocking should be enabled
      const currentSettings = await dataManager.loadSettings();

      // Enable outgoing request mocking if setting is enabled
      if (currentSettings.mockOutgoingRequests && outgoingInterceptor) {
        outgoingInterceptor.setMockingEnabled(true);
      }

      // Enable database request mocking if setting is enabled
      if (currentSettings.mockDatabaseRequests && databaseProxyInterceptor) {
        databaseProxyInterceptor.setMockingEnabled(true);
      }
    } else {
      // Disable mocking when not in testing mode
      if (
        outgoingInterceptor &&
        typeof outgoingInterceptor.setMockingEnabled === "function"
      ) {
        outgoingInterceptor.setMockingEnabled(false);
      }

      if (
        databaseProxyInterceptor &&
        typeof databaseProxyInterceptor.setMockingEnabled === "function"
      ) {
        databaseProxyInterceptor.setMockingEnabled(false);
      }
    }

    return { success: true, testingMode: isTestingMode };
  } catch (error) {
    // console.error("❌ Failed to set testing mode:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-testing-mode", async () => {
  try {
    // Return the current testing mode from interceptors
    const outgoingTestingMode = outgoingInterceptor?.isTestingMode || false;
    const databaseTestingMode =
      databaseProxyInterceptor?.isTestingMode || false;

    return {
      success: true,
      testingMode: outgoingTestingMode || databaseTestingMode,
      outgoingTestingMode,
      databaseTestingMode,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-dev-tools", () => {
  if (!devToolsEnabled) {
    return {
      success: false,
      error: "Developer tools are disabled in production",
    };
  }
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

ipcMain.handle("close-dev-tools", () => {
  if (!devToolsEnabled) {
    // It's safe to no-op if disabled
    return { success: true };
  }
  if (mainWindow) {
    mainWindow.webContents.closeDevTools();
    return { success: true };
  }
  return { success: false, error: "Main window not available" };
});

// File dialog handlers
ipcMain.handle("show-save-dialog", async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  } catch (error) {
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle("show-open-dialog", async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  } catch (error) {
    return { canceled: true, error: error.message };
  }
});

// Database sniffing handlers
ipcMain.handle(
  "start-database-sniffer",
  async (event, { port, protocol, targetHost, targetPort }) => {
    try {
      const result = await databaseSniffer.startSniffing(
        port,
        protocol,
        targetHost,
        targetPort
      );
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("stop-database-sniffer", async (event, port) => {
  try {
    const result = await databaseSniffer.stopSniffing(port);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-database-statistics", () => {
  return databaseSniffer.getStatistics();
});

ipcMain.handle("get-database-sniffers", () => {
  const stats = databaseSniffer.getStatistics();
  return {
    success: true,
    sniffers: Array.from(databaseSniffer.servers.keys()).map((port) => ({
      port,
      isRunning: true,
      protocol: "Unknown", // You may want to track this in DatabaseSniffer
    })),
  };
});

ipcMain.handle("stop-all-database-sniffers", async () => {
  try {
    return await databaseSniffer.stopAll();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Database Proxy Management Handlers
ipcMain.handle("get-database-proxies", async () => {
  try {
    return databaseProxyInterceptor.getDatabaseProxies();
  } catch (error) {
    // console.error("Failed to get database proxies:", error);
    return [];
  }
});

ipcMain.handle("get-database-proxy-stats", async () => {
  try {
    return databaseProxyInterceptor.getStats();
  } catch (error) {
    // console.error("Failed to get database proxy stats:", error);
    return {
      totalProxies: 0,
      runningProxies: 0,
      totalConnections: 0,
      totalQueries: 0,
    };
  }
});

ipcMain.handle("get-database-proxy-queries", async (event, proxyPort) => {
  try {
    return databaseProxyInterceptor.getQueries(proxyPort);
  } catch (error) {
    // console.error("Failed to get database proxy queries:", error);
    return [];
  }
});

ipcMain.handle("get-database-proxy-mocks", async (event, proxyPort) => {
  try {
    return databaseProxyInterceptor.getMocks(proxyPort);
  } catch (error) {
    // console.error("Failed to get database proxy mocks:", error);
    return [];
  }
});

ipcMain.handle(
  "create-database-proxy",
  async (event, { port, targetHost, targetPort, protocol, name }) => {
    // Check if user has premium access for database proxies
    if (isPremiumFeature("database-proxies")) {
      return {
        success: false,
        error:
          "Database proxies require a premium license. Upgrade to unlock this feature.",
        isPremiumFeature: true,
      };
    }

    try {
      const proxy = databaseProxyInterceptor.createDatabaseProxy({
        port,
        targetHost,
        targetPort,
        protocol,
        name,
      });
      await saveDatabaseProxies();

      // Return only serializable proxy data
      return {
        success: true,
        proxy: {
          port: proxy.port,
          name: proxy.name,
          protocol: proxy.protocol,
          targetHost: proxy.targetHost,
          targetPort: proxy.targetPort,
          isRunning: proxy.isRunning,
          createdAt: proxy.createdAt,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("start-database-proxy", async (event, port) => {
  try {
    const proxy = await databaseProxyInterceptor.startDatabaseProxy(port);
    await saveDatabaseProxies();

    // Return only serializable proxy data
    return {
      success: true,
      proxy: {
        port: proxy.port,
        name: proxy.name,
        protocol: proxy.protocol,
        targetHost: proxy.targetHost,
        targetPort: proxy.targetPort,
        isRunning: proxy.isRunning,
        createdAt: proxy.createdAt,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("stop-database-proxy", async (event, port) => {
  try {
    const proxy = await databaseProxyInterceptor.stopDatabaseProxy(port);
    await saveDatabaseProxies();

    // Return only serializable proxy data
    return {
      success: true,
      proxy: {
        port: proxy.port,
        name: proxy.name,
        protocol: proxy.protocol,
        targetHost: proxy.targetHost,
        targetPort: proxy.targetPort,
        isRunning: proxy.isRunning,
        createdAt: proxy.createdAt,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-database-proxy", async (event, port, updates) => {
  try {
    const proxy = databaseProxyInterceptor.updateDatabaseProxy(port, updates);
    await saveDatabaseProxies();

    // Return only serializable proxy data
    return {
      success: true,
      proxy: {
        port: proxy.port,
        name: proxy.name,
        protocol: proxy.protocol,
        targetHost: proxy.targetHost,
        targetPort: proxy.targetPort,
        isRunning: proxy.isRunning,
        createdAt: proxy.createdAt,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler to update database proxy auto-start setting
ipcMain.handle(
  "update-database-proxy-auto-start",
  async (event, port, autoStart) => {
    try {
      const proxies = databaseProxyInterceptor.getDatabaseProxies();
      const proxy = proxies.find((p) => p.port === port);
      if (proxy) {
        proxy.autoStart = autoStart;
        await saveDatabaseProxies();
        return { success: true };
      }
      return { success: false, error: "Database proxy not found" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// Handler to get database proxy auto-start setting
ipcMain.handle("get-database-proxy-auto-start", async (event, port) => {
  try {
    const proxies = databaseProxyInterceptor.getDatabaseProxies();
    const proxy = proxies.find((p) => p.port === port);
    if (proxy) {
      return { success: true, autoStart: proxy.autoStart !== false };
    }
    return { success: false, error: "Database proxy not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("remove-database-proxy", async (event, port) => {
  try {
    const success = databaseProxyInterceptor.removeDatabaseProxy(port);
    await saveDatabaseProxies();
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Alias for delete-database-proxy (for frontend compatibility)
ipcMain.handle("delete-database-proxy", async (event, port) => {
  try {
    const success = databaseProxyInterceptor.removeDatabaseProxy(port);
    await saveDatabaseProxies();
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-database-queries", async (event, proxyPort) => {
  try {
    const queries = proxyPort
      ? databaseProxyInterceptor.getQueriesForProxy(proxyPort)
      : databaseProxyInterceptor.getInterceptedQueries();
    return { success: true, queries };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-database-queries", async (event, proxyPort) => {
  try {
    if (proxyPort) {
      // Clear queries for specific proxy from memory
      databaseProxyInterceptor.clearInterceptedQueriesForProxy(proxyPort);
      // Clear persisted queries for specific proxy
      await dataManager.deleteDatabaseRequestsForProxy(proxyPort);
    } else {
      // Clear all queries from memory
      databaseProxyInterceptor.clearInterceptedQueries();
      // Clear all persisted queries
      await dataManager.deleteAllDatabaseRequests();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-database-stats", async () => {
  try {
    return {
      success: true,
      stats: databaseProxyInterceptor.getStats(),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "test-database-connection",
  async (event, { targetHost, targetPort, protocol }) => {
    try {
      const result = await databaseProxyInterceptor.testDatabaseConnection(
        targetHost,
        targetPort,
        protocol
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("start-all-database-proxies", async () => {
  try {
    await databaseProxyInterceptor.startAll();
    await saveDatabaseProxies();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("stop-all-database-proxies", async () => {
  try {
    await databaseProxyInterceptor.stopAll();
    await saveDatabaseProxies();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Database Mock Management Handlers
ipcMain.handle("get-database-mocks", async (event, proxyPort) => {
  try {
    const mocks = databaseProxyInterceptor.getDatabaseMocks(proxyPort);
    return { success: true, mocks };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "add-database-mock",
  async (event, { proxyPort, query, response }) => {
    try {
      const mock = databaseProxyInterceptor.addDatabaseMock(
        proxyPort,
        query,
        response
      );
      await saveDatabaseMocks();
      return { success: true, mock };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("remove-database-mock", async (event, { proxyPort, query }) => {
  try {
    const success = databaseProxyInterceptor.removeDatabaseMock(
      proxyPort,
      query
    );
    await saveDatabaseMocks();
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("toggle-database-mock", async (event, { proxyPort, query }) => {
  try {
    const mock = databaseProxyInterceptor.toggleDatabaseMock(proxyPort, query);
    await saveDatabaseMocks();
    return { success: true, mock };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-database-mock", async (event, mockId, mockData) => {
  try {
    const mock = databaseProxyInterceptor.updateDatabaseMockById(
      mockId,
      mockData
    );
    await saveDatabaseMocks();
    return mock;
  } catch (error) {
    // console.error("Failed to update database mock:", error);
    throw error;
  }
});

ipcMain.handle("set-database-testing-mode", async (event, enabled) => {
  try {
    databaseProxyInterceptor.setTestingMode(enabled);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// New Database Mock Management Handlers for UI
ipcMain.handle("create-database-mock", async (event, mockData) => {
  // Check if user has premium access for mock creation
  if (isPremiumFeature("mock-creation")) {
    return {
      success: false,
      error:
        "Database mock creation requires a premium license. Upgrade to unlock this feature.",
      isPremiumFeature: true,
    };
  }

  try {
    const mock = databaseProxyInterceptor.addDatabaseMock(
      mockData.proxyPort,
      mockData.query || mockData.pattern,
      {
        response: mockData.response,
        enabled: mockData.enabled !== false,
        name: mockData.name,
        description: mockData.description,
        patternType: mockData.patternType || "exact",
        responseType: mockData.responseType || "json",
      }
    );
    await saveDatabaseMocks();
    return mock; // Now returns a serializable object
  } catch (error) {
    // console.error("Failed to create database mock:", error);
    throw error;
  }
});

ipcMain.handle("delete-database-mock", async (event, mockId) => {
  try {
    const deleted = databaseProxyInterceptor.deleteDatabaseMockById(mockId);
    await saveDatabaseMocks();
    return { success: deleted };
  } catch (error) {
    // console.error("Failed to delete database mock:", error);
    throw error;
  }
});

ipcMain.handle("toggle-database-mock-by-id", async (event, mockId, enabled) => {
  try {
    const mock = databaseProxyInterceptor.toggleDatabaseMockById(
      mockId,
      enabled
    );
    await saveDatabaseMocks();
    return mock;
  } catch (error) {
    // console.error("Failed to toggle database mock:", error);
    throw error;
  }
});

ipcMain.handle(
  "update-database-mock-by-id",
  async (event, mockId, mockData) => {
    try {
      const mock = databaseProxyInterceptor.updateDatabaseMockById(
        mockId,
        mockData
      );
      await saveDatabaseMocks();
      return mock;
    } catch (error) {
      // console.error("Failed to update database mock:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-database-mock-usage", async (event, mockId) => {
  try {
    return databaseProxyInterceptor.getMockUsage(mockId);
  } catch (error) {
    // console.error("Failed to get database mock usage:", error);
    return [];
  }
});

// Database Mock Grouping Handlers
ipcMain.handle("get-database-mocks-grouped", async () => {
  try {
    const allMocks = databaseProxyInterceptor.getDatabaseMocks();
    const mocksByDatabase = {};

    // Group mocks by database name
    for (const mock of allMocks) {
      const databaseName =
        mock.proxyName || `port-${mock.proxyPort}` || "unknown";
      if (!mocksByDatabase[databaseName]) {
        mocksByDatabase[databaseName] = [];
      }
      mocksByDatabase[databaseName].push(mock);
    }

    return { success: true, mocksByDatabase };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "get-database-mocks-for-database",
  async (event, databaseName) => {
    try {
      const mocks = await dataManager.loadDatabaseMocksForDatabase(
        databaseName
      );
      return { success: true, mocks };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "clear-database-mocks-for-database",
  async (event, databaseName) => {
    try {
      // Clear from memory for all proxies with this database name
      const proxies = databaseProxyInterceptor.getDatabaseProxies();
      for (const proxy of proxies) {
        if (proxy.name === databaseName) {
          databaseProxyInterceptor.clearDatabaseMocks(proxy.port);
        }
      }

      // Clear from disk
      await dataManager.deleteDatabaseMocksForDatabase(databaseName);

      // Save the updated state
      await saveDatabaseMocks();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("get-database-names-with-mocks", async () => {
  try {
    const allMocks = databaseProxyInterceptor.getDatabaseMocks();
    const databaseNames = new Set();

    for (const mock of allMocks) {
      const databaseName =
        mock.proxyName || `port-${mock.proxyPort}` || "unknown";
      databaseNames.add(databaseName);
    }

    return { success: true, databaseNames: Array.from(databaseNames).sort() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Database Import/Export Handlers
ipcMain.handle("export-database-config", async () => {
  try {
    const config = databaseProxyInterceptor.exportDatabaseConfig();
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-database-config", async (event, config) => {
  try {
    const result = databaseProxyInterceptor.importDatabaseConfig(config);
    await saveDatabaseProxies();
    await saveDatabaseMocks();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Database Proxy Import/Export with File Dialog Handlers
ipcMain.handle("export-database-proxy-config", async () => {
  try {
    const config = databaseProxyInterceptor.exportDatabaseConfig();

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Database Proxy Configuration",
      defaultPath: `sniffler-database-config-${
        new Date().toISOString().split("T")[0]
      }.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    await fs.writeFile(result.filePath, JSON.stringify(config, null, 2));
    return { success: true, filePath: result.filePath };
  } catch (error) {
    // console.error("Failed to export database proxy config:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-database-proxy-config", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import Database Proxy Configuration",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const fileContent = await fs.readFile(result.filePaths[0], "utf-8");
    const config = JSON.parse(fileContent);

    const importResult = databaseProxyInterceptor.importDatabaseConfig(config);
    if (importResult.success) {
      await saveDatabaseProxies();
      await saveDatabaseMocks();
    }

    return importResult;
  } catch (error) {
    // console.error("Failed to import database proxy config:", error);
    return { success: false, error: error.message };
  }
});

// Outgoing Proxy Management Handlers
ipcMain.handle("get-outgoing-proxies", async () => {
  try {
    console.log("🔄 Loading outgoing proxies...");
    const proxies = outgoingInterceptor.getProxies();
    console.log(`✅ Successfully loaded ${proxies.length} outgoing proxies`);
    return {
      success: true,
      proxies: proxies,
    };
  } catch (error) {
    console.error("❌ Failed to get outgoing proxies:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "create-outgoing-proxy",
  async (event, { port, targetUrl, name }) => {
    try {
      const proxy = outgoingInterceptor.createProxy({ port, targetUrl, name });
      await saveOutgoingProxies();

      // Return only serializable proxy data
      const serializableProxy = outgoingInterceptor.getSerializableProxy(port);
      return { success: true, proxy: serializableProxy };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("start-outgoing-proxy", async (event, port) => {
  try {
    const proxy = await outgoingInterceptor.startProxy(port);
    await saveOutgoingProxies();

    // Return only serializable proxy data
    const serializableProxy = outgoingInterceptor.getSerializableProxy(port);
    return { success: true, proxy: serializableProxy };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("stop-outgoing-proxy", async (event, port) => {
  try {
    const proxy = await outgoingInterceptor.stopProxy(port);
    await saveOutgoingProxies();

    // Return only serializable proxy data
    const serializableProxy = outgoingInterceptor.getSerializableProxy(port);
    return { success: true, proxy: serializableProxy };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-outgoing-proxy", async (event, port, updates) => {
  try {
    const proxy = outgoingInterceptor.updateProxy(port, updates);
    if (proxy) {
      await saveOutgoingProxies();

      // Return only serializable proxy data
      const serializableProxy = outgoingInterceptor.getSerializableProxy(port);
      return { success: true, proxy: serializableProxy };
    } else {
      return { success: false, error: "Proxy not found" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler to update outgoing proxy auto-start setting
ipcMain.handle(
  "update-outgoing-proxy-auto-start",
  async (event, port, autoStart) => {
    try {
      const proxy = outgoingInterceptor.getProxy(port);
      if (proxy) {
        proxy.autoStart = autoStart;
        await saveOutgoingProxies();
        return { success: true };
      }
      return { success: false, error: "Outgoing proxy not found" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// Handler to get outgoing proxy auto-start setting
ipcMain.handle("get-outgoing-proxy-auto-start", async (event, port) => {
  try {
    const proxy = outgoingInterceptor.getProxy(port);
    if (proxy) {
      return { success: true, autoStart: proxy.autoStart !== false };
    }
    return { success: false, error: "Outgoing proxy not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("remove-outgoing-proxy", async (event, port) => {
  try {
    const removed = outgoingInterceptor.removeProxy(port);
    if (removed) {
      await saveOutgoingProxies();
    }
    return { success: removed };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-outgoing-requests", async (event, proxyPort = null) => {
  try {
    let requests;
    if (proxyPort) {
      requests = outgoingInterceptor.getRequestsForProxy(proxyPort);
    } else {
      requests = outgoingInterceptor.getInterceptedRequests();
    }

    // Sanitize all requests before sending to renderer process
    const sanitizedRequests = requests.map((request) =>
      sanitizeRequestForIPC(request)
    );

    return { success: true, requests: sanitizedRequests };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-outgoing-requests", async (event, proxyPort = null) => {
  try {
    if (proxyPort) {
      // Clear requests for specific proxy
      const allRequests = outgoingInterceptor.getInterceptedRequests();
      const filteredRequests = allRequests.filter((request) => {
        return request.proxyPort !== proxyPort;
      });
      outgoingInterceptor.interceptedRequests = filteredRequests;

      // Also clear from disk
      await dataManager.deleteOutgoingRequests(proxyPort.toString());
    } else {
      outgoingInterceptor.clearInterceptedRequests();

      // Clear all outgoing requests from disk for all proxies
      const proxies = outgoingInterceptor.getProxies();
      for (const proxy of proxies) {
        try {
          await dataManager.deleteOutgoingRequests(proxy.port.toString());
        } catch (error) {
          console.warn(
            `Failed to clear requests for proxy ${proxy.port}:`,
            error
          );
        }
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-outgoing-stats", async () => {
  try {
    return {
      success: true,
      stats: outgoingInterceptor.getStats(),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("test-proxy-connection", async (event, targetUrl) => {
  try {
    const result = await outgoingInterceptor.testConnection(targetUrl);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("start-all-outgoing-proxies", async () => {
  try {
    await outgoingInterceptor.startAll();
    await saveOutgoingProxies();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("stop-all-outgoing-proxies", async () => {
  try {
    await outgoingInterceptor.stopAll();
    await saveOutgoingProxies();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-outgoing-config", async () => {
  try {
    const config = outgoingInterceptor.exportConfig();
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-outgoing-config", async (event, config) => {
  try {
    const result = outgoingInterceptor.importConfig(config);
    if (result.success) {
      await saveOutgoingProxies();
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Outgoing Proxy Import/Export with File Dialog Handlers
ipcMain.handle("export-outgoing-proxy-config", async () => {
  try {
    const config = outgoingInterceptor.exportConfig();

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Outgoing Proxy Configuration",
      defaultPath: `sniffler-outgoing-config-${
        new Date().toISOString().split("T")[0]
      }.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    await fs.writeFile(result.filePath, JSON.stringify(config, null, 2));
    return { success: true, filePath: result.filePath };
  } catch (error) {
    // console.error("Failed to export outgoing proxy config:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-outgoing-proxy-config", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import Outgoing Proxy Configuration",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const fileContent = await fs.readFile(result.filePaths[0], "utf-8");
    const config = JSON.parse(fileContent);

    const importResult = outgoingInterceptor.importConfig(config);
    if (importResult.success) {
      await saveOutgoingProxies();
    }

    return importResult;
  } catch (error) {
    // console.error("Failed to import outgoing proxy config:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "test-outgoing-request",
  async (event, { url, method = "GET", headers = {}, body = null }) => {
    try {
      const { URL } = require("url");
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const requestModule = isHttps ? require("https") : require("http");

      return new Promise((resolve) => {
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: method,
          headers: headers,
        };

        const req = requestModule.request(requestOptions, (res) => {
          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });

          res.on("end", () => {
            resolve({
              success: true,
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseBody,
            });
          });
        });

        req.on("error", (error) => {
          resolve({
            success: false,
            error: error.message,
          });
        });

        if (
          body &&
          (method === "POST" || method === "PUT" || method === "PATCH")
        ) {
          req.write(body);
        }

        req.end();
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// Outgoing Mock Management Handlers
ipcMain.handle("get-outgoing-mocks", async (event, proxyPort = null) => {
  try {
    const mocks = outgoingInterceptor.getOutgoingMocks(proxyPort);
    return { success: true, mocks };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "add-outgoing-mock",
  async (event, { proxyPort, method, url, response }) => {
    // Check if user has premium access for outgoing mock creation
    if (isPremiumFeature("outgoing-requests")) {
      return {
        success: false,
        error:
          "Outgoing mock creation requires a premium license. Upgrade to unlock this feature.",
        isPremiumFeature: true,
      };
    }

    try {
      const result = outgoingInterceptor.addOutgoingMock(
        proxyPort,
        method,
        url,
        response
      );

      // The event listener will handle saving and UI notification
      // We just need to make sure the mock was created successfully
      return { success: true, mock: result.mock, created: result.created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "remove-outgoing-mock",
  async (event, { proxyPort, method, url }) => {
    try {
      const removed = outgoingInterceptor.removeOutgoingMock(
        proxyPort,
        method,
        url
      );
      // The event listener will handle saving and UI notification
      return { success: removed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "toggle-outgoing-mock",
  async (event, { proxyPort, method, url }) => {
    try {
      const mock = outgoingInterceptor.toggleOutgoingMock(
        proxyPort,
        method,
        url
      );
      // The event listener will handle saving and UI notification
      return { success: !!mock, mock };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "update-outgoing-mock",
  async (event, { proxyPort, method, url, updates }) => {
    try {
      const mock = outgoingInterceptor.updateOutgoingMock(
        proxyPort,
        method,
        url,
        updates
      );
      // The event listener will handle saving and UI notification
      return { success: !!mock, mock };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("set-outgoing-testing-mode", async (event, enabled) => {
  try {
    outgoingInterceptor.setTestingMode(enabled);
    return { success: true, testingMode: enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "create-outgoing-mock-from-request",
  async (event, requestId) => {
    // Check if user has premium access for outgoing mock creation
    if (isPremiumFeature("outgoing-requests")) {
      return {
        success: false,
        error:
          "Creating mocks from outgoing requests requires a premium license. Upgrade to unlock this feature.",
        isPremiumFeature: true,
      };
    }

    try {
      const requests = outgoingInterceptor.getInterceptedRequests();
      const request = requests.find((r) => r.id === requestId);

      if (!request || !request.response) {
        return {
          success: false,
          error: "Request not found or has no response",
        };
      }

      const result = outgoingInterceptor.createMockFromRequest(request);
      // The event listener will handle saving and UI notification
      return { success: true, mock: result.mock, created: result.created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// Initialize outgoing proxy system
async function initializeOutgoingProxies() {
  try {
    console.log("🔄 Initializing outgoing proxy system...");
    console.log("📂 About to call proxyManager.loadOutgoingProxies()...");

    // Set initialization mode to prevent phantom requests during startup
    outgoingInterceptor.setInitializing(true);

    // Clear any existing intercepted requests to start with a clean slate
    outgoingInterceptor.interceptedRequests = [];
    console.log("🧹 Cleared intercepted requests - starting with clean slate");

    // Clear deduplication cache to prevent startup phantom requests
    outgoingInterceptor.processedEvents.clear();

    // Load saved proxy configurations using ProxyManager
    const savedProxies = await proxyManager.loadOutgoingProxies();
    console.log(
      `📋 Found ${savedProxies.length} saved outgoing proxy configurations`
    );

    // Debug: Log all saved proxies
    savedProxies.forEach((proxy, index) => {
      console.log(
        `  ${index + 1}. ${proxy.name} on port ${proxy.port} -> ${
          proxy.targetUrl
        } (isRunning: ${proxy.isRunning}, autoStart: ${proxy.autoStart})`
      );
    });

    // Load saved outgoing mocks
    const savedMocks = await dataManager.loadOutgoingMocks();
    console.log(`🎭 Found ${savedMocks.length} saved outgoing mocks`);

    // Restore mocks to the outgoing interceptor
    for (const mock of savedMocks) {
      try {
        const result = outgoingInterceptor.addOutgoingMock(
          mock.proxyPort,
          mock.method,
          mock.url,
          {
            statusCode: mock.statusCode,
            headers: mock.headers,
            body: mock.body,
            enabled: mock.enabled,
            name: mock.name,
            tags: mock.tags,
          },
          true // Mark as auto-created to prevent UI events during restoration
        );
      } catch (error) {
        console.error(`❌ Failed to restore outgoing mock:`, error.message);
      }
    }

    let restoredCount = 0;
    let autoStartedCount = 0;
    let failedCount = 0;

    for (const proxyConfig of savedProxies) {
      try {
        console.log(
          `🔧 Restoring outgoing proxy: ${proxyConfig.name} on port ${proxyConfig.port}`
        );

        outgoingInterceptor.createProxy({
          port: proxyConfig.port,
          targetUrl: proxyConfig.targetUrl,
          name: proxyConfig.name,
        });

        restoredCount++;

        // Use ProxyManager to determine if proxy should auto-start
        const shouldAutoStart = proxyManager.shouldAutoStart(proxyConfig);

        if (shouldAutoStart) {
          try {
            console.log(
              `🚀 Auto-starting outgoing proxy on port ${proxyConfig.port}: ${proxyConfig.name}`
            );
            await outgoingInterceptor.startProxy(proxyConfig.port);
            console.log(
              `✅ Successfully auto-started outgoing proxy on port ${proxyConfig.port}`
            );
            autoStartedCount++;
          } catch (startError) {
            console.error(
              `❌ Failed to auto-start outgoing proxy on port ${proxyConfig.port}:`,
              startError.message
            );
            // Mark as not running if start failed
            const proxyInstance = outgoingInterceptor.getProxy(
              proxyConfig.port
            );
            if (proxyInstance) {
              proxyInstance.isRunning = false;
            }
            failedCount++;
          }
        } else {
          console.log(
            `⏸️ Skipping auto-start for outgoing proxy on port ${proxyConfig.port}: shouldAutoStart=${shouldAutoStart}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to restore outgoing proxy on port ${proxyConfig.port}:`,
          error.message
        );
        failedCount++;
      }
    }

    console.log(
      `📊 Outgoing proxy initialization summary: ${restoredCount} restored, ${autoStartedCount} auto-started, ${failedCount} failed`
    );

    // Load saved outgoing requests for each proxy - DISABLED to prevent phantom requests
    // Only show requests that are intercepted during the current session
    console.log(
      "� Skipping loading of saved outgoing requests to prevent phantom requests"
    );
    console.log(
      "📋 Only requests intercepted during current session will be shown"
    );

    // NOTE: Saved requests are still available on disk if user wants to export/import them
    // but they won't appear in the UI to avoid confusion about when requests actually happened

    // Set up event listeners

    // Load saved outgoing requests for each proxy - core functionality
    console.log("Loading saved outgoing requests from previous sessions...");

    const proxies = outgoingInterceptor.getProxies();
    let totalLoadedRequests = 0;

    for (const proxy of proxies) {
      try {
        const savedRequests = await dataManager.loadOutgoingRequests(
          proxy.port.toString()
        );
        if (savedRequests.length > 0) {
          console.log(
            `Loading ${savedRequests.length} outgoing requests for proxy ${proxy.port} (${proxy.name})`
          );

          // Add requests to the intercepted requests list (marking them as restored)
          // Add requests directly to maintain chronological order (newest first)
          const restoredRequests = savedRequests.map((request) => {
            const sanitizedRequest = sanitizeRequestForIPC(request);
            return {
              ...sanitizedRequest,
              restored: true,
              restoredAt: new Date().toISOString(),
            };
          });

          // Add restored requests to the beginning of the array to maintain order
          outgoingInterceptor.interceptedRequests.unshift(...restoredRequests);

          // Apply the request history limit
          if (
            outgoingInterceptor.interceptedRequests.length >
            outgoingInterceptor.maxRequestHistory
          ) {
            outgoingInterceptor.interceptedRequests =
              outgoingInterceptor.interceptedRequests.slice(
                0,
                outgoingInterceptor.maxRequestHistory
              );
          }

          totalLoadedRequests += savedRequests.length;
        }
      } catch (error) {
        console.warn(
          `Failed to load outgoing requests for proxy ${proxy.port}:`,
          error.message
        );
      }
    }

    console.log(
      `Successfully loaded ${totalLoadedRequests} outgoing requests from previous sessions`
    );

    outgoingInterceptor.on("outgoing-request", (request) => {
      if (mainWindow) {
        mainWindow.webContents.send(
          "outgoing-request",
          sanitizeRequestForIPC(request)
        );
      }
    });

    outgoingInterceptor.on("outgoing-response", async (request) => {
      if (mainWindow) {
        mainWindow.webContents.send(
          "outgoing-response",
          sanitizeRequestForIPC(request)
        );
      }

      // Always save outgoing requests - this is core functionality
      try {
        const allRequests = outgoingInterceptor.getInterceptedRequests();
        const requestsForThisProxy = allRequests.filter(
          (r) => r.proxyPort === request.proxyPort
        );

        // Sanitize requests before saving to prevent binary data corruption
        const sanitizedRequests = requestsForThisProxy.map((req) =>
          sanitizeRequestForIPC(req)
        );

        await dataManager.saveOutgoingRequests(
          request.proxyPort.toString(),
          sanitizedRequests,
          appSettings.maxRequestHistory
        );
      } catch (error) {
        console.warn(
          `Failed to save outgoing requests for proxy ${request.proxyPort}:`,
          error
        );
      }
    });

    outgoingInterceptor.on("outgoing-error", async (request) => {
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-error", request);
      }

      // Always save outgoing requests - even for errors - this is core functionality
      try {
        const allRequests = outgoingInterceptor.getInterceptedRequests();
        const requestsForThisProxy = allRequests.filter(
          (r) => r.proxyPort === request.proxyPort
        );
        await dataManager.saveOutgoingRequests(
          request.proxyPort.toString(),
          requestsForThisProxy,
          appSettings.maxRequestHistory
        );
      } catch (error) {
        console.warn(
          `Failed to save outgoing requests for proxy ${request.proxyPort}:`,
          error
        );
      }
    });

    outgoingInterceptor.on("mock-served", ({ request, mock }) => {
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-mock-served", { request, mock });
      }
    });

    outgoingInterceptor.on("outgoing-mock-added", async (mock) => {
      console.log("🔥 Main: outgoing-mock-added event received:", mock);
      await saveOutgoingMocks();
      if (mainWindow) {
        console.log("🔥 Main: Sending outgoing-mock-added to UI");
        mainWindow.webContents.send("outgoing-mock-added", mock);
      } else {
        console.log("❌ Main: No mainWindow available for outgoing-mock-added");
      }
    });

    outgoingInterceptor.on("outgoing-mock-updated", async (mock) => {
      await saveOutgoingMocks();
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-mock-updated", mock);
      }
    });

    outgoingInterceptor.on("outgoing-mock-removed", async (data) => {
      await saveOutgoingMocks();
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-mock-removed", data);
      }
    });

    outgoingInterceptor.on("outgoing-mock-toggled", async (mock) => {
      await saveOutgoingMocks();
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-mock-toggled", mock);
      }
    });

    outgoingInterceptor.on("testing-mode-changed", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("outgoing-testing-mode-changed", data);
      }
    });

    outgoingInterceptor.on(
      "outgoing-mock-auto-created",
      async ({ request, mock }) => {
        await saveOutgoingMocks();
        if (mainWindow) {
          mainWindow.webContents.send("outgoing-mock-auto-created", {
            request,
            mock,
          });
        }
      }
    );

    outgoingInterceptor.on(
      "outgoing-mock-saved-during-testing",
      async ({ request, mock }) => {
        await saveOutgoingMocks();
        if (mainWindow) {
          mainWindow.webContents.send("outgoing-mock-saved-during-testing", {
            request,
            mock,
          });
        }
      }
    );

    outgoingInterceptor.on(
      "outgoing-mock-difference-detected",
      ({ request, mock, comparison, proxyPort }) => {
        console.log(
          `📢 Main process received outgoing-mock-difference-detected event for proxy ${proxyPort}`
        );
        if (mainWindow) {
          console.log(
            `📤 Sending outgoing-mock-difference-detected to renderer for proxy ${proxyPort}`
          );
          mainWindow.webContents.send("outgoing-mock-difference-detected", {
            request,
            mock,
            comparison,
            proxyPort,
          });
        } else {
          console.log(
            `❌ Cannot send outgoing-mock-difference-detected - mainWindow is null`
          );
        }
      }
    );

    outgoingInterceptor.on("proxy-created", async (proxy) => {
      await saveOutgoingProxies();
      if (mainWindow) {
        const serializableProxy = outgoingInterceptor.getSerializableProxy(
          proxy.port
        );
        mainWindow.webContents.send("proxy-created", serializableProxy);
      }
    });

    outgoingInterceptor.on("proxy-started", async (proxy) => {
      await saveOutgoingProxies();
      if (mainWindow) {
        const serializableProxy = outgoingInterceptor.getSerializableProxy(
          proxy.port
        );
        mainWindow.webContents.send("proxy-started", serializableProxy);
      }
    });

    outgoingInterceptor.on("proxy-stopped", async (proxy) => {
      await saveOutgoingProxies();
      if (mainWindow) {
        const serializableProxy = outgoingInterceptor.getSerializableProxy(
          proxy.port
        );
        mainWindow.webContents.send("proxy-stopped", serializableProxy);
      }
    });

    outgoingInterceptor.on("proxy-removed", async (data) => {
      await saveOutgoingProxies();
      if (mainWindow) {
        mainWindow.webContents.send("proxy-removed", data);
      }
    });

    outgoingInterceptor.on("proxy-updated", async (proxy) => {
      await saveOutgoingProxies();
      if (mainWindow) {
        const serializableProxy = outgoingInterceptor.getSerializableProxy(
          proxy.port
        );
        mainWindow.webContents.send("proxy-updated", serializableProxy);
      }
    });

    // Turn off initialization mode to allow normal request logging
    // Grace period in outgoing interceptor will prevent validation requests from being logged
    outgoingInterceptor.setInitializing(false);
    console.log(
      "✅ Outgoing proxy initialization complete - request logging enabled with grace period"
    );
  } catch (error) {
    console.error("❌ Failed to initialize outgoing proxy system:", error);
    // Ensure initialization mode is turned off even if there's an error
    outgoingInterceptor.setInitializing(false);
  }
}

// Helper function to save outgoing proxy configurations
async function saveOutgoingProxies() {
  try {
    console.log("💾 Attempting to save outgoing proxies...");
    const proxies = outgoingInterceptor.getProxies();
    console.log(
      `💾 Found ${proxies.length} outgoing proxies to save:`,
      proxies.map((p) => ({
        port: p.port,
        name: p.name,
        isRunning: p.isRunning,
      }))
    );
    await proxyManager.saveOutgoingProxies(proxies);
    console.log("✅ Successfully saved outgoing proxies");
  } catch (error) {
    console.error("❌ Failed to save outgoing proxies:", error);
  }
}

// Helper function to save outgoing mocks
async function saveOutgoingMocks() {
  try {
    const mocks = outgoingInterceptor.getOutgoingMocks();
    await dataManager.saveOutgoingMocks(mocks);
  } catch (error) {
    // console.error("Failed to save outgoing mocks:", error);
  }
}

// Helper function to save outgoing requests
async function saveOutgoingRequests() {
  try {
    console.log("💾 Saving outgoing requests...");
    const allRequests = outgoingInterceptor.getInterceptedRequests();

    // Group requests by proxy port
    const requestsByProxy = {};
    for (const request of allRequests) {
      const proxyPort = request.proxyPort.toString();
      if (!requestsByProxy[proxyPort]) {
        requestsByProxy[proxyPort] = [];
      }
      requestsByProxy[proxyPort].push(request);
    }

    // Save requests for each proxy
    for (const [proxyPort, requests] of Object.entries(requestsByProxy)) {
      await dataManager.saveOutgoingRequests(
        proxyPort,
        requests,
        appSettings.maxRequestHistory
      );
      console.log(
        `💾 Saved ${requests.length} requests for outgoing proxy ${proxyPort}`
      );
    }

    console.log("✅ Successfully saved all outgoing requests");
  } catch (error) {
    console.error("❌ Failed to save outgoing requests:", error);
  }
}

// Database proxy initialization and management functions
async function initializeDatabaseProxies() {
  try {
    console.log("🔄 Initializing database proxy system...");

    // Set up event listeners for database proxy interceptor
    console.log("🚨🚨🚨 SETTING UP DATABASE PROXY EVENT LISTENERS 🚨🚨🚨");
    databaseProxyInterceptor.on("database-query", (query) => {
      console.log(
        "🔍🔍🔍 DATABASE QUERY INTERCEPTED:",
        query.id,
        query.type,
        query.query?.substring(0, 50) + "..."
      );
      if (mainWindow) {
        mainWindow.webContents.send("database-proxy-query", query);
      }
    });

    databaseProxyInterceptor.on("database-query-response", (query) => {
      console.log(
        "📋 Database query response:",
        query.id,
        query.status,
        query.duration + "ms"
      );
      if (mainWindow) {
        mainWindow.webContents.send("database-proxy-response", query);
      }
    });
    databaseProxyInterceptor.on(
      "database-mock-auto-created",
      async ({ query, mock }) => {
        await saveDatabaseMocks();
        if (mainWindow) {
          mainWindow.webContents.send("database-mock-auto-created", {
            query,
            mock,
          });
        }
      }
    );

    databaseProxyInterceptor.on("database-proxy-created", (proxy) => {
      if (mainWindow) {
        mainWindow.webContents.send("database-proxy-created", proxy);
      }
    });

    databaseProxyInterceptor.on("database-proxy-started", (proxy) => {
      if (mainWindow) {
        mainWindow.webContents.send("database-proxy-started", proxy);
      }
    });

    databaseProxyInterceptor.on("database-proxy-stopped", (proxy) => {
      if (mainWindow) {
        mainWindow.webContents.send("database-proxy-stopped", proxy);
      }
    });

    databaseProxyInterceptor.on("error", (error) => {
      console.error("❌ Database proxy error:", error);
    });

    databaseProxyInterceptor.on("debug", (message) => {
      console.log("🐛 DATABASE PROXY DEBUG:", message);
    });

    // Load saved database proxy configurations using ProxyManager
    const savedProxies = await proxyManager.loadDatabaseProxies();
    console.log(
      `📋 Found ${savedProxies.length} saved database proxy configurations`
    );

    // Load saved database mocks
    const savedMocks = await dataManager.loadDatabaseMocks();
    console.log(`🎭 Found ${savedMocks.length} saved database mocks`);

    // Group mocks by database for better logging
    const mocksByDatabase = {};
    for (const mock of savedMocks) {
      const databaseName =
        mock.proxyName || `port-${mock.proxyPort}` || "unknown";
      if (!mocksByDatabase[databaseName]) {
        mocksByDatabase[databaseName] = [];
      }
      mocksByDatabase[databaseName].push(mock);
    }

    // Log mocks grouped by database
    for (const [databaseName, mocks] of Object.entries(mocksByDatabase)) {
      console.log(`📋 Database "${databaseName}": ${mocks.length} mocks`);
    }

    // Restore mocks to the database proxy interceptor
    for (const mock of savedMocks) {
      try {
        // Handle different mock formats - query might be in 'query' or 'pattern' property
        const queryText = mock.query || mock.pattern;

        if (!queryText || typeof queryText !== "string") {
          console.warn(
            `⚠️ Skipping invalid mock: missing or invalid query`,
            mock
          );
          continue;
        }

        databaseProxyInterceptor.addDatabaseMock(mock.proxyPort, queryText, {
          response: mock.response,
          enabled: mock.enabled,
          name: mock.name,
          tags: mock.tags,
        });

        console.log(
          `✅ Restored mock for database "${
            mock.proxyName || `port-${mock.proxyPort}`
          }": ${queryText.substring(0, 50)}...`
        );
      } catch (error) {
        console.error(`❌ Failed to restore database mock:`, error.message);
      }
    }

    let restoredCount = 0;
    let autoStartedCount = 0;
    let failedCount = 0;

    for (const proxyConfig of savedProxies) {
      try {
        console.log(
          `🔧 Restoring database proxy: ${proxyConfig.name} on port ${proxyConfig.port}`
        );

        databaseProxyInterceptor.createDatabaseProxy({
          port: proxyConfig.port,
          targetHost: proxyConfig.targetHost,
          targetPort: proxyConfig.targetPort,
          protocol: proxyConfig.protocol,
          name: proxyConfig.name,
        });

        restoredCount++;

        // Load persisted database requests (always enabled)
        try {
          const savedRequests = await dataManager.loadDatabaseRequests(
            proxyConfig.port
          );
          if (savedRequests.length > 0) {
            console.log(
              `📝 Loading ${savedRequests.length} database requests for proxy ${proxyConfig.port}`
            );

            // Add requests to the intercepted queries list (without emitting events)
            // The getter methods will handle proper sorting by timestamp
            for (const request of savedRequests) {
              databaseProxyInterceptor.addInterceptedQuery(request, false);
            }
          }
        } catch (requestError) {
          console.error(
            `❌ Failed to load database requests for proxy ${proxyConfig.port}:`,
            requestError.message
          );
        }

        // Use ProxyManager to determine if proxy should auto-start
        const shouldAutoStart = proxyManager.shouldAutoStart(proxyConfig);

        if (shouldAutoStart) {
          try {
            console.log(
              `🚀 Auto-starting database proxy on port ${proxyConfig.port}: ${proxyConfig.name}`
            );
            await databaseProxyInterceptor.startDatabaseProxy(proxyConfig.port);
            console.log(
              `✅ Successfully auto-started database proxy on port ${proxyConfig.port}`
            );
            autoStartedCount++;
          } catch (startError) {
            console.error(
              `❌ Failed to auto-start database proxy on port ${proxyConfig.port}:`,
              startError.message
            );
            failedCount++;
          }
        } else {
          console.log(
            `⏸️ Skipping auto-start for database proxy on port ${proxyConfig.port}: shouldAutoStart=${shouldAutoStart}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to create database proxy on port ${proxyConfig.port}:`,
          error.message
        );
        failedCount++;
      }
    }

    console.log(
      `📊 Database proxy initialization summary: ${restoredCount} restored, ${autoStartedCount} auto-started, ${failedCount} failed`
    );
  } catch (error) {
    console.error("❌ Failed to initialize database proxy system:", error);
  }
}

async function saveDatabaseProxies() {
  try {
    const proxies = databaseProxyInterceptor.getDatabaseProxies();
    await proxyManager.saveDatabaseProxies(proxies);
  } catch (error) {
    console.error("❌ Failed to save database proxies:", error);
  }
}

async function saveDatabaseMocks() {
  try {
    const mocks = databaseProxyInterceptor.getDatabaseMocks();
    await dataManager.saveDatabaseMocks(mocks);
  } catch (error) {
    // console.error("Failed to save database mocks:", error);
  }
}

// Enhanced Proxy Management Handlers using ProxyManager
ipcMain.handle("get-proxy-auto-start-stats", async () => {
  try {
    const stats = await proxyManager.getAutoStartStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-global-auto-start", async (event, enabled) => {
  try {
    proxyManager.setAutoStartEnabled(enabled);
    // Also update the app settings
    appSettings.autoStartProxy = enabled;
    await saveSettings();
    return { success: true, enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-all-proxy-configs", async () => {
  try {
    const exportData = await proxyManager.exportAllProxies();

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export All Proxy Configurations",
      defaultPath: `sniffler-all-proxies-${
        new Date().toISOString().split("T")[0]
      }.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2));
    return { success: true, filePath: result.filePath, data: exportData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("import-all-proxy-configs", async () => {
  try {
    // Show open dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import All Proxy Configurations",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const fileContent = await fs.readFile(result.filePaths[0], "utf-8");
    const importData = JSON.parse(fileContent);

    const importResult = await proxyManager.importProxies(importData);

    if (importResult.success) {
      // Reload all proxy systems
      await loadPersistedProxies();
      await initializeOutgoingProxies();
      await initializeDatabaseProxies();
    }

    return importResult;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Queue UI events until mainWindow is ready to receive them
let __queuedUiEvents = [];
function safeSend(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    try {
      mainWindow.webContents.send(channel, data);
      return;
    } catch (e) {
      // fallthrough to queue
    }
  }
  __queuedUiEvents.push({ channel, data });
}

function flushQueuedUiEvents() {
  if (!mainWindow || !mainWindow.webContents) return;
  if (__queuedUiEvents.length === 0) return;
  try {
    for (const evt of __queuedUiEvents) {
      mainWindow.webContents.send(evt.channel, evt.data);
    }
  } finally {
    __queuedUiEvents = [];
  }
}

// Helper function to set up proxy event listeners (delegates to reusable module)
const { setupProxyEventListeners: _setup } = require("./proxy-listeners");
function setupProxyEventListeners(port, proxy) {
  // Pass a proxy object that uses safeSend so events don't get lost before window is ready
  const mainWindowProxy = { webContents: { send: safeSend } };
  _setup(port, proxy, {
    mainWindow: mainWindowProxy,
    dataManager,
    appSettings,
  });
}

// App event handlers
app.whenReady().then(async () => {
  await dataManager.initialize();
  await proxyManager.initialize();

  // Initialize license manager
  await initializeLicenseManager();

  // Load settings from data manager (not the old system)
  try {
    const loadedSettings = await dataManager.loadSettings();
    appSettings = { ...appSettings, ...loadedSettings };

    // One-time: merge installer overrides if present (created by NSIS)
    try {
      const fsSync = require("fs");
      const path = require("path");
      const overridesPath = path.join(
        dataManager.dataDir,
        "install-overrides.json"
      );
      if (fsSync.existsSync(overridesPath)) {
        const raw = fsSync.readFileSync(overridesPath, "utf8");
        if (raw && raw.trim()) {
          const overrides = JSON.parse(raw);
          // Only accept known boolean keys
          const allowed = [
            "runAtStartup",
            "autoStartProxy",
            "autoCheckForUpdates",
          ];
          const filtered = Object.fromEntries(
            Object.entries(overrides).filter(
              ([k, v]) => allowed.includes(k) && typeof v === "boolean"
            )
          );
          if (Object.keys(filtered).length) {
            appSettings = { ...appSettings, ...filtered };
            // Apply startup behavior immediately
            if (
              Object.prototype.hasOwnProperty.call(filtered, "runAtStartup")
            ) {
              configureStartup(filtered.runAtStartup);
            }
            // Persist merged settings
            await dataManager.saveSettings(appSettings);
          }
        }
        // Delete overrides file so we only apply once
        try {
          fsSync.unlinkSync(overridesPath);
        } catch {}
      }
    } catch (overrideErr) {
      // Non-fatal; log for diagnostics only
      console.warn(
        "⚠️ Failed to apply install overrides:",
        overrideErr.message
      );
    }

    // Initialize proxy manager with auto-start setting
    proxyManager.setAutoStartEnabled(appSettings.autoStartProxy);

    // Initialize interceptors with loaded settings
    initializeInterceptors();

    // Configure startup behavior based on settings (after overrides merge)
    configureStartup(appSettings.runAtStartup);

    console.log(
      `⚙️ Settings loaded: autoStartProxy=${appSettings.autoStartProxy}`
    );
  } catch (error) {
    console.error("❌ Failed to load settings, using defaults:", error);
    // Still initialize with default settings
    proxyManager.setAutoStartEnabled(appSettings.autoStartProxy);
    initializeInterceptors();
  }

  // PROFESSIONAL PROXY STARTUP - Replace unreliable junior dev code
  console.log("🚀 Starting ROBUST PROXY STARTUP SYSTEM...");
  const ProxyStartupManager = require("./proxy-startup-manager");
  const startupManager = new ProxyStartupManager(
    proxies,
    proxyManager,
    appSettings
  );

  try {
    const startupResults = await startupManager.startAllProxies();

    if (startupResults.started > 0) {
      console.log(
        `✅ PROXY STARTUP SUCCESS: ${startupResults.started}/${startupResults.total} proxies started`
      );
    }

    if (startupResults.failed > 0) {
      console.warn(
        `⚠️ PROXY STARTUP WARNINGS: ${startupResults.failed} proxies failed to start`
      );
      startupResults.errors.forEach((error) => console.warn(`  - ${error}`));
    }

    // Set up event listeners for all successfully created proxies
    for (const [port, proxyData] of proxies) {
      setupProxyEventListeners(port, proxyData.proxy);
    }
  } catch (error) {
    console.error("💥 FATAL ERROR in proxy startup system:", error);
  }

  console.log("🔧 Setting up proxy configurations...");
  console.log("🔧 DEBUG: About to comment section...");
  // Development outgoing proxy creation was removed to avoid auto-creating proxies in production.

  console.log("🔧 DEBUG: About to loop through proxies...");

  // Apply auto-save setting to all loaded proxies (with proper error handling)
  for (const [port, proxyData] of proxies) {
    console.log(`🔧 DEBUG: Processing proxy on port ${port}...`);
    try {
      // Update proxy settings if the methods exist
      if (proxyData.proxy.updateSettings) {
        proxyData.proxy.updateSettings({
          autoSaveAsMocks: appSettings.autoSaveRequestsAsMocks,
          enablePatternMatching: appSettings.enablePatternMatching,
        });
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not update settings for proxy ${port}:`,
        error.message
      );
    }
    console.log(`🔧 DEBUG: Finished processing proxy on port ${port}`);
  }

  if (!devToolsEnabled) {
    console.log("🍎 Removing application menu (production)...");
    // Remove the application menu in production
    Menu.setApplicationMenu(null);
    console.log("🍎 Menu removed successfully");
  } else {
    console.log("🍎 Keeping application menu (dev mode)");
  }

  // Set up custom protocol handlers for deep linking
  console.log("🔗 Setting up custom protocol handlers...");

  // Handle protocol URLs on macOS
  app.on("open-url", (event, url) => {
    event.preventDefault();
    console.log(`🔗 [MACOS] Protocol URL received: ${url}`);
    handleProtocolUrl(url);
  });

  // Handle protocol URLs on Windows/Linux (second-instance)
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    console.log(
      "🔗 [WINDOWS] Second instance detected, checking for protocol URL..."
    );
    console.log("🔗 [WINDOWS] Command line args:", commandLine);

    // Focus the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Look for protocol URL in command line arguments
    const protocolUrl = commandLine.find((arg) =>
      arg.startsWith("sniffler://")
    );
    if (protocolUrl) {
      console.log(`🔗 Protocol URL found in second instance: ${protocolUrl}`);
      handleProtocolUrl(protocolUrl);
    }
  });

  // Prevent multiple instances (required for second-instance to work)
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log("🔒 Another instance is already running, quitting...");
    app.quit();
    return;
  }

  console.log("✅ Custom protocol handlers set up successfully");

  // Check for protocol URLs in initial startup arguments
  console.log("🔗 [STARTUP] Checking initial command line arguments...");
  const initialArgs = process.argv;
  console.log("🔗 [STARTUP] Process argv:", initialArgs);
  const initialProtocolUrl = initialArgs.find((arg) =>
    arg.startsWith("sniffler://")
  );
  if (initialProtocolUrl) {
    console.log(
      `🔗 [STARTUP] Found protocol URL in initial args: ${initialProtocolUrl}`
    );
    // Handle it after the app is ready
    setTimeout(() => handleProtocolUrl(initialProtocolUrl), 1000);
  }

  console.log("🔌 Setting up event listeners...");
  // Set up database sniffer event forwarding
  // DISABLED: Using DatabaseProxyInterceptor instead for proxy chain monitoring
  // databaseSniffer.on("connection-established", (data) => {
  //   if (mainWindow) {
  //     mainWindow.webContents.send("database-connection-established", data);
  //   }
  // });

  // databaseSniffer.on("connection-closed", (data) => {
  //   if (mainWindow) {
  //     mainWindow.webContents.send("database-connection-closed", data);
  //   }
  // });

  // DISABLED: Avoiding duplicate events since databaseProxyInterceptor already handles this
  // databaseSniffer.on("database-query", (data) => {
  //   if (mainWindow) {
  //     mainWindow.webContents.send("database-query", data);
  //   }
  // });

  // databaseSniffer.on("database-response", (data) => {
  //   if (mainWindow) {
  //     mainWindow.webContents.send("database-response", data);
  //   }
  // });

  // Set up database proxy interceptor event forwarding
  databaseProxyInterceptor.on("database-proxy-created", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-proxy-created", data);
    }
  });

  databaseProxyInterceptor.on("database-proxy-started", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-proxy-started", data);
    }
  });

  databaseProxyInterceptor.on("database-proxy-stopped", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-proxy-stopped", data);
    }
  });

  databaseProxyInterceptor.on("database-connection-established", (data) => {
    if (mainWindow) {
      // Send both proxy-specific and general connection events
      mainWindow.webContents.send(
        "database-proxy-connection-established",
        data
      );
      mainWindow.webContents.send("database-connection-established", data);
    }
  });

  databaseProxyInterceptor.on("database-connection-closed", (data) => {
    if (mainWindow) {
      // Send both proxy-specific and general connection events
      mainWindow.webContents.send("database-proxy-connection-closed", data);
      mainWindow.webContents.send("database-connection-closed", data);
    }
  });

  // Note: Database query/response event listeners are set up in initializeDatabaseProxies()
  // Removed duplicate listeners to prevent double events in UI

  databaseProxyInterceptor.on("database-mock-served", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-served", data);
    }
  });

  databaseProxyInterceptor.on("database-mock-added", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-added", data);
    }
  });

  databaseProxyInterceptor.on("database-mock-removed", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-removed", data);
    }
  });

  databaseProxyInterceptor.on("database-mock-toggled", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-toggled", data);
    }
  });

  databaseProxyInterceptor.on("database-mock-difference-detected", (data) => {
    console.log(
      `📢 Main process received database-mock-difference-detected event for proxy ${data.proxyPort}`
    );
    if (mainWindow) {
      console.log(
        `📤 Sending database-mock-difference-detected to renderer for proxy ${data.proxyPort}`
      );
      mainWindow.webContents.send("database-mock-difference-detected", data);
    } else {
      console.log(
        `❌ Cannot send database-mock-difference-detected - mainWindow is null`
      );
    }
  });

  databaseProxyInterceptor.on("database-mock-updated", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-updated", data);
    }
  });

  databaseProxyInterceptor.on("database-mock-auto-created", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-mock-auto-created", data);
    }
    // Auto-save mocks when created
    saveDatabaseMocks();
  });

  databaseProxyInterceptor.on("database-testing-mode-changed", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("database-testing-mode-changed", data);
    }
  });

  console.log("✅ Event listeners setup complete");

  // Set up outgoing proxy system
  console.log("🔄 Initializing outgoing proxies...");
  try {
    await initializeOutgoingProxies();
    console.log("✅ Outgoing proxies initialized");
  } catch (error) {
    console.error("❌ Failed to initialize outgoing proxies:", error);
    console.error("❌ Stack trace:", error.stack);
  }

  // Set up database proxy system
  console.log("🔄 Initializing database proxies...");
  try {
    await initializeDatabaseProxies();
    console.log("✅ Database proxies initialized");
  } catch (error) {
    console.error("❌ Failed to initialize database proxies:", error);
    console.error("❌ Stack trace:", error.stack);
  }

  console.log("🖥️ All initialization complete, creating window...");

  // ===== PROXY SETUP VALIDATION (dev only) =====
  if (devToolsEnabled) {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 SNIFFLER PROXY SETUP VALIDATION");
    console.log("=".repeat(60));

    // Validate HTTP Proxies
    const httpProxies = Array.from(proxies.values());
    if (httpProxies.length > 0) {
      console.log("✅ HTTP PROXIES CONFIGURED:");
      httpProxies.forEach(({ proxy }) => {
        const status = proxy.isRunning ? "✅ RUNNING" : "❌ STOPPED";
        console.log(
          `   📡 ${proxy.name} (port ${proxy.port} → ${proxy.targetHost}:${proxy.targetPort}) ${status}`
        );
      });
    } else {
      console.log("⚠️  NO HTTP PROXIES CONFIGURED");
    }

    // Validate Outgoing Proxies
    const outgoingProxies = outgoingInterceptor.getProxies();
    if (outgoingProxies.length > 0) {
      console.log("✅ OUTGOING PROXIES CONFIGURED:");
      outgoingProxies.forEach((proxy) => {
        const status = proxy.isRunning ? "✅ RUNNING" : "❌ STOPPED";
        console.log(
          `   🌐 ${proxy.name} (port ${proxy.port} → ${proxy.targetUrl}) ${status}`
        );
      });
    } else {
      console.log("⚠️  NO OUTGOING PROXIES CONFIGURED");
    }

    // Validate Database Proxies
    let databaseProxies = [];
    try {
      databaseProxies = databaseProxyInterceptor.getDatabaseProxies();
      if (databaseProxies.length > 0) {
        console.log("✅ DATABASE PROXIES CONFIGURED:");
        databaseProxies.forEach((proxy) => {
          const status = proxy.isRunning ? "✅ RUNNING" : "❌ STOPPED";
          console.log(
            `   💾 ${proxy.name} (port ${proxy.port}, protocol: ${proxy.protocol}) ${status}`
          );
        });
      } else {
        console.log("⚠️  NO DATABASE PROXIES CONFIGURED");
      }
    } catch (error) {
      console.error(
        "❌ ERROR calling databaseProxyInterceptor.getDatabaseProxies():",
        error
      );
    }

    // Event Flow Validation
    console.log("✅ EVENT FLOW VALIDATION:");
    console.log("   📡 HTTP proxy events → mainWindow.webContents.send");
    console.log("   🌐 Outgoing proxy events → mainWindow.webContents.send");
    console.log("   💾 Database proxy events → mainWindow.webContents.send");
    console.log("   🖥️  UI event listeners configured in App.jsx");

    // Summary
    const totalProxies =
      httpProxies.length + outgoingProxies.length + databaseProxies.length;
    const runningProxies = [
      ...httpProxies.filter((p) => p.proxy.isRunning),
      ...outgoingProxies.filter((p) => p.isRunning),
      ...databaseProxies.filter((p) => p.isRunning),
    ].length;

    console.log("\n📊 SETUP SUMMARY:");
    console.log(`   Total Proxies: ${totalProxies}`);
    console.log(`   Running Proxies: ${runningProxies}`);
    console.log(`   UI Available: http://localhost:8765`);
    console.log(`   Run Test: node test-proxy-setup.js`);

    if (runningProxies === totalProxies && totalProxies >= 3) {
      console.log("🎉 ALL SYSTEMS GO! Sniffler is ready for testing.");
    } else {
      console.log("⚠️  Some proxies may not be running. Check the logs above.");
    }
    console.log("=".repeat(60) + "\n");
    // ===== END VALIDATION =====
  }

  console.log("🔥 DEBUG: About to call createWindow function...");
  try {
    createWindow();
    console.log("🖥️ Window creation initiated");
  } catch (error) {
    console.error("❌ Error creating window:", error);
    console.error("❌ Stack trace:", error.stack);
  }
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    // Stop all proxies before quitting
    const stopPromises = Array.from(proxies.values()).map(async ({ proxy }) => {
      try {
        if (proxy.isRunning) {
          await proxy.stop();
        }
      } catch (error) {
        // console.error("Error stopping proxy:", error);
      }
    });

    // Stop database sniffer
    try {
      await databaseSniffer.stopAll();
    } catch (error) {
      // console.error("Error stopping database sniffer:", error);
    }

    // Stop outgoing proxies
    try {
      await outgoingInterceptor.stopAll();
      await saveOutgoingProxies();
      await saveOutgoingRequests();
    } catch (error) {
      // console.error("Error stopping outgoing proxies:", error);
    }

    // Stop database proxies
    try {
      await databaseProxyInterceptor.stopAll();
      await saveDatabaseProxies();
    } catch (error) {
      // console.error("Error stopping database proxies:", error);
    }

    // Wait for all proxies to stop
    await Promise.all(stopPromises);

    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app closing
app.on("before-quit", async (event) => {
  console.log("🔄 before-quit event triggered");
  console.log("🔄 autoUpdater exists:", !!autoUpdater);
  console.log(
    "🔄 isUpdateInProgress:",
    autoUpdater ? autoUpdater.isUpdateInProgress : "N/A"
  );

  // Check if this is an update-related quit FIRST - if so, allow it to proceed immediately
  if (autoUpdater && autoUpdater.isUpdateInProgress) {
    console.log(
      "🔄 Update in progress - allowing immediate quit for installer"
    );
    console.log("🔄 Skipping cleanup to allow update process to complete");
    // Don't preventDefault() - let the quit proceed immediately for update
    return;
  }

  // For normal app closure, prevent default quit to handle cleanup first
  console.log(
    "🔄 Normal quit detected - preventing default and performing cleanup"
  );
  event.preventDefault();

  try {
    console.log("App shutting down - performing cleanup...");

    // Save settings and proxy configurations before closing
    await saveSettings();
    await saveProxyConfigurations();

    // Stop all proxies
    const stopPromises = Array.from(proxies.values()).map(async ({ proxy }) => {
      try {
        if (proxy.isRunning) {
          await proxy.stop();
        }
      } catch (error) {
        // console.error("Error stopping proxy:", error);
      }
    });

    // Stop database sniffer
    try {
      await databaseSniffer.stopAll();
    } catch (error) {
      // console.error("Error stopping database sniffer:", error);
    }

    // Stop outgoing proxies
    try {
      await outgoingInterceptor.stopAll();
      await saveOutgoingProxies();
      await saveOutgoingRequests();
    } catch (error) {
      // console.error("Error stopping outgoing proxies:", error);
    }

    // Wait for all cleanup to complete
    await Promise.all(stopPromises);

    // Cleanup old data periodically
    await dataManager.cleanup();

    console.log("Cleanup complete - quitting app");
    // Now actually quit
    app.exit(0);
  } catch (error) {
    console.error("Error during app shutdown:", error);
    // Force quit if cleanup fails
    app.exit(1);
  }
});
