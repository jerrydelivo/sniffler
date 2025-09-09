import { useState, useEffect } from "react";
import { MdSave, MdWarning } from "react-icons/md";

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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isElectronAvailable, setIsElectronAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
              <input
                type="number"
                id="maxRequestHistory"
                value={settings.maxRequestHistory}
                onChange={(e) =>
                  handleInputChange(
                    "maxRequestHistory",
                    parseInt(e.target.value) || 100
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="10"
                max="1000"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Number of recent requests to keep in memory (default: 100)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Mock History per Proxy
              </label>
              <input
                type="number"
                value={settings.maxMockHistory}
                onChange={(e) =>
                  handleInputChange(
                    "maxMockHistory",
                    parseInt(e.target.value) || 1000
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="100"
                max="10000"
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

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoSaveRequestsAsMocks"
                checked={settings.autoSaveRequestsAsMocks}
                onChange={(e) =>
                  handleInputChange("autoSaveRequestsAsMocks", e.target.checked)
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
          </div>
        </div>

        {/* Testing Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Testing Settings
          </h2>

          <div className="space-y-4">
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
                (When enabled, outgoing requests will be mocked using previously
                captured responses instead of hitting external APIs)
              </div>
            </div>

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
                (When enabled, database requests will be mocked using previously
                captured responses instead of hitting the actual database)
              </div>
            </div>
          </div>
        </div>

        {/* License Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            License
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Trial version - 27 days remaining
              </p>
              <button
                onClick={() => alert("License purchase coming soon!")}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Purchase License
              </button>
            </div>
          </div>
        </div>

        {/* Developer Tools Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Developer Tools
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Access browser developer tools for debugging and development.
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
                    if (window.electronAPI && window.electronAPI.openDevTools) {
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
                <p>Keyboard shortcuts:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>
                    <strong>F12</strong> - Toggle developer tools
                  </li>
                  <li>
                    <strong>Ctrl+Shift+I</strong> (Windows/Linux) /{" "}
                    <strong>Cmd+Option+I</strong> (Mac) - Toggle developer tools
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
      </div>
    </div>
  );
}

export default SettingsView;
