import { useState, useEffect } from "react";
import {
  MdAdd,
  MdList,
  MdSettings,
  MdBarChart,
  MdRefresh,
  MdDelete,
  MdEdit,
  MdSave,
  MdCancel,
  MdCheckCircle,
  MdError,
  MdWarning,
  MdTimer,
  MdPlayArrow,
  MdStop,
  MdWifi,
  MdExpandMore,
  MdChevronRight,
  MdNotifications,
  MdFileUpload,
  MdFileDownload,
} from "react-icons/md";
import StatCard from "../common/StatCard";
import Toast from "../common/Toast";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { formatContent, isBinaryContent } from "../../utils/helpers";
import OutgoingMocksView from "./OutgoingMocksView";
import { createPortBlurHandler } from "../../utils/portHandlers";

function OutgoingRequestView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [proxies, setProxies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [outgoingMocks, setOutgoingMocks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    proxy: null,
  });
  const [clearModal, setClearModal] = useState({
    isOpen: false,
    proxyPort: null,
    proxyName: null,
  });

  // Import/Export state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Proxy management state
  const [showAddProxy, setShowAddProxy] = useState(false);
  const [editingProxy, setEditingProxy] = useState(null);
  const [newProxy, setNewProxy] = useState({
    port: "",
    targetUrl: "",
    name: "",
  });
  const [portWarning, setPortWarning] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load proxies
      console.log("🔄 Loading outgoing proxies...");
      const proxiesResult = await window.electronAPI.getOutgoingProxies();
      console.log("📡 Outgoing proxies result:", proxiesResult);

      if (proxiesResult.success) {
        setProxies(proxiesResult.proxies);
        console.log(
          `✅ Successfully loaded ${proxiesResult.proxies.length} proxies`
        );
      } else {
        console.error("❌ Failed to load proxies:", proxiesResult.error);
        showToast(
          `Failed to load proxies: ${proxiesResult.error || "Unknown error"}`,
          "error"
        );
      }

      // Load requests
      const requestsResult = await window.electronAPI.getOutgoingRequests();
      if (requestsResult.success) {
        setRequests(requestsResult.requests);
      } else {
        console.error("❌ Failed to load requests:", requestsResult.error);
        showToast(
          `Failed to load requests: ${requestsResult.error || "Unknown error"}`,
          "error"
        );
      }

      // Load outgoing mocks
      const mocksResult = await window.electronAPI.getOutgoingMocks();
      if (mocksResult.success) {
        setOutgoingMocks(mocksResult.mocks);
      } else {
        console.error("❌ Failed to load mocks:", mocksResult.error);
        showToast(
          `Failed to load mocks: ${mocksResult.error || "Unknown error"}`,
          "error"
        );
      }

      // Load stats
      const statsResult = await window.electronAPI.getOutgoingStats();
      if (statsResult.success) {
        setStats(statsResult.stats);
      } else {
        console.error("❌ Failed to load stats:", statsResult.error);
        showToast(
          `Failed to load stats: ${statsResult.error || "Unknown error"}`,
          "error"
        );
      }
    } catch (error) {
      console.error("❌ Exception loading data:", error);
      showToast(`Failed to load data: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateProxy = async () => {
    try {
      if (!newProxy.port || !newProxy.targetUrl || !newProxy.name) {
        showToast("Port, Target URL, and Name are required", "error");
        return;
      }

      // Validate port number
      const port = parseInt(newProxy.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        showToast("Port must be a number between 1 and 65535", "error");
        return;
      }

      // Check if port is already in use
      if (proxies.some((p) => p.port === port)) {
        showToast(`Port ${port} is already in use`, "error");
        return;
      }

      // Validate URL format
      try {
        new URL(newProxy.targetUrl);
      } catch {
        showToast(
          "Please enter a valid URL (e.g., https://jsonplaceholder.typicode.com)",
          "error"
        );
        return;
      }

      // Test connection first
      const connectionTest = await window.electronAPI.testProxyConnection(
        newProxy.targetUrl
      );
      if (!connectionTest.success || !connectionTest.result.success) {
        const proceed = confirm(
          `Warning: Could not connect to ${
            newProxy.targetUrl
          }. Create proxy anyway?\n\nError: ${
            connectionTest.result?.error || "Connection failed"
          }`
        );
        if (!proceed) return;
      }

      const result = await window.electronAPI.createOutgoingProxy({
        port: port,
        targetUrl: newProxy.targetUrl,
        name: newProxy.name,
      });

      if (result.success) {
        setNewProxy({ port: "", targetUrl: "", name: "" });
        setShowAddProxy(false);
        setPortWarning(null);
        showToast("Proxy created successfully!", "success");
        // Automatically refresh the data to show the new proxy
        await loadData();
      } else {
        showToast(result.error, "error");
      }
    } catch (error) {
      showToast("Failed to create proxy", "error");
    }
  };

  const handleStartProxy = async (proxy) => {
    try {
      // Optimistic update - immediately update UI
      setProxies((prev) =>
        prev.map((p) => (p.port === proxy.port ? { ...p, isRunning: true } : p))
      );

      await window.electronAPI.startOutgoingProxy(proxy.port);
    } catch (error) {
      console.error("Start proxy exception:", error);
      // Revert optimistic update on error
      setProxies((prev) =>
        prev.map((p) =>
          p.port === proxy.port ? { ...p, isRunning: false } : p
        )
      );
      showToast("Failed to start proxy: " + error.message, "error");
    }
  };

  const handleStopProxy = async (proxy) => {
    try {
      // Optimistic update - immediately update UI
      setProxies((prev) =>
        prev.map((p) =>
          p.port === proxy.port ? { ...p, isRunning: false } : p
        )
      );

      await window.electronAPI.stopOutgoingProxy(proxy.port);
    } catch (error) {
      console.error("Stop proxy exception:", error);
      // Revert optimistic update on error
      setProxies((prev) =>
        prev.map((p) => (p.port === proxy.port ? { ...p, isRunning: true } : p))
      );
      showToast("Failed to stop proxy: " + error.message, "error");
    }
  };

  const handleUpdateProxy = async (port, updates) => {
    try {
      const result = await window.electronAPI.updateOutgoingProxy(
        port,
        updates
      );
      if (result.success) {
        setEditingProxy(null);
      } else {
        showToast(result.error, "error");
      }
    } catch (error) {
      showToast("Failed to update proxy: " + error.message, "error");
    }
  };

  const handleRemoveProxy = async (port) => {
    const proxy = proxies.find((p) => p.port === port);
    if (!proxy) return;

    setDeleteModal({ isOpen: true, proxy });
  };

  const handleConfirmProxyDelete = async () => {
    const proxy = deleteModal.proxy;
    if (!proxy) return;

    try {
      // Stop the proxy first if it's running
      if (proxy.isRunning) {
        await handleStopProxy(proxy);
      }

      const result = await window.electronAPI.removeOutgoingProxy(proxy.port);
      if (result.success) {
        showToast(
          `Outgoing proxy "${proxy.name}" removed successfully`,
          "success"
        );

        // Close modal
        setDeleteModal({ isOpen: false, proxy: null });

        // Automatically refresh the data to show updated proxy list
        await loadData();
      } else {
        showToast(result.error, "error");
      }
    } catch (error) {
      showToast("Failed to remove proxy: " + error.message, "error");
      // Keep modal open on error
    }
  };

  const handleClearRequests = async (proxyPort = null) => {
    const proxy = proxyPort ? proxies.find((p) => p.port === proxyPort) : null;
    setClearModal({
      isOpen: true,
      proxyPort,
      proxyName: proxy ? proxy.name : null,
    });
  };

  const handleConfirmClearRequests = async () => {
    const { proxyPort } = clearModal;

    try {
      const result = await window.electronAPI.clearOutgoingRequests(proxyPort);
      if (result.success) {
        if (proxyPort) {
          setRequests(requests.filter((r) => r.proxyPort !== proxyPort));
        } else {
          setRequests([]);
        }
        showToast("Requests cleared successfully", "success");

        // Close modal
        setClearModal({ isOpen: false, proxyPort: null, proxyName: null });
      } else {
        showToast(result.error, "error");
        // Keep modal open on error
      }
    } catch (error) {
      showToast("Failed to clear requests", "error");
      // Keep modal open on error
    }
  };

  const handleExportOutgoingConfig = async () => {
    setIsExporting(true);
    try {
      const result = await window.electronAPI.exportOutgoingProxyConfig();
      if (result.success) {
        showToast(`Configuration exported to: ${result.filePath}`, "success");
      } else {
        showToast(result.error || "Export failed", "error");
      }
    } catch (error) {
      showToast("Failed to export configuration", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportOutgoingConfig = async () => {
    setIsImporting(true);
    try {
      const result = await window.electronAPI.importOutgoingProxyConfig();
      if (result.success) {
        loadData(); // Refresh data
        showToast("Configuration imported successfully", "success");
      } else if (!result.cancelled) {
        showToast(result.error || "Import failed", "error");
      }
    } catch (error) {
      showToast("Failed to import configuration", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const getProxyRequests = (port) => {
    return requests.filter((r) => r.proxyPort === port);
  };

  useEffect(() => {
    loadData();

    // Set up real-time event listeners
    if (window.electronAPI) {
      window.electronAPI.onOutgoingRequest((request) => {
        setRequests((prev) => [request, ...prev]);
      });

      window.electronAPI.onOutgoingResponse((request) => {
        setRequests((prev) =>
          prev.map((r) => (r.id === request.id ? request : r))
        );
      });

      window.electronAPI.onOutgoingError((request) => {
        setRequests((prev) =>
          prev.map((r) => (r.id === request.id ? request : r))
        );
      });

      // Listen for proxy lifecycle events
      window.electronAPI.onOutgoingProxyCreated?.((proxy) => {
        console.log("Event: proxy created", proxy);
        setProxies((prev) => [...prev, proxy]);
        showToast(`Proxy "${proxy.name}" created successfully`, "success");
      });

      window.electronAPI.onOutgoingProxyStarted?.((proxy) => {
        console.log("Event: proxy started", proxy);
        setProxies((prev) =>
          prev.map((p) => (p.port === proxy.port ? proxy : p))
        );
        showToast(
          `Proxy "${proxy.name}" started on port ${proxy.port}`,
          "success"
        );
      });

      window.electronAPI.onOutgoingProxyStopped?.((proxy) => {
        console.log("Event: proxy stopped", proxy);
        setProxies((prev) =>
          prev.map((p) => (p.port === proxy.port ? proxy : p))
        );
        showToast(`Proxy "${proxy.name}" stopped`, "info");
      });

      window.electronAPI.onOutgoingProxyUpdated?.((proxy) => {
        setProxies((prev) =>
          prev.map((p) => (p.port === proxy.port ? proxy : p))
        );
        showToast(`Proxy "${proxy.name}" updated successfully`, "success");
      });

      window.electronAPI.onOutgoingProxyRemoved?.((data) => {
        setProxies((prev) => prev.filter((p) => p.port !== data.port));
        showToast(`Proxy "${data.name}" removed successfully`, "success");
      });

      window.electronAPI.onOutgoingProxyError?.((data) => {
        loadData();
        showToast(`Proxy error on port ${data.port}: ${data.error}`, "error");
      });

      // Listen for outgoing mock events
      if (window.electronAPI.onOutgoingMockAdded) {
        console.log("🔥 UI: Setting up onOutgoingMockAdded listener");
        window.electronAPI.onOutgoingMockAdded((mock) => {
          console.log("🔥 UI: Event received - outgoing mock added", mock);
          setOutgoingMocks((prev) => {
            console.log(
              "🔥 UI: Updating outgoingMocks state, previous count:",
              prev.length
            );
            const newMocks = [...prev, mock];
            console.log("🔥 UI: New outgoingMocks count:", newMocks.length);
            return newMocks;
          });
        });
      } else {
        console.log(
          "❌ UI: window.electronAPI.onOutgoingMockAdded not available"
        );
      }

      if (window.electronAPI.onOutgoingMockAutoCreated) {
        window.electronAPI.onOutgoingMockAutoCreated((data) => {
          console.log("Event: outgoing mock auto-created", data);
          setOutgoingMocks((prev) => [...prev, data.mock]);
          showToast(
            `Auto-created mock for ${data.request.method} ${data.request.url}`,
            "info"
          );
        });
      }

      if (window.electronAPI.onOutgoingMockUpdated) {
        window.electronAPI.onOutgoingMockUpdated((mock) => {
          console.log("Event: outgoing mock updated", mock);
          setOutgoingMocks((prev) =>
            prev.map((m) => (m.id === mock.id ? mock : m))
          );
        });
      }

      if (window.electronAPI.onOutgoingMockRemoved) {
        window.electronAPI.onOutgoingMockRemoved((data) => {
          console.log("Event: outgoing mock removed", data);
          setOutgoingMocks((prev) =>
            prev.filter(
              (m) =>
                !(
                  m.proxyPort === data.proxyPort &&
                  m.method === data.method &&
                  m.url === data.url
                )
            )
          );
        });
      }

      if (window.electronAPI.onOutgoingMockToggled) {
        window.electronAPI.onOutgoingMockToggled((mock) => {
          console.log("Event: outgoing mock toggled", mock);
          setOutgoingMocks((prev) =>
            prev.map((m) => (m.id === mock.id ? mock : m))
          );
        });
      }
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Outgoing Proxy
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Configure proxy servers to intercept and redirect outgoing
              requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Warning badge when no proxies are active */}
            {stats.totalProxies > 0 && stats.runningProxies === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg">
                <MdWarning className="w-4 h-4" />
                <span className="text-sm font-medium">No active proxies</span>
              </div>
            )}

            {/* Import/Export buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleImportOutgoingConfig}
                disabled={isImporting}
                className="flex items-center gap-1 px-2 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                title="Import Configuration & Mocks"
              >
                <MdFileUpload className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Import</span>
              </button>
              <button
                onClick={handleExportOutgoingConfig}
                disabled={isExporting}
                className="flex items-center gap-1 px-2 py-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                title="Export Configuration & Mocks"
              >
                <MdFileDownload className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Export</span>
              </button>
            </div>

            <button
              onClick={loadData}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <MdRefresh />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Requests"
          value={stats.totalRequests || 0}
          icon={<MdList />}
          color="blue"
        />
        <StatCard
          title="Successful"
          value={stats.successfulRequests || 0}
          icon={<MdCheckCircle />}
          color="green"
        />
        <StatCard
          title="Failed"
          value={stats.failedRequests || 0}
          icon={<MdError />}
          color="red"
        />
        <StatCard
          title="Active Proxies"
          value={`${stats.runningProxies || 0}/${stats.totalProxies || 0}`}
          icon={<MdWifi />}
          color={stats.runningProxies > 0 ? "green" : "gray"}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto" aria-label="Tabs">
            {[
              { id: "overview", label: "Overview", icon: <MdBarChart /> },
              {
                id: "proxies",
                label: "Proxies",
                icon: <MdSettings />,
                count: proxies.length,
              },
              {
                id: "requests",
                label: "Requests",
                icon: <MdList />,
                count: requests.length,
              },
              {
                id: "mocks",
                label: "Mocks",
                icon: <MdCheckCircle />,
                count: outgoingMocks.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 flex-shrink-0 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-sm sm:text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 py-0.5 px-1.5 sm:px-2 rounded-full text-xs ${
                      activeTab === tab.id
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <ProxyOverview
              proxies={proxies}
              requests={requests}
              stats={stats}
              getProxyRequests={getProxyRequests}
            />
          )}
          {activeTab === "proxies" && (
            <ProxiesTab
              proxies={proxies}
              showAddProxy={showAddProxy}
              setShowAddProxy={setShowAddProxy}
              newProxy={newProxy}
              setNewProxy={setNewProxy}
              editingProxy={editingProxy}
              setEditingProxy={setEditingProxy}
              portWarning={portWarning}
              setPortWarning={setPortWarning}
              onCreateProxy={handleCreateProxy}
              onStartProxy={handleStartProxy}
              onStopProxy={handleStopProxy}
              onUpdateProxy={handleUpdateProxy}
              onRemoveProxy={handleRemoveProxy}
              getProxyRequests={getProxyRequests}
              onClearRequests={handleClearRequests}
            />
          )}
          {activeTab === "requests" && (
            <RequestsTab
              requests={requests}
              proxies={proxies}
              onClearRequests={handleClearRequests}
            />
          )}
          {activeTab === "mocks" && (
            <OutgoingMocksView
              mocks={outgoingMocks}
              proxies={proxies}
              onRefreshMocks={loadData}
            />
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, proxy: null })}
        onConfirm={handleConfirmProxyDelete}
        title="Remove Outgoing Proxy"
        itemName={deleteModal.proxy?.name}
        itemType="outgoing-proxy"
        description={
          deleteModal.proxy
            ? `Port ${deleteModal.proxy.port} → ${deleteModal.proxy.targetUrl}`
            : ""
        }
      />

      {/* Clear Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={clearModal.isOpen}
        onClose={() =>
          setClearModal({ isOpen: false, proxyPort: null, proxyName: null })
        }
        onConfirm={handleConfirmClearRequests}
        title="Clear Requests"
        itemName={
          clearModal.proxyPort
            ? `${
                clearModal.proxyName || `Port ${clearModal.proxyPort}`
              } requests`
            : "All outgoing requests"
        }
        itemType="data"
        action="clear"
        consequences={[
          clearModal.proxyPort
            ? "All request history for this proxy will be cleared"
            : "All outgoing request history will be cleared",
          "This data cannot be recovered",
          "Active mocks and configurations will not be affected",
        ]}
      />
    </div>
  );
}

// Overview Tab Component
function ProxyOverview({ proxies, requests, stats, getProxyRequests }) {
  const recentRequests = requests.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Proxy Status
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Man-in-the-middle proxies for intercepting outgoing requests
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              stats.runningProxies > 0
                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                stats.runningProxies > 0 ? "bg-green-400" : "bg-red-400"
              }`}
            ></div>
            <span className="text-sm font-medium">
              {stats.runningProxies > 0
                ? `${stats.runningProxies} of ${stats.totalProxies || 0} active`
                : `${
                    stats.totalProxies || 0
                  } proxies configured - none running`}
            </span>
            {stats.runningProxies === 0 && stats.totalProxies > 0 && (
              <MdNotifications className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Proxy Summary */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Configured Proxies
        </h3>
        {proxies.length === 0 ? (
          <div className="text-center py-8">
            <MdSettings className="mx-auto h-12 w-12 mb-4 opacity-50 text-gray-500 dark:text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No proxies configured
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Create proxies to start intercepting outgoing requests
            </p>
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-2xl mx-auto text-left">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Getting Started:
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>1. Go to the "Proxies" tab and click "Add Proxy"</li>
                <li>
                  2. Configure port 4444 to redirect to
                  jsonplaceholder.typicode.com
                </li>
                <li>
                  3. Start the proxy and configure your app to use
                  localhost:4444
                </li>
                <li>
                  4. All requests will be intercepted and redirected
                  automatically
                </li>
              </ol>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                💡 Configure your application to use the proxy as HTTP/HTTPS
                proxy
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {proxies.map((proxy) => {
              const proxyRequests = getProxyRequests(proxy.port);
              const successCount = proxyRequests.filter(
                (r) => r.status === "success"
              ).length;
              const failCount = proxyRequests.filter(
                (r) => r.status === "failed"
              ).length;
              const mockedCount = proxyRequests.filter(
                (r) => r.status === "mocked"
              ).length;

              return (
                <div
                  key={proxy.port}
                  className="bg-white dark:bg-gray-800 border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {proxy.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        Port {proxy.port} → {proxy.targetUrl}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          proxy.isRunning
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            proxy.isRunning ? "bg-green-400" : "bg-gray-400"
                          }`}
                        ></div>
                        {proxy.isRunning ? "Running" : "Stopped"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {proxyRequests.length} requests
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      {successCount} success
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {mockedCount} mocked
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {failCount} failed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Requests */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Recent Requests
        </h3>
        {recentRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No outgoing requests intercepted yet</p>
            <p className="text-sm">
              Configure proxies and route traffic through them to see requests
              here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      request.status === "success"
                        ? "bg-green-400"
                        : request.status === "failed"
                        ? "bg-red-400"
                        : request.status === "mocked"
                        ? "bg-blue-400"
                        : "bg-yellow-400"
                    }`}
                  ></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {request.method}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
                        {request.url}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>via port {request.proxyPort}</span>
                      {request.duration && <span>• {request.duration}ms</span>}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                  {new Date(request.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Proxies Tab Component
function ProxiesTab({
  proxies,
  showAddProxy,
  setShowAddProxy,
  newProxy,
  setNewProxy,
  editingProxy,
  setEditingProxy,
  portWarning,
  setPortWarning,
  onCreateProxy,
  onStartProxy,
  onStopProxy,
  onUpdateProxy,
  onRemoveProxy,
  getProxyRequests,
  onClearRequests,
}) {
  const handlePortBlur = createPortBlurHandler(newProxy.port, setPortWarning);

  return (
    <div className="space-y-4">
      {/* Add Proxy Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Proxy Servers
        </h3>
        <button
          onClick={() => setShowAddProxy(!showAddProxy)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <MdAdd />
          Add Proxy
        </button>
      </div>

      {/* Add Proxy Form */}
      {showAddProxy && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            Add New Proxy
          </h4>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proxy Port *
              </label>
              <input
                type="number"
                value={newProxy.port}
                onChange={(e) => {
                  setNewProxy({ ...newProxy, port: e.target.value });
                  setPortWarning(null); // Clear warning when user starts typing
                }}
                onBlur={handlePortBlur}
                placeholder="4444"
                min="1"
                max="65535"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              />
              {portWarning && (
                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                  <MdWarning className="text-sm" />
                  {portWarning}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target URL *
              </label>
              <input
                type="url"
                value={newProxy.targetUrl}
                onChange={(e) =>
                  setNewProxy({ ...newProxy, targetUrl: e.target.value })
                }
                placeholder="https://jsonplaceholder.typicode.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newProxy.name}
                onChange={(e) =>
                  setNewProxy({ ...newProxy, name: e.target.value })
                }
                placeholder="JSONPlaceholder Proxy"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowAddProxy(false);
                setPortWarning(null);
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={onCreateProxy}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <MdSave />
              Create Proxy
            </button>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Usage:</strong> Configure your application to use{" "}
              <code>localhost:{newProxy.port || "PORT"}</code> as HTTP/HTTPS
              proxy. All requests will be intercepted and redirected to the
              target URL.
            </p>
          </div>
        </div>
      )}

      {/* Proxies List */}
      <div className="space-y-4">
        {proxies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdSettings className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No proxy servers configured</p>
            <p className="text-sm">
              Create your first proxy to start intercepting outgoing requests
            </p>
          </div>
        ) : (
          proxies.map((proxy) => (
            <ProxyCard
              key={proxy.port}
              proxy={proxy}
              editingProxy={editingProxy}
              setEditingProxy={setEditingProxy}
              onStartProxy={onStartProxy}
              onStopProxy={onStopProxy}
              onUpdateProxy={onUpdateProxy}
              onRemoveProxy={onRemoveProxy}
              getProxyRequests={getProxyRequests}
              onClearRequests={onClearRequests}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Proxy Card Component
function ProxyCard({
  proxy,
  editingProxy,
  setEditingProxy,
  onStartProxy,
  onStopProxy,
  onUpdateProxy,
  onRemoveProxy,
  getProxyRequests,
  onClearRequests,
}) {
  const [editForm, setEditForm] = useState(proxy);
  const proxyRequests = getProxyRequests(proxy.port);
  const isEditing = editingProxy === proxy.port;

  // Sync editForm with proxy prop changes
  useEffect(() => {
    setEditForm(proxy);
  }, [proxy]);

  const handleSave = () => {
    onUpdateProxy(proxy.port, editForm);
  };

  const handleCancel = () => {
    setEditForm(proxy);
    setEditingProxy(null);
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Edit Proxy
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target URL
            </label>
            <input
              type="url"
              value={editForm.targetUrl}
              onChange={(e) =>
                setEditForm({ ...editForm, targetUrl: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Port (read-only)
            </label>
            <input
              type="number"
              value={proxy.port}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <MdCancel />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <MdSave />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {proxy.name}
            </h4>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                proxy.isRunning
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  proxy.isRunning ? "bg-green-400" : "bg-gray-400"
                }`}
              ></div>
              {proxy.isRunning ? "Running" : "Stopped"}
            </div>
          </div>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              <strong>Proxy:</strong> localhost:{proxy.port}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              <strong>Target:</strong> {proxy.targetUrl}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {proxyRequests.length} requests
            </span>
            <span className="text-green-600 dark:text-green-400">
              {proxyRequests.filter((r) => r.status === "success").length}{" "}
              success
            </span>
            <span className="text-red-600 dark:text-red-400">
              {proxyRequests.filter((r) => r.status === "failed").length} failed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4">
          {proxy.isRunning ? (
            <button
              onClick={() => {
                console.log("Stop button clicked for proxy:", proxy.port);
                onStopProxy(proxy);
              }}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
              title="Stop proxy"
            >
              <MdStop className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                console.log("Start button clicked for proxy:", proxy.port);
                onStartProxy(proxy);
              }}
              className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors animate-pulse"
              title="Start proxy (Click to activate)"
            >
              <MdPlayArrow className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => {
              console.log("Edit button clicked for proxy:", proxy.port);
              console.log("Proxy is running:", proxy.isRunning);
              if (!proxy.isRunning) {
                setEditingProxy(proxy.port);
                setEditForm(proxy);
                console.log("Edit mode activated for proxy:", proxy.port);
              } else {
                console.log("Cannot edit running proxy");
              }
            }}
            className={`p-2 transition-colors ${
              proxy.isRunning
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
            title={proxy.isRunning ? "Stop proxy to edit" : "Edit proxy"}
            disabled={proxy.isRunning}
          >
            <MdEdit />
          </button>
          <button
            onClick={() => onClearRequests(proxy.port)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear requests"
          >
            <MdRefresh />
          </button>
          <button
            onClick={() => onRemoveProxy(proxy.port)}
            className="p-2 text-red-400 hover:text-red-600"
            title="Remove proxy"
          >
            <MdDelete />
          </button>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Configure your app:</strong> Set HTTP/HTTPS proxy to{" "}
          <code>localhost:{proxy.port}</code>
        </p>
      </div>
    </div>
  );
}

// Requests Tab Component
function RequestsTab({ requests, proxies, onClearRequests }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedProxy, setSelectedProxy] = useState("all");

  const filteredRequests = requests.filter((request) => {
    if (selectedStatus !== "all" && request.status !== selectedStatus) {
      return false;
    }

    if (selectedProxy !== "all") {
      const proxyPort = parseInt(selectedProxy);
      if (request.proxyPort !== proxyPort) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Proxy Filter Tabs */}
      {proxies && proxies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav
              className="flex overflow-x-auto"
              role="tablist"
              aria-label="Proxy Filter Tabs"
            >
              <button
                role="tab"
                aria-selected={selectedProxy === "all"}
                onClick={() => setSelectedProxy("all")}
                className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 flex-shrink-0 ${
                  selectedProxy === "all"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-base">🌐</span>
                <span>All Proxies</span>
                <span
                  className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
                    selectedProxy === "all"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {requests.length}
                </span>
              </button>
              {proxies.map((proxy) => {
                const proxyRequests = requests.filter(
                  (request) => request.proxyPort === proxy.port
                );

                return (
                  <button
                    key={proxy.port}
                    role="tab"
                    aria-selected={selectedProxy === proxy.port.toString()}
                    onClick={() => setSelectedProxy(proxy.port.toString())}
                    className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 flex-shrink-0 ${
                      selectedProxy === proxy.port.toString()
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <span className="text-base">🔗</span>
                    <span className="truncate max-w-32">{proxy.name}</span>
                    <span className="text-xs text-gray-500">:{proxy.port}</span>
                    <span
                      className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
                        selectedProxy === proxy.port.toString()
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {proxyRequests.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="mocked">Mocked</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            // Pass the selected proxy port when clearing, or null for all
            const proxyPortToClear =
              selectedProxy === "all" ? null : parseInt(selectedProxy);
            onClearRequests(proxyPortToClear);
          }}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          <MdDelete />
          {selectedProxy === "all" ? "Clear All" : "Clear Selected"}
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-2">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No requests match the current filters</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <RequestItem key={request.id} request={request} proxies={proxies} />
          ))
        )}
      </div>
    </div>
  );
}

// Request Item Component
function RequestItem({ request, proxies }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <MdCheckCircle className="text-green-500" />;
      case "failed":
        return <MdError className="text-red-500" />;
      case "pending":
        return <MdTimer className="text-yellow-500" />;
      case "mocked":
        return <MdCheckCircle className="text-blue-500" />;
      default:
        return <MdWarning className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800";
      case "failed":
        return "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800";
      case "pending":
        return "bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800";
      case "mocked":
        return "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600";
    }
  };

  const proxy = proxies.find((p) => p.port === request.proxyPort);

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(request.status)}`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {getStatusIcon(request.status)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {request.method}
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
                {request.url}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>via {proxy?.name || `port ${request.proxyPort}`}</span>
              {request.duration && <span>• {request.duration}ms</span>}
              <span>• {new Date(request.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {request.response && (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                request.response.statusCode >= 200 &&
                request.response.statusCode < 300
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
              }`}
            >
              {request.response.statusCode}
            </span>
          )}
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors">
            {isExpanded ? (
              <MdExpandMore className="w-5 h-5" />
            ) : (
              <MdChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Request Details */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Request
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Original URL:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {request.url}
                  </span>
                </div>
                {request.fullTargetUrl && (
                  <div>
                    <span className="font-medium">Target URL:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {request.fullTargetUrl}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Method:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {request.method}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Proxy:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {proxy?.name || `Port ${request.proxyPort}`}
                  </span>
                </div>
                {request.headers && Object.keys(request.headers).length > 0 && (
                  <div>
                    <span className="font-medium">Headers:</span>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                      {JSON.stringify(request.headers, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Response Details */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Response
              </h4>
              {request.response ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {request.response.statusCode}{" "}
                      {request.response.statusMessage}
                    </span>
                  </div>
                  {request.duration && (
                    <div>
                      <span className="font-medium">Duration:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {request.duration}ms
                      </span>
                    </div>
                  )}
                  {request.response.headers && (
                    <div>
                      <span className="font-medium">Headers:</span>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {JSON.stringify(request.response.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                  {request.response.body && (
                    <div>
                      <span className="font-medium">Body:</span>
                      <ResponseBody
                        body={request.response.body}
                        contentType={request.response.headers?.["content-type"]}
                      />
                    </div>
                  )}
                </div>
              ) : request.error ? (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  <span className="font-medium">Error:</span>
                  <span className="ml-2">{request.error}</span>
                </div>
              ) : (
                <div className="text-yellow-600 dark:text-yellow-400 text-sm">
                  Pending response...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Response Body Component
function ResponseBody({ body, contentType }) {
  const formatBody = () => {
    if (!body) return "No content";

    // Use the improved content formatter
    return formatContent(body, contentType);
  };

  const formattedBody = formatBody();
  const isJson =
    contentType &&
    contentType.includes("application/json") &&
    !isBinaryContent(formattedBody);
  const isBinary = isBinaryContent(formattedBody);

  return (
    <div className="mt-1">
      {isBinary ? (
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-yellow-600 dark:text-yellow-400 italic">
          {formattedBody}
        </div>
      ) : (
        <pre
          className={`p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto max-h-32 ${
            isJson ? "language-json" : ""
          }`}
        >
          {formattedBody}
        </pre>
      )}
      {contentType && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Content-Type: {contentType}
        </div>
      )}
    </div>
  );
}

export default OutgoingRequestView;
