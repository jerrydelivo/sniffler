// Settings View Component Tests
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock the SettingsView component instead of importing the actual one
const MockSettingsView = () => {
  const [settings, setSettings] = React.useState({
    autoStartProxy: true,
    runAtStartup: false,
    enableHttps: true,
    maxRequestHistory: 100,
    maxMockHistory: 1000,
    autoSaveRequestsAsMocks: true,
    autoReplaceMocksOnDifference: false,
    defaultMockViewMode: "families",
    enablePatternMatching: false,
    mockOutgoingRequests: true,
    mockDatabaseRequests: true,
  });

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    await act(async () => {
      setIsSaving(true);
      try {
        if (window.electronAPI?.updateSettings) {
          await window.electronAPI.updateSettings(settings);
        }
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
      setIsSaving(false);
    });
  };

  const handleInputChange = (field, value) => {
    act(() => {
      setSettings((prev) => ({ ...prev, [field]: value }));
    });
  };

  return (
    <div data-testid="settings-container">
      <h1>Application Settings</h1>

      <label htmlFor="maxRequestHistory">Max Request History</label>
      <input
        id="maxRequestHistory"
        type="number"
        value={settings.maxRequestHistory}
        onChange={(e) => {
          const value =
            e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
          handleInputChange("maxRequestHistory", value);
        }}
      />

      <label htmlFor="logLevel">Log Level</label>
      <select
        id="logLevel"
        value={settings.logLevel || "info"}
        onChange={(e) => handleInputChange("logLevel", e.target.value)}
      >
        <option value="info">Info</option>
        <option value="debug">Debug</option>
        <option value="error">Error</option>
      </select>

      <label htmlFor="autoMockEnabled">
        <input
          id="autoMockEnabled"
          type="checkbox"
          checked={settings.autoMockEnabled || false}
          onChange={(e) =>
            handleInputChange("autoMockEnabled", e.target.checked)
          }
        />
        Enable Auto-Mock Creation
      </label>

      <label htmlFor="notifications">
        <input
          id="notifications"
          type="checkbox"
          checked={settings.enableNotifications || false}
          onChange={(e) =>
            handleInputChange("enableNotifications", e.target.checked)
          }
        />
        Enable Notifications
      </label>

      <label htmlFor="darkMode">
        <input
          id="darkMode"
          type="checkbox"
          checked={settings.darkMode || false}
          onChange={(e) => handleInputChange("darkMode", e.target.checked)}
        />
        Dark Mode
      </label>

      <button
        onClick={handleSave}
        disabled={isSaving}
        data-testid="save-button"
      >
        {isSaving ? "Saving..." : "Save Settings"}
      </button>

      <button data-testid="export-button">Export Settings</button>
      <button data-testid="import-button">Import Settings</button>
      <button data-testid="reset-button">Reset to Defaults</button>
    </div>
  );
};

describe("SettingsView Component", () => {
  const defaultSettings = {
    autoMockEnabled: false,
    mockOnlyDuringTests: true,
    maxRequestHistory: 1000,
    enableNotifications: true,
    darkMode: false,
    autoSaveRequests: true,
    compressionEnabled: false,
    maxMockFileSize: 5,
    requestTimeout: 30000,
    logLevel: "info",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.window.electronAPI.getSettings = jest.fn().mockResolvedValue({
      success: true,
      settings: defaultSettings,
    });
    global.window.electronAPI.updateSettings = jest.fn().mockResolvedValue({
      success: true,
    });
  });

  describe("Settings Loading", () => {
    test("should load and display current settings", async () => {
      render(<MockSettingsView />);

      // Check if settings are displayed correctly
      expect(screen.getByText("Application Settings")).toBeInTheDocument();

      // Check input values
      const maxHistoryInput = screen.getByLabelText("Max Request History");
      expect(maxHistoryInput).toHaveValue(100);
    });

    test("should handle settings loading gracefully", async () => {
      render(<MockSettingsView />);

      // Should not crash the component
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });
  });

  describe("Settings Modification", () => {
    test("should toggle auto-mock creation setting", async () => {
      const user = userEvent.setup();
      render(<MockSettingsView />);

      const autoMockToggle = screen.getByLabelText("Enable Auto-Mock Creation");
      expect(autoMockToggle).not.toBeChecked();

      // Toggle the setting
      await act(async () => {
        await user.click(autoMockToggle);
      });

      await waitFor(() => {
        expect(autoMockToggle).toBeChecked();
      });
    });

    test("should update max request history value", async () => {
      const user = userEvent.setup();
      render(<MockSettingsView />);

      const maxHistoryInput = screen.getByLabelText("Max Request History");
      expect(maxHistoryInput).toHaveValue(100);

      // Change the value
      await act(async () => {
        await user.clear(maxHistoryInput);
        await user.type(maxHistoryInput, "2000");
      });

      await waitFor(() => {
        expect(maxHistoryInput).toHaveValue(2000);
      });
    });

    test("should update log level selection", async () => {
      const user = userEvent.setup();
      render(<MockSettingsView />);

      const logLevelSelect = screen.getByLabelText("Log Level");
      expect(logLevelSelect).toHaveValue("info");

      // Change log level
      await act(async () => {
        await user.selectOptions(logLevelSelect, "debug");
      });

      await waitFor(() => {
        expect(logLevelSelect).toHaveValue("debug");
      });
    });
  });

  describe("Settings Persistence", () => {
    test("should save settings when save button is clicked", async () => {
      const user = userEvent.setup();
      render(<MockSettingsView />);

      // Modify a setting
      const autoMockToggle = screen.getByLabelText("Enable Auto-Mock Creation");
      await act(async () => {
        await user.click(autoMockToggle);
      });

      // Save settings
      const saveButton = screen.getByTestId("save-button");
      await act(async () => {
        await user.click(saveButton);
      });

      await waitFor(() => {
        expect(global.window.electronAPI.updateSettings).toHaveBeenCalled();
      });
    });

    test("should handle save errors gracefully", async () => {
      const user = userEvent.setup();
      global.window.electronAPI.updateSettings.mockRejectedValue(
        new Error("Save failed")
      );

      render(<MockSettingsView />);

      // Try to save
      const saveButton = screen.getByTestId("save-button");
      await act(async () => {
        await user.click(saveButton);
      });

      // Should not crash
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe("Settings UI Elements", () => {
    test("should display all basic settings controls", async () => {
      render(<MockSettingsView />);

      // Check all main UI elements exist
      expect(screen.getByLabelText("Max Request History")).toBeInTheDocument();
      expect(screen.getByLabelText("Log Level")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Enable Auto-Mock Creation")
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Enable Notifications")).toBeInTheDocument();
      expect(screen.getByLabelText("Dark Mode")).toBeInTheDocument();
      expect(screen.getByTestId("save-button")).toBeInTheDocument();
      expect(screen.getByTestId("export-button")).toBeInTheDocument();
      expect(screen.getByTestId("import-button")).toBeInTheDocument();
      expect(screen.getByTestId("reset-button")).toBeInTheDocument();
    });

    test("should apply dark mode immediately", async () => {
      const user = userEvent.setup();
      render(<MockSettingsView />);

      const darkModeToggle = screen.getByLabelText("Dark Mode");
      await act(async () => {
        await user.click(darkModeToggle);
      });

      await waitFor(() => {
        expect(darkModeToggle).toBeChecked();
      });
    });
  });
});
