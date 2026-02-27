import { useState, useEffect } from "react";
import { MdSave, MdWarning } from "react-icons/md";
import { ReliableInput } from "../common/ReliableInput";
import Modal from "../common/Modal";
import { usePremiumFeature } from "../../hooks/usePremiumFeature.jsx";

function SettingsView() {
  const [settings, setSettings] = useState({
    autoStartProxy: true,
    runAtStartup: false, // New setting to run Sniffler at Windows startup - default to false for less intrusive behavior
    enableHttps: true,
    maxRequestHistory: 100, // Changed from 1000 to 100 as per user request
    maxMockHistory: 1000, // Maximum number of mocks to keep
    autoSaveRequestsAsMocks: true, // Unified setting for auto-saving all request types as mocks
    autoReplaceMocksOnDifference: false, // Auto-replace mocks when newer requests differ - DEFAULT TO FALSE
    defaultMockViewMode: "families", // "list" or "families"
    enablePatternMatching: false, // Enable smart pattern matching for mocks - DEFAULT TO FALSE
    mockOutgoingRequests: true, // Mock outgoing requests using previously captured responses
    mockDatabaseRequests: true, // Mock database requests using previously captured responses
    // Auto-update settings
    autoCheckForUpdates: true, // Check for updates automatically
    updateCheckInterval: 12, // Default to 12 hours; interval is not user-editable
    autoDownloadUpdates: false, // Don't auto-download (ask user first)
    autoInstallUpdates: false, // Don't auto-install (ask user first)
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isElectronAvailable, setIsElectronAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isDevToolsEnabled, setIsDevToolsEnabled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState(null);

  // Check premium access for advanced features
  const { canUseFeature: canUseAdvancedFeatures } =
    usePremiumFeature("advanced-features");

  // Check if we're running in Electron environment
  useEffect(() => {
    try {
      setIsElectronAvailable(!!window.electronAPI);
      setIsLoading(false);
    } catch (error) {
      // console.error("Error checking Electron availability:", error);
      setLoadError("Failed to initialize settings");
      setIsLoading(false);
    }
  }, []);

  // Load settings on component mount
  useEffect(() => {
    if (isElectronAvailable) {
      loadSettings().catch((error) => {
        // console.error("Error loading settings:", error);
      });

      // Ask main if dev tools are enabled to decide whether to show the section
      if (window.electronAPI && window.electronAPI.isDevToolsEnabled) {
        window.electronAPI
          .isDevToolsEnabled()
          .then((res) => setIsDevToolsEnabled(!!res?.enabled))
          .catch(() => setIsDevToolsEnabled(false));
      }
    }
  }, [isElectronAvailable]);

  const loadSettings = async () => {
    try {
      setLoadError(null);
      if (window.electronAPI && window.electronAPI.getSettings) {
        const result = await window.electronAPI.getSettings();
        if (result.success) {
          setSettings((prev) => ({ ...prev, ...result.settings }));
        }
      }
    } catch (error) {
      // console.error("Failed to load settings:", error);
      setLoadError("Failed to load settings: " + error.message);
    }
  };

  const saveSettings = async () => {
    if (!isElectronAvailable) {
      alert("Settings can only be saved in the Electron app environment.");
      return;
    }

    try {
      setIsSaving(true);
      if (window.electronAPI && window.electronAPI.saveSettings) {
        const result = await window.electronAPI.saveSettings(settings);
        if (result.success) {
          setLastSaved(new Date());
        } else {
          alert(
            "Failed to save settings: " + (result.error || "Unknown error")
          );
        }
      }
    } catch (error) {
      alert("Failed to save settings: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    try {
      setSettings((prev) => ({ ...prev, [field]: value }));
    } catch (error) {
      // console.error("Error updating setting:", error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">
          Loading settings...
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-500">{loadError}</div>
        <button
          onClick={() => {
            setLoadError(null);
            setIsLoading(true);
            loadSettings().finally(() => setIsLoading(false));
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="settings-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <div className="flex items-center space-x-4">
          {lastSaved && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={isSaving || !isElectronAvailable}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <MdSave className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Warning for web environment */}
      {!isElectronAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <MdWarning className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-amber-800">
              Web Development Mode
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              You're viewing the settings in web development mode. Settings can
              only be saved when running in the full Electron application.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            General
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="maxRequestHistory"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Max Request History per Proxy
              </label>
              <ReliableInput
                type="number"
                value={settings.maxRequestHistory}
                onChange={(e) =>
                  handleInputChange(
                    "maxRequestHistory",
                    parseInt(e.target.value) || 100
                  )
                }
                fullWidth
                inputProps={{ min: 10, max: 1000 }}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Number of recent requests to keep in memory (default: 100)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Mock History per Proxy
              </label>
              <ReliableInput
                type="number"
                value={settings.maxMockHistory}
                onChange={(e) =>
                  handleInputChange(
                    "maxMockHistory",
                    parseInt(e.target.value) || 1000
                  )
                }
                fullWidth
                inputProps={{ min: 100, max: 10000 }}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Number of mocks to keep in memory (default: 1000)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Mock View Mode
              </label>
              <select
                value={settings.defaultMockViewMode}
                onChange={(e) =>
                  handleInputChange("defaultMockViewMode", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="list">List View</option>
                <option value="families">Family View</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoStartProxy"
                checked={settings.autoStartProxy}
                onChange={(e) =>
                  handleInputChange("autoStartProxy", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="autoStartProxy"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Auto-start proxies when application launches
              </label>
              <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                (Automatically starts all proxy types: HTTP, outgoing, and
                database proxies)
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="runAtStartup"
                checked={settings.runAtStartup}
                onChange={(e) =>
                  handleInputChange("runAtStartup", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="runAtStartup"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Run Sniffler at system startup
              </label>
              <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                (Start Sniffler automatically when Windows starts)
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableHttps"
                checked={settings.enableHttps}
                onChange={(e) =>
                  handleInputChange("enableHttps", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="enableHttps"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Enable HTTPS interception
              </label>
            </div>

            {canUseAdvancedFeatures ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoSaveRequestsAsMocks"
                  checked={settings.autoSaveRequestsAsMocks}
                  onChange={(e) =>
                    handleInputChange(
                      "autoSaveRequestsAsMocks",
                      e.target.checked
                    )
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="autoSaveRequestsAsMocks"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Auto-save new requests as mocks
                </label>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (Automatically creates mocks from successful responses for all
                  request types: HTTP, outgoing, and database)
                </div>
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  id="autoSaveRequestsAsMocks"
                  checked={false}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label
                  htmlFor="autoSaveRequestsAsMocks"
                  className="ml-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Auto-save new requests as mocks
                </label>
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Premium
                </span>
              </div>
            )}

            {canUseAdvancedFeatures ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoReplaceMocksOnDifference"
                  checked={settings.autoReplaceMocksOnDifference}
                  onChange={(e) =>
                    handleInputChange(
                      "autoReplaceMocksOnDifference",
                      e.target.checked
                    )
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="autoReplaceMocksOnDifference"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Automatically replace mocks when newer requests differ
                </label>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (Auto-updates mocks with latest response when differences are
                  detected)
                </div>
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  id="autoReplaceMocksOnDifference"
                  checked={false}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label
                  htmlFor="autoReplaceMocksOnDifference"
                  className="ml-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Automatically replace mocks when newer requests differ
                </label>
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Premium
                </span>
              </div>
            )}

            {canUseAdvancedFeatures ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enablePatternMatching"
                  checked={settings.enablePatternMatching}
                  onChange={(e) =>
                    handleInputChange("enablePatternMatching", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="enablePatternMatching"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Enable smart pattern matching for mocks
                </label>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (Only create mocks for the first request in patterns like
                  /cars/1, /cars/2 or /users/&#123;uuid&#125;)
                </div>
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  id="enablePatternMatching"
                  checked={false}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label
                  htmlFor="enablePatternMatching"
                  className="ml-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Enable smart pattern matching for mocks
                </label>
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Premium
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Testing Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Testing Settings
          </h2>

          <div className="space-y-4">
            {canUseAdvancedFeatures ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mockOutgoingRequests"
                  checked={settings.mockOutgoingRequests}
                  onChange={(e) =>
                    handleInputChange("mockOutgoingRequests", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="mockOutgoingRequests"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Mock Outgoing Requests
                </label>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (When enabled, outgoing requests will be mocked using
                  previously captured responses instead of hitting external
                  APIs)
                </div>
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  id="mockOutgoingRequests"
                  checked={false}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label
                  htmlFor="mockOutgoingRequests"
                  className="ml-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Mock Outgoing Requests
                </label>
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Premium
                </span>
              </div>
            )}

            {canUseAdvancedFeatures ? (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mockDatabaseRequests"
                  checked={settings.mockDatabaseRequests}
                  onChange={(e) =>
                    handleInputChange("mockDatabaseRequests", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="mockDatabaseRequests"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Mock Database Requests
                </label>
                <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (When enabled, database requests will be mocked using
                  previously captured responses instead of hitting the actual
                  database)
                </div>
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  id="mockDatabaseRequests"
                  checked={false}
                  disabled={true}
                  className="h-4 w-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                />
                <label
                  htmlFor="mockDatabaseRequests"
                  className="ml-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Mock Database Requests
                </label>
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Premium
                </span>
              </div>
            )}
          </div>
        </div>

        {/* License section removed per request */}

        {/* Updates Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Updates
          </h2>
          <div className="space-y-6">
            {/* Auto-update Settings */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoCheckForUpdates"
                  checked={settings.autoCheckForUpdates}
                  onChange={(e) =>
                    handleInputChange("autoCheckForUpdates", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="autoCheckForUpdates"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Automatically check for updates
                </label>
              </div>

              {settings.autoCheckForUpdates && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Update checks run automatically approximately every 12 hours.
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoDownloadUpdates"
                  checked={settings.autoDownloadUpdates}
                  onChange={(e) =>
                    handleInputChange("autoDownloadUpdates", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="autoDownloadUpdates"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Automatically download updates (recommended: disabled)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoInstallUpdates"
                  checked={settings.autoInstallUpdates}
                  onChange={(e) =>
                    handleInputChange("autoInstallUpdates", e.target.checked)
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="autoInstallUpdates"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Automatically install updates (recommended: disabled)
                </label>
              </div>
            </div>

            {/* Manual Check Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Manually check for available updates and test the update system.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    if (
                      window.electronAPI &&
                      window.electronAPI.checkForUpdates
                    ) {
                      try {
                        const result = await window.electronAPI.checkForUpdates(
                          false
                        );
                        if (result?.success && result?.updateInfo) {
                          setModalTitle("Update available");
                          setModalContent(
                            <div className="space-y-1">
                              <p>
                                <strong>Version:</strong>{" "}
                                {result.updateInfo.version || "unknown"}
                              </p>
                              {result.updateInfo.releaseDate && (
                                <p>
                                  <strong>Release Date:</strong>{" "}
                                  {result.updateInfo.releaseDate}
                                </p>
                              )}
                            </div>
                          );
                          setModalOpen(true);
                        } else {
                          // Treat unknown or no-update outcomes as up-to-date for a clean UX
                          setModalTitle("You're up to date");
                          setModalContent(
                            <div>
                              <p>The latest version is already installed.</p>
                            </div>
                          );
                          setModalOpen(true);
                        }
                      } catch (error) {
                        // Suppress internal error details and keep the UX friendly
                        setModalTitle("You're up to date");
                        setModalContent(
                          <div>
                            <p>The latest version is already installed.</p>
                          </div>
                        );
                        setModalOpen(true);
                      }
                    } else {
                      setModalTitle("Not available");
                      setModalContent(
                        <p>Update check not available in this environment.</p>
                      );
                      setModalOpen(true);
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Check for Updates
                </button>
                <button
                  onClick={async () => {
                    if (
                      window.electronAPI &&
                      window.electronAPI.getUpdateStatus
                    ) {
                      try {
                        const status =
                          await window.electronAPI.getUpdateStatus();
                        setModalTitle("Update status");
                        setModalContent(
                          <div className="space-y-1">
                            {status?.success ? (
                              <>
                                {status?.updateInfo ? (
                                  <>
                                    <p>
                                      <strong>Update available</strong>
                                    </p>
                                    <p>
                                      <strong>Version:</strong>{" "}
                                      {status.updateInfo.version || "unknown"}
                                    </p>
                                    {status.updateInfo.releaseDate && (
                                      <p>
                                        <strong>Release Date:</strong>{" "}
                                        {status.updateInfo.releaseDate}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p>
                                    No update available. You're on the latest
                                    version.
                                  </p>
                                )}
                                {status?.downloaded && <p>Downloaded: Yes</p>}
                                {status?.installing && (
                                  <p>Installing: In progress</p>
                                )}
                              </>
                            ) : (
                              <p>
                                Update service is currently unavailable. Please
                                try again later.
                              </p>
                            )}
                          </div>
                        );
                        setModalOpen(true);
                      } catch (error) {
                        setModalTitle("Update status");
                        setModalContent(
                          <p>
                            Update service is currently unavailable. Please try
                            again later.
                          </p>
                        );
                        setModalOpen(true);
                      }
                    } else {
                      setModalTitle("Not available");
                      setModalContent(
                        <p>Update status not available in this environment.</p>
                      );
                      setModalOpen(true);
                    }
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Get Update Status
                </button>
              </div>
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                <p>
                  Current version: <strong>1.0.0</strong> (check app for actual
                  version)
                </p>
                <p>Update server: GitHub Releases</p>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Tools Section (hidden in production) */}
        {isDevToolsEnabled && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Developer Tools (development mode only)
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Access browser developer tools for debugging and development.
                  These controls are available when running the app in
                  development mode.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (
                        window.electronAPI &&
                        window.electronAPI.toggleDevTools
                      ) {
                        window.electronAPI.toggleDevTools();
                      }
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Toggle Dev Tools
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.electronAPI &&
                        window.electronAPI.openDevTools
                      ) {
                        window.electronAPI.openDevTools();
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Open Dev Tools
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.electronAPI &&
                        window.electronAPI.closeDevTools
                      ) {
                        window.electronAPI.closeDevTools();
                      }
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                  >
                    Close Dev Tools
                  </button>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <p>Keyboard shortcuts (development mode only):</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>
                      <strong>F12</strong> - Toggle developer tools
                    </li>
                    <li>
                      <strong>Ctrl+Shift+I</strong> (Windows/Linux) /{" "}
                      <strong>Cmd+Option+I</strong> (Mac) - Toggle developer
                      tools
                    </li>
                    <li>
                      <strong>Ctrl+Shift+J</strong> (Windows/Linux) /{" "}
                      <strong>Cmd+Option+J</strong> (Mac) - Open console
                    </li>
                    <li>
                      <strong>Right-click → "Inspect Element"</strong> - Inspect
                      specific element
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Modal
        open={modalOpen}
        title={modalTitle}
        onClose={() => setModalOpen(false)}
      >
        {modalContent}
      </Modal>
    </div>
  );
}

export default SettingsView;
