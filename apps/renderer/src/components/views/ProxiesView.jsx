import { useState } from "react";
import NotificationModal from "../modals/NotificationModal";
import ConfirmationModal from "../modals/ConfirmationModal";
import { getSuggestedPortsWithDescriptions } from "../../utils/portSuggestions";
import { createPortBlurHandler } from "../../utils/portHandlers";
import { ReliableInput } from "../common/ReliableInput";

function ProxiesView({
  proxies = [],
  onStartProxy,
  onStopProxy,
  onDisableProxy,
  onEnableProxy,
  onRestartAll,
  isCreationMode = false,
  proxyNotifications = new Map(),
  onClearNotifications = () => {},
  onRefresh = () => {},
}) {
  const [showAddForm, setShowAddForm] = useState(isCreationMode);
  const [newProxyPort, setNewProxyPort] = useState("");
  const [newProxyName, setNewProxyName] = useState("");
  const [newTargetHost, setNewTargetHost] = useState("localhost");
  const [newTargetPort, setNewTargetPort] = useState("3000");
  const [portWarning, setPortWarning] = useState(null);
  const [editingProxy, setEditingProxy] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    port: "",
    targetHost: "",
    targetPort: "",
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showTargetPortSuggestions, setShowTargetPortSuggestions] =
    useState(false);
  const [notification, setNotification] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    actions: [],
  });
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    type: "warning",
  });

  // Get port suggestions
  const existingPorts = (proxies || []).map((p) => p.port);
  const portSuggestions = getSuggestedPortsWithDescriptions(existingPorts, 5);

  const showNotification = (title, message, type = "info", actions = []) => {
    setNotification({ isOpen: true, title, message, type, actions });
  };

  const showConfirmation = (title, message, onConfirm, type = "warning") => {
    setConfirmation({ isOpen: true, title, message, onConfirm, type });
  };

  const handlePortBlur = createPortBlurHandler(newProxyPort, setPortWarning);

  const handlePortChange = (newPort) => {
    setNewProxyPort(newPort);
    setPortWarning(null); // Clear warning when user starts typing
  };

  const testTargetConnection = async () => {
    if (!newTargetHost || !newTargetPort) {
      showNotification(
        "Missing Information",
        "Please enter target host and port first",
        "warning"
      );
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await window.electronAPI.testTargetConnection({
        targetHost: newTargetHost,
        targetPort: parseInt(newTargetPort),
      });

      setConnectionStatus(result);

      if (result.success) {
        showNotification(
          "Connection Test Successful",
          `✅ ${result.message}`,
          "success"
        );
      } else {
        let message = `❌ Connection test failed!\n${result.message}`;

        if (result.errorType === "SERVICE_NOT_RUNNING") {
          message += `\n\n💡 Tips:\n• Start your target application on port ${newTargetPort}\n• Verify the port number is correct\n• Check if another service is using that port`;
        } else if (result.errorType === "HOSTNAME_NOT_FOUND") {
          message += `\n\n💡 Tips:\n• Check the hostname spelling\n• Use 'localhost' or '127.0.0.1' for local services\n• Verify network connectivity for remote hosts`;
        }

        showNotification("Connection Test Failed", message, "error");
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: `Test failed: ${error.message}`,
      });
      showNotification(
        "Connection Test Error",
        `❌ Connection test error: ${error.message}`,
        "error"
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddProxy = async (e) => {
    e.preventDefault();
    if (newProxyPort && newProxyName && newTargetPort) {
      // Validate to prevent circular proxy configuration
      const proxyPort = parseInt(newProxyPort);
      const targetPort = parseInt(newTargetPort);

      if (
        (newTargetHost === "localhost" || newTargetHost === "127.0.0.1") &&
        targetPort === proxyPort
      ) {
        showNotification(
          "Invalid Configuration",
          `Cannot create proxy on port ${proxyPort} targeting ${newTargetHost}:${targetPort}. This would create an infinite loop. Please use a different target port.`,
          "error"
        );
        return;
      }

      // Check if port is already in use
      if (proxies.some((p) => p.port === proxyPort)) {
        showNotification(
          "Port Already in Use",
          `Port ${proxyPort} is already in use by another proxy`,
          "error"
        );
        return;
      }

      const result = await onStartProxy(
        proxyPort,
        newProxyName,
        newTargetHost,
        targetPort
      );
      if (result.success) {
        setNewProxyPort("");
        setNewProxyName("");
        setNewTargetHost("localhost");
        setNewTargetPort("3000");
        setShowAddForm(false);
        setConnectionStatus(null);
        setPortWarning(null);
      } else {
        let errorMessage = `Failed to start proxy: ${result.error}`;

        // Add helpful tips based on error type
        if (result.errorType === "SERVICE_NOT_RUNNING") {
          errorMessage += `\n\n💡 Tips:\n• Start your target application on ${result.targetHost}:${result.targetPort}\n• Verify the port number is correct\n• You can use the "Test Connection" button to verify`;
        } else if (result.errorType === "TARGET_SERVER_UNAVAILABLE") {
          errorMessage += `\n\n💡 Make sure a service is running on ${result.targetHost}:${result.targetPort}`;
        } else if (result.errorType === "HOSTNAME_NOT_FOUND") {
          errorMessage += `\n\n💡 Check the hostname spelling and network connectivity`;
        }

        showNotification("Proxy Start Failed", errorMessage, "error");
      }
    }
  };

  const startEditing = (proxy) => {
    setEditingProxy(proxy.port);
    setEditForm({
      name: proxy.name,
      port: proxy.port.toString(),
      targetHost: proxy.targetHost || "localhost",
      targetPort: (proxy.targetPort || 3000).toString(),
    });
  };

  const cancelEditing = () => {
    setEditingProxy(null);
    setEditForm({
      name: "",
      port: "",
      targetHost: "",
      targetPort: "",
    });
  };

  const saveProxyChanges = async (originalPort) => {
    if (!editForm.name.trim()) {
      showNotification("Invalid Input", "Proxy name cannot be empty", "error");
      return;
    }

    const newPort = parseInt(editForm.port);
    if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
      showNotification(
        "Invalid Port",
        "Port must be a number between 1 and 65535",
        "error"
      );
      return;
    }

    const targetPort = parseInt(editForm.targetPort);
    if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
      showNotification(
        "Invalid Target Port",
        "Target port must be a number between 1 and 65535",
        "error"
      );
      return;
    }

    // Validate to prevent circular proxy configuration
    if (
      (editForm.targetHost === "localhost" ||
        editForm.targetHost === "127.0.0.1") &&
      targetPort === newPort
    ) {
      showNotification(
        "Invalid Configuration",
        `Cannot target ${editForm.targetHost}:${targetPort}. This would create an infinite loop.`,
        "error"
      );
      return;
    }

    // If port changed, need to stop old proxy and start new one
    if (newPort !== originalPort) {
      if (proxies.some((p) => p.port === newPort && p.port !== originalPort)) {
        showNotification(
          "Port Already in Use",
          "Port is already in use by another proxy",
          "error"
        );
        return;
      }

      try {
        // Stop the original proxy
        await onStopProxy(originalPort);

        // Start new proxy with all new configuration
        const result = await onStartProxy(
          newPort,
          editForm.name.trim(),
          editForm.targetHost.trim(),
          targetPort
        );
        if (!result.success) {
          showNotification(
            "Proxy Update Failed",
            `Failed to start proxy on new port: ${result.error}`,
            "error"
          );
          // Try to restart on original port with original config
          const originalProxy = proxies.find((p) => p.port === originalPort);
          if (originalProxy) {
            await onStartProxy(
              originalPort,
              originalProxy.name,
              originalProxy.targetHost || "localhost",
              originalProxy.targetPort || 3000
            );
          }
          return;
        }
      } catch (error) {
        showNotification(
          "Proxy Update Failed",
          "Failed to update proxy: " + error.message,
          "error"
        );
        return;
      }
    } else {
      // Port didn't change, update configuration via IPC
      if (window.electronAPI && window.electronAPI.updateProxyConfig) {
        const updates = {
          name: editForm.name.trim(),
          targetHost: editForm.targetHost.trim(),
          targetPort: targetPort,
        };

        const result = await window.electronAPI.updateProxyConfig(
          originalPort,
          updates
        );
        if (!result.success) {
          showNotification(
            "Proxy Update Failed",
            "Failed to update proxy: " + result.error,
            "error"
          );
          return;
        }

        // Trigger a reload of proxy data in the parent component
        if (onRefresh) {
          await onRefresh();
        }
      }
    }

    setEditingProxy(null);
    setEditForm({
      name: "",
      port: "",
      targetHost: "",
      targetPort: "",
    });
  };

  const disableProxy = async (port) => {
    showConfirmation(
      "Disable Proxy",
      `Are you sure you want to disable the proxy on port ${port}? This will stop the proxy but keep all data.`,
      async () => {
        try {
          if (onDisableProxy) {
            await onDisableProxy(port);
          }
        } catch (error) {
          showNotification(
            "Disable Failed",
            "Failed to disable proxy: " + error.message,
            "error"
          );
        }
      }
    );
  };

  const enableProxy = async (port) => {
    try {
      if (onEnableProxy) {
        await onEnableProxy(port);
      }
    } catch (error) {
      showNotification(
        "Enable Failed",
        "Failed to enable proxy: " + error.message,
        "error"
      );
    }
  };

  const deleteProxy = async (port) => {
    showConfirmation(
      "Delete Proxy",
      `Are you sure you want to delete the proxy on port ${port}? This will also delete all associated mocks and request history.`,
      async () => {
        try {
          await onStopProxy(port);

          // Clear associated data via IPC
          if (window.electronAPI && window.electronAPI.deleteProxy) {
            await window.electronAPI.deleteProxy(port);
          }
        } catch (error) {
          showNotification(
            "Delete Failed",
            "Failed to delete proxy: " + error.message,
            "error"
          );
        }
      },
      "danger"
    );
  };

  return (
    <div>
      {!isCreationMode && (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Projects
          </h1>
          <div className="flex gap-2">
            {proxies.length > 0 && onRestartAll && (
              <button
                onClick={async () => {
                  const result = await onRestartAll();
                  if (result && result.success) {
                    let message = `✅ Professional restart completed!\n\n`;
                    message += `Started: ${result.restarted}/${result.total} proxies\n`;
                    if (result.failed > 0) {
                      message += `Failed: ${result.failed} proxies\n`;
                      if (result.errors && result.errors.length > 0) {
                        message += `\nErrors:\n${result.errors
                          .slice(0, 3)
                          .join("\n")}`;
                        if (result.errors.length > 3) {
                          message += `\n... and ${
                            result.errors.length - 3
                          } more`;
                        }
                      }
                    }

                    showNotification(
                      result.failed > 0
                        ? "Restart Completed with Issues"
                        : "All Proxies Restarted Successfully",
                      message,
                      result.failed > 0 ? "warning" : "success"
                    );
                  } else {
                    showNotification(
                      "Restart Failed",
                      result?.error ||
                        "Failed to restart proxies - check console for details",
                      "error"
                    );
                  }
                }}
                className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-orange-700 text-sm"
                title="Restart all proxies to fix connection issues"
              >
                🔄 Restart All
              </button>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              data-action="add-proxy"
            >
              Add Project
            </button>
          </div>
        </div>
      )}

      {/* Add Proxy Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {isCreationMode ? "New Project Configuration" : "Add New Project"}
          </h2>
          <form onSubmit={handleAddProxy} className="space-y-4">
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Project Name
              </label>
              <ReliableInput
                id="projectName"
                value={newProxyName}
                onChange={(e) => setNewProxyName(e.target.value)}
                placeholder="e.g., My API Project"
                fullWidth
                required
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="listenPort"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Listen Port (Sniffler)
                </label>
                <div className="relative">
                  <input
                    id="listenPort"
                    type="number"
                    value={newProxyPort}
                    onChange={(e) => handlePortChange(e.target.value)}
                    onBlur={handlePortBlur}
                    placeholder="e.g., 3000"
                    min="1"
                    max="65535"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewProxyPort("3000")}
                      className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      title="Common Node.js/React port"
                    >
                      3000
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProxyPort("8080")}
                      className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      title="Common Spring Boot/Tomcat port"
                    >
                      8080
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProxyPort("5000")}
                      className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      title="Common Flask/ASP.NET port"
                    >
                      5000
                    </button>
                  </div>
                </div>
                {portWarning && (
                  <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                    <span className="text-sm">⚠️</span>
                    {portWarning}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Port your frontend will connect to
                </p>
              </div>
              <div>
                <label
                  htmlFor="targetPort"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Target Port (Your Server)
                </label>
                <div className="relative">
                  <input
                    id="targetPort"
                    type="number"
                    value={newTargetPort}
                    onChange={(e) => setNewTargetPort(e.target.value)}
                    placeholder="e.g., 8701"
                    min="1"
                    max="65535"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowTargetPortSuggestions(!showTargetPortSuggestions)
                    }
                    className="absolute right-2 top-2 text-blue-600 hover:text-blue-700 text-sm"
                    title="Show port suggestions"
                  >
                    💡
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Port your actual server runs on
                </p>

                {/* Target Port Suggestions */}
                {showTargetPortSuggestions && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        🎯 Suggested Server Ports (Development-Friendly)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowTargetPortSuggestions(false)}
                        className="text-blue-600 hover:text-blue-700 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-1">
                      {portSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.port}
                          type="button"
                          onClick={() => {
                            setNewTargetPort(suggestion.port.toString());
                            setShowTargetPortSuggestions(false);
                          }}
                          className="w-full text-left px-2 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-800 rounded border border-blue-200 dark:border-blue-600 transition-colors"
                        >
                          <span className="font-mono font-bold text-blue-800 dark:text-blue-200">
                            {suggestion.port}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">
                            - {suggestion.description}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      💡 These ports are specifically chosen to avoid conflicts
                      with common services
                    </p>
                  </div>
                )}

                {newTargetHost === "localhost" &&
                  newTargetPort === newProxyPort && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ Target port cannot be the same as proxy port (would
                      create infinite loop)
                    </p>
                  )}
              </div>
            </div>
            <div>
              <label
                htmlFor="targetHost"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Target Host
              </label>
              <input
                id="targetHost"
                type="text"
                value={newTargetHost}
                onChange={(e) => setNewTargetHost(e.target.value)}
                placeholder="localhost"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Hostname where your server is running (usually localhost)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                {isCreationMode ? "Create Project" : "Start Proxy"}
              </button>
              <button
                type="button"
                onClick={testTargetConnection}
                disabled={testingConnection || !newTargetHost || !newTargetPort}
                className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {testingConnection ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span className="hidden sm:inline">Testing...</span>
                    <span className="sm:hidden">Test...</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    <span className="hidden sm:inline">Test Connection</span>
                    <span className="sm:hidden">Test</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  // If we're in initial creation mode (first run / no projects wizard)
                  // don't hide the form entirely or the user will see an empty screen.
                  // Instead, just reset the form fields. In normal (non-creation) mode
                  // we preserve the old behavior of collapsing the form.
                  if (isCreationMode) {
                    setNewProxyPort("");
                    setNewProxyName("");
                    setNewTargetHost("localhost");
                    setNewTargetPort("3000");
                    setConnectionStatus(null);
                    setPortWarning(null);
                  } else {
                    setShowAddForm(false);
                    setPortWarning(null);
                  }
                }}
                className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Proxies List */}
      {!isCreationMode && (
        <div className="space-y-3 sm:space-y-4">
          {proxies.map((proxy) => (
            <div
              key={proxy.port}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6"
            >
              {editingProxy === proxy.port ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Proxy Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder="Enter proxy name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Listen Port
                      </label>
                      <input
                        type="number"
                        value={editForm.port}
                        onChange={(e) =>
                          setEditForm({ ...editForm, port: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="1"
                        max="65535"
                      />
                    </div>
                  </div>

                  {/* Target Configuration - Only show when proxy is disabled */}
                  {proxy.disabled && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Target Configuration
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          Editable when disabled
                        </span>
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Target Host
                          </label>
                          <input
                            type="text"
                            value={editForm.targetHost}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                targetHost: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="localhost"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Hostname where your server is running
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Target Port
                          </label>
                          <input
                            type="number"
                            value={editForm.targetPort}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                targetPort: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="3000"
                            min="1"
                            max="65535"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Port your actual server runs on
                          </p>
                          {editForm.targetHost === "localhost" &&
                            editForm.targetPort === editForm.port && (
                              <p className="text-xs text-red-500 mt-1">
                                ⚠️ Target port cannot be the same as listen port
                                (would create infinite loop)
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => saveProxyChanges(proxy.port)}
                      className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="bg-gray-500 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display Mode */
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                          {proxy.name}
                        </h3>
                        {proxyNotifications.get(proxy.port) > 0 && (
                          <button
                            onClick={() => onClearNotifications(proxy.port)}
                            className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors cursor-pointer"
                            title="Click to clear notifications"
                          >
                            ({proxyNotifications.get(proxy.port)})
                          </button>
                        )}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="font-medium text-sm">Listen:</span>
                          <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs sm:text-sm">
                            localhost:{proxy.port}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="font-medium text-sm">
                            Target:
                            {proxy.disabled && (
                              <span className="ml-1 text-xs text-blue-600">
                                (editable)
                              </span>
                            )}
                          </span>
                          <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs sm:text-sm break-all">
                            {proxy.targetHost || "localhost"}:
                            {proxy.targetPort || 3000}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center mt-2">
                        {proxy.disabled ? (
                          <>
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Disabled
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            <span className="text-sm text-green-600 dark:text-green-400">
                              Active
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                    <button
                      onClick={() => startEditing(proxy)}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-blue-700 flex items-center gap-1 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title="Edit proxy name and port"
                      disabled={proxy.disabled}
                    >
                      <span>✏️</span>
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {proxy.disabled ? (
                      <button
                        onClick={() => enableProxy(proxy.port)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-green-700 flex items-center gap-1"
                        title="Enable proxy"
                      >
                        <span>▶️</span>
                        <span className="hidden sm:inline">Enable</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => disableProxy(proxy.port)}
                        className="bg-orange-600 text-white px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-orange-700 flex items-center gap-1"
                        title="Disable proxy (keeps data)"
                      >
                        <span>⏸️</span>
                        <span className="hidden sm:inline">Disable</span>
                      </button>
                    )}

                    <button
                      onClick={() => deleteProxy(proxy.port)}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-red-700 flex items-center gap-1"
                      title="Delete proxy and all associated data"
                    >
                      <span>🗑️</span>
                      <span className="hidden sm:inline">Delete</span>
                    </button>

                    {!proxy.disabled && (
                      <button
                        onClick={() => onStopProxy(proxy.port)}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-gray-700"
                        title="Stop proxy temporarily"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {proxies.length === 0 && (
            <div className="text-center py-6 sm:py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">
                No projects configured
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Add Your First Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        actions={notification.actions}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        type={confirmation.type}
      />
    </div>
  );
}

export default ProxiesView;
