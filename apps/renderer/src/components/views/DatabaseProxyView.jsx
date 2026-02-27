import { useState, useEffect } from "react";
import {
  MdAdd,
  MdList,
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
  MdStorage,
  MdFileUpload,
  MdFileDownload,
} from "react-icons/md";
import StatCard from "../common/StatCard";
import Toast from "../common/Toast";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import DatabaseMocksView from "./DatabaseMocksView";
import { createPortBlurHandler } from "../../utils/portHandlers";
import {
  parseDatabaseUrl,
  isValidDatabaseUrl,
  generateProxyConnectionString,
} from "../../utils/databaseUrlParser";
import {
  PremiumFeatureBlock,
  usePremiumFeature,
} from "../../hooks/usePremiumFeature.jsx";

const DatabaseProxyView = ({
  databaseMocks: propDatabaseMocks,
  onRefreshDatabaseMocks,
  proxyNotifications = new Map(),
  onClearNotifications = () => {},
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [proxies, setProxies] = useState([]);
  const [queries, setQueries] = useState([]);
  // Use props for database mocks instead of local state
  const databaseMocks = propDatabaseMocks || [];
  const [stats, setStats] = useState({
    totalProxies: 0,
    runningProxies: 0,
    totalConnections: 0,
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [testingMode, setTestingMode] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    proxy: null,
  });
  const [clearModal, setClearModal] = useState({
    isOpen: false,
    proxyPort: null,
    proxyName: null,
  });

  // Proxy management state
  const [showAddProxy, setShowAddProxy] = useState(false);
  const [editingProxy, setEditingProxy] = useState(null);
  const [newProxy, setNewProxy] = useState({
    port: "",
    targetHost: "",
    targetPort: "",
    protocol: "postgresql",
    name: "",
  });

  // Connection string mode state
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [connectionString, setConnectionString] = useState("");
  const [connectionStringError, setConnectionStringError] = useState("");
  const [parsedConnectionDetails, setParsedConnectionDetails] = useState(null);

  const [toast, setToast] = useState(null);

  // Import/Export state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Check premium access for mocks feature
  const { canUseFeature: canUseMocks } = usePremiumFeature("mock-management");

  const loadData = async () => {
    try {
      setLoading(true);

      // Load proxies
      const proxiesData = await window.electronAPI.getDatabaseProxies();
      const safeProxies = Array.isArray(proxiesData) ? proxiesData : [];
      setProxies(safeProxies);

      // Load queries/requests
      const queriesResult = await window.electronAPI.getDatabaseQueries();
      let safeQueries = [];
      if (queriesResult?.success && Array.isArray(queriesResult.queries)) {
        safeQueries = queriesResult.queries;
      } else if (Array.isArray(queriesResult)) {
        safeQueries = queriesResult;
      }
      setQueries(safeQueries);

      // Database mocks are now loaded from props, so we don't load them here

      // Calculate stats
      const statsData = await window.electronAPI.getDatabaseProxyStats();

      const calculatedStats = {
        totalProxies: safeProxies.length,
        runningProxies: safeProxies.filter((p) => p.isRunning).length,
        totalConnections: statsData?.totalConnections || 0,
        totalQueries: safeQueries.length,
        successfulQueries: safeQueries.filter((q) => q.status === "success")
          .length,
        failedQueries: safeQueries.filter((q) => q.status === "failed").length,
      };
      setStats(calculatedStats);

      // Check testing mode status
      try {
        const settings = await window.electronAPI.getSettings?.();
        setTestingMode(settings?.testingMode || false);
      } catch (error) {
        // Settings API might not be available, ignore
      }
    } catch (error) {
      // console.error("Failed to load database proxy data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper function to update stats based on current proxy state
  const updateStatsFromProxies = (currentProxies) => {
    const safeProxies = Array.isArray(currentProxies) ? currentProxies : [];
    setStats((prevStats) => ({
      ...prevStats,
      totalProxies: safeProxies.length,
      runningProxies: safeProxies.filter((p) => p.isRunning).length,
    }));
  };

  // Connection string handlers
  const handleConnectionStringChange = (value) => {
    setConnectionString(value);
    setConnectionStringError("");
    setParsedConnectionDetails(null);

    if (!value.trim()) {
      return;
    }

    if (!isValidDatabaseUrl(value)) {
      setConnectionStringError("Invalid database URL format");
      return;
    }

    const parsed = parseDatabaseUrl(value);
    if (!parsed) {
      setConnectionStringError("Unable to parse database URL");
      return;
    }

    setParsedConnectionDetails(parsed);

    // Auto-populate the form fields
    setNewProxy({
      port: parsed.suggestedProxyPort.toString(),
      targetHost: parsed.targetHost,
      targetPort: parsed.targetPort.toString(),
      protocol: parsed.protocol,
      name: parsed.name,
    });
  };

  const toggleConnectionStringMode = () => {
    if (useConnectionString) {
      // Switching to manual mode - clear connection string state
      setConnectionString("");
      setConnectionStringError("");
      setParsedConnectionDetails(null);
    } else {
      // Switching to connection string mode - clear manual form
      setNewProxy({
        port: "",
        targetHost: "",
        targetPort: "",
        protocol: "postgresql",
        name: "",
      });
    }
    setUseConnectionString(!useConnectionString);
  };

  const handleCreateProxy = async () => {
    try {
      // Validation for connection string mode
      if (useConnectionString) {
        if (!connectionString.trim()) {
          showToast("Connection string is required", "error");
          return;
        }
        if (connectionStringError) {
          showToast("Please fix the connection string error", "error");
          return;
        }
        if (!parsedConnectionDetails) {
          showToast("Unable to parse connection string", "error");
          return;
        }
      } else {
        // Validation for manual mode
        if (
          !newProxy.port ||
          !newProxy.targetHost ||
          !newProxy.targetPort ||
          !newProxy.name
        ) {
          showToast("All fields are required", "error");
          return;
        }
      }

      // Validate port number
      const port = parseInt(newProxy.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        showToast("Port must be a number between 1 and 65535", "error");
        return;
      }

      // Check if port is already in use
      const safeProxies = Array.isArray(proxies) ? proxies : [];
      if (safeProxies.some((p) => p.port === port)) {
        showToast(`Port ${port} is already in use`, "error");
        return;
      }

      const config = {
        port: port,
        targetHost: newProxy.targetHost,
        targetPort: parseInt(newProxy.targetPort),
        protocol: newProxy.protocol,
        name: newProxy.name,
      };

      await window.electronAPI.createDatabaseProxy(config);

      // Reset form state
      setNewProxy({
        port: "",
        targetHost: "",
        targetPort: "",
        protocol: "postgresql",
        name: "",
      });
      setConnectionString("");
      setConnectionStringError("");
      setParsedConnectionDetails(null);
      setUseConnectionString(false);
      setShowAddProxy(false);
      showToast("Database proxy created successfully!", "success");
      // Automatically refresh the data to show the new proxy
      await loadData();
    } catch (error) {
      // console.error("Failed to create database proxy:", error);
      showToast("Failed to create database proxy: " + error.message, "error");
    }
  };

  const handleStartProxy = async (proxy) => {
    try {
      // Immediately update UI to show loading state
      setProxies((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
              p.port === proxy.port ? { ...p, isStarting: true } : p
            )
          : []
      );

      const result = await window.electronAPI.startDatabaseProxy(proxy.port);

      if (result?.success) {
        // Update UI immediately with the returned proxy data
        const updatedProxies = Array.isArray(proxies)
          ? proxies.map((p) =>
              p.port === proxy.port ? { ...result.proxy, isStarting: false } : p
            )
          : [];

        setProxies(updatedProxies);
        updateStatsFromProxies(updatedProxies);

        showToast(
          `Database proxy "${proxy.name}" started successfully`,
          "success"
        );
      } else {
        // Remove loading state on failure
        const updatedProxies = Array.isArray(proxies)
          ? proxies.map((p) =>
              p.port === proxy.port ? { ...p, isStarting: false } : p
            )
          : [];

        setProxies(updatedProxies);
        updateStatsFromProxies(updatedProxies);

        showToast(
          "Failed to start database proxy: " +
            (result?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      // Remove loading state on error
      const updatedProxies = Array.isArray(proxies)
        ? proxies.map((p) =>
            p.port === proxy.port ? { ...p, isStarting: false } : p
          )
        : [];

      setProxies(updatedProxies);
      updateStatsFromProxies(updatedProxies);

      showToast("Failed to start database proxy: " + error.message, "error");
    }
  };

  const handleStopProxy = async (proxy) => {
    try {
      // Immediately update UI to show loading state
      setProxies((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
              p.port === proxy.port ? { ...p, isStopping: true } : p
            )
          : []
      );

      const result = await window.electronAPI.stopDatabaseProxy(proxy.port);

      if (result?.success) {
        // Update UI immediately with the returned proxy data
        const updatedProxies = Array.isArray(proxies)
          ? proxies.map((p) =>
              p.port === proxy.port ? { ...result.proxy, isStopping: false } : p
            )
          : [];

        setProxies(updatedProxies);
        updateStatsFromProxies(updatedProxies);

        showToast(
          `Database proxy "${proxy.name}" stopped successfully`,
          "info"
        );
      } else {
        // Remove loading state on failure
        const updatedProxies = Array.isArray(proxies)
          ? proxies.map((p) =>
              p.port === proxy.port ? { ...p, isStopping: false } : p
            )
          : [];

        setProxies(updatedProxies);
        updateStatsFromProxies(updatedProxies);

        showToast(
          "Failed to stop database proxy: " +
            (result?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      // Remove loading state on error
      const updatedProxies = Array.isArray(proxies)
        ? proxies.map((p) =>
            p.port === proxy.port ? { ...p, isStopping: false } : p
          )
        : [];

      setProxies(updatedProxies);
      updateStatsFromProxies(updatedProxies);

      showToast("Failed to stop database proxy: " + error.message, "error");
    }
  };

  const handleUpdateProxy = async (port, updates) => {
    try {
      const result = await window.electronAPI.updateDatabaseProxy(
        port,
        updates
      );
      if (result?.success) {
        setProxies((prev) =>
          Array.isArray(prev)
            ? prev.map((p) => (p.port === port ? result.proxy : p))
            : []
        );
        setEditingProxy(null);
        showToast("Database proxy updated successfully", "success");
      } else {
        showToast(result?.error || "Failed to update proxy", "error");
      }
    } catch (error) {
      // console.error("Failed to update database proxy:", error);
      showToast("Failed to update database proxy", "error");
    }
  };

  const handleRemoveProxy = async (port) => {
    const safeProxies = Array.isArray(proxies) ? proxies : [];
    const proxy = safeProxies.find((p) => p.port === port);
    if (!proxy) return;

    setDeleteModal({ isOpen: true, proxy });
  };

  const handleConfirmProxyDelete = async () => {
    const proxy = deleteModal.proxy;
    if (!proxy) return;

    try {
      // Stop the proxy first if it's running - use direct API call to avoid UI interference
      if (proxy.isRunning) {
        const stopResult = await window.electronAPI.stopDatabaseProxy(
          proxy.port
        );
        if (!stopResult?.success) {
          throw new Error(
            `Failed to stop proxy: ${stopResult?.error || "Unknown error"}`
          );
        }
        // Give a small delay to ensure the proxy is fully stopped in the backend
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const result = await window.electronAPI.deleteDatabaseProxy(proxy.port);

      if (result?.success) {
        // Only update UI if deletion was successful
        setProxies((prev) =>
          Array.isArray(prev) ? prev.filter((p) => p.port !== proxy.port) : []
        );
        setQueries((prev) =>
          Array.isArray(prev)
            ? prev.filter((q) => q.proxyPort !== proxy.port)
            : []
        );
        showToast(
          `Database proxy "${proxy.name}" removed successfully`,
          "success"
        );

        // Close modal
        setDeleteModal({ isOpen: false, proxy: null });

        // Automatically refresh the data to ensure UI is completely up to date
        await loadData();
      } else {
        // Show specific error message from backend
        showToast(
          `Failed to remove database proxy: ${
            result?.error || "Unknown error"
          }`,
          "error"
        );
        // Keep modal open on error
      }
    } catch (error) {
      // console.error("Failed to remove database proxy:", error);
      showToast("Failed to remove database proxy: " + error.message, "error");
      // Keep modal open on error
    }
  };

  const handleClearQueries = async (proxyPort = null) => {
    const safeProxies = Array.isArray(proxies) ? proxies : [];
    const proxy = proxyPort
      ? safeProxies.find((p) => p.port === proxyPort)
      : null;
    setClearModal({
      isOpen: true,
      proxyPort,
      proxyName: proxy ? proxy.name : null,
    });
  };

  const handleConfirmClearQueries = async () => {
    const { proxyPort } = clearModal;

    try {
      const result = await window.electronAPI.clearDatabaseQueries(proxyPort);
      if (result?.success) {
        if (proxyPort) {
          setQueries((prev) =>
            Array.isArray(prev)
              ? prev.filter((q) => q.proxyPort !== proxyPort)
              : []
          );
        } else {
          setQueries([]);
        }
        showToast("Queries cleared successfully", "success");

        // Close modal
        setClearModal({ isOpen: false, proxyPort: null, proxyName: null });
      } else {
        showToast(result?.error || "Failed to clear queries", "error");
        // Keep modal open on error
      }
    } catch (error) {
      // console.error("Failed to clear queries:", error);
      showToast("Failed to clear queries", "error");
      // Keep modal open on error
    }
  };

  const handleExportDatabaseConfig = async () => {
    setIsExporting(true);
    try {
      const result = await window.electronAPI.exportDatabaseProxyConfig();
      if (result.success) {
        showToast(`Configuration exported to: ${result.filePath}`, "success");
      } else {
        showToast(result.error || "Export failed", "error");
      }
    } catch (error) {
      // console.error("Failed to export database config:", error);
      showToast("Failed to export configuration", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportDatabaseConfig = async () => {
    setIsImporting(true);
    try {
      const result = await window.electronAPI.importDatabaseProxyConfig();
      if (result.success) {
        loadData(); // Refresh data
        showToast("Configuration imported successfully", "success");
      } else if (!result.cancelled) {
        showToast(result.error || "Import failed", "error");
      }
    } catch (error) {
      // console.error("Failed to import database config:", error);
      showToast("Failed to import configuration", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const getProxyQueries = (port) => {
    const safeQueries = Array.isArray(queries) ? queries : [];
    return safeQueries.filter((q) => q.proxyPort === port);
  };

  useEffect(() => {
    loadData();

    // Set up real-time event listeners for database proxies
    if (window.electronAPI) {
      const handleProxyCreated = (event, proxy) => {
        loadData();
        showToast(
          `Database proxy "${proxy.name}" created successfully`,
          "success"
        );
      };

      const handleProxyStarted = (event, data) => {
        if (data && data.port && data.name) {
          const { port, name } = data;
          loadData();
          showToast(
            `Database proxy "${name}" started on port ${port}`,
            "success"
          );
        } else {
          loadData();
        }
      };

      const handleProxyStopped = (event, data) => {
        if (data && data.name) {
          const { name } = data;
          loadData();
          showToast(`Database proxy "${name}" stopped`, "info");
        } else {
          loadData();
        }
      };

      const handleProxyDeleted = (event, data) => {
        if (data && data.name) {
          const { name } = data;
          loadData();
          showToast(`Database proxy "${name}" deleted`, "success");
        } else {
          loadData();
        }
      };

      const handleProxyError = (event, data) => {
        if (data && data.port && data.error) {
          const { port, error } = data;
          loadData();
          showToast(`Database proxy on port ${port} error: ${error}`, "error");
        } else {
          loadData();
        }
      };

      const handleDatabaseQuery = (query) => {
        setQueries((prev) => [query, ...prev]);
      };

      const handleDatabaseResponse = (query) => {
        setQueries((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.map((q) => (q.id === query.id ? query : q));
        });
      };

      const handleDatabaseError = (query) => {
        setQueries((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.map((q) => (q.id === query.id ? query : q));
        });
      };

      window.electronAPI.onDatabaseProxyCreated?.(handleProxyCreated);
      window.electronAPI.onDatabaseProxyStarted?.(handleProxyStarted);
      window.electronAPI.onDatabaseProxyStopped?.(handleProxyStopped);
      window.electronAPI.onDatabaseProxyDeleted?.(handleProxyDeleted);
      window.electronAPI.onDatabaseProxyError?.(handleProxyError);
      window.electronAPI.onDatabaseQuery?.(handleDatabaseQuery);
      window.electronAPI.onDatabaseResponse?.(handleDatabaseResponse);
      window.electronAPI.onDatabaseError?.(handleDatabaseError);
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

  const handleNavigateToLicense = () => {
    // This would be passed from parent component
    if (window.electronAPI) {
      // For now, just show an alert - in real implementation, parent would handle navigation
      alert(
        "Please upgrade to premium to access Database Proxies. Click the upgrade button in the sidebar."
      );
    }
  };

  return (
    <PremiumFeatureBlock
      feature="database-proxies"
      onUpgrade={handleNavigateToLicense}
    >
      <main className="space-y-4 sm:space-y-6">
        {/* Testing Mode Banner */}
        {testingMode && (
          <div className="bg-orange-100 dark:bg-orange-900 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <MdWarning className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span className="font-medium text-orange-800 dark:text-orange-200">
                Testing Mode Active
              </span>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              Database queries are hitting real backends and being compared with
              saved mocks for validation.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Database Proxies
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Intercept and manage database connections with protocol-specific
                parsing
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
                  onClick={handleImportDatabaseConfig}
                  disabled={isImporting}
                  className="flex items-center gap-1 px-2 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                  title="Import Configuration & Mocks"
                >
                  <MdFileUpload className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Import</span>
                </button>
                <button
                  onClick={handleExportDatabaseConfig}
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
            title="Total Queries"
            value={stats.totalQueries || 0}
            icon={<MdList />}
            color="blue"
          />
          <StatCard
            title="Successful"
            value={stats.successfulQueries || 0}
            icon={<MdCheckCircle />}
            color="green"
          />
          <StatCard
            title="Failed"
            value={stats.failedQueries || 0}
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
            <nav
              className="flex overflow-x-auto"
              role="tablist"
              aria-label="Database Proxy Tabs"
            >
              {[
                { id: "overview", label: "Overview", icon: <MdBarChart /> },
                {
                  id: "proxies",
                  label: "Proxies",
                  icon: <MdStorage />,
                  count: proxies.length,
                },
                {
                  id: "requests",
                  label: "Requests",
                  icon: <MdList />,
                  count: queries.length,
                },
                {
                  id: "mocks",
                  label: "Mocks",
                  icon: <MdCheckCircle />,
                  count: databaseMocks.length,
                  isPremium: !canUseMocks,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => {
                    if (tab.isPremium) {
                      // Don't change tab, just show the premium message in content
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 flex-shrink-0 ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : tab.isPremium
                      ? "border-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="text-sm sm:text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                  {tab.isPremium && <span className="text-xs">🔒</span>}
                  {tab.count !== undefined && (
                    <span
                      data-testid={`${tab.id}-count`}
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
              <div
                role="tabpanel"
                id="tabpanel-overview"
                aria-labelledby="tab-overview"
              >
                <DatabaseProxyOverview
                  proxies={proxies}
                  queries={queries}
                  stats={stats}
                  getProxyQueries={getProxyQueries}
                  proxyNotifications={proxyNotifications}
                  onClearNotifications={onClearNotifications}
                />
              </div>
            )}
            {activeTab === "proxies" && (
              <div
                role="tabpanel"
                id="tabpanel-proxies"
                aria-labelledby="tab-proxies"
              >
                <DatabaseProxiesTab
                  proxies={proxies}
                  showAddProxy={showAddProxy}
                  setShowAddProxy={setShowAddProxy}
                  newProxy={newProxy}
                  setNewProxy={setNewProxy}
                  editingProxy={editingProxy}
                  setEditingProxy={setEditingProxy}
                  onCreateProxy={handleCreateProxy}
                  onStartProxy={handleStartProxy}
                  onStopProxy={handleStopProxy}
                  onUpdateProxy={handleUpdateProxy}
                  onRemoveProxy={handleRemoveProxy}
                  getProxyQueries={getProxyQueries}
                  onClearQueries={handleClearQueries}
                  // Connection string props
                  useConnectionString={useConnectionString}
                  setUseConnectionString={setUseConnectionString}
                  connectionString={connectionString}
                  setConnectionString={setConnectionString}
                  connectionStringError={connectionStringError}
                  setConnectionStringError={setConnectionStringError}
                  parsedConnectionDetails={parsedConnectionDetails}
                  setParsedConnectionDetails={setParsedConnectionDetails}
                  handleConnectionStringChange={handleConnectionStringChange}
                  toggleConnectionStringMode={toggleConnectionStringMode}
                />
              </div>
            )}
            {activeTab === "requests" && (
              <div
                role="tabpanel"
                id="tabpanel-requests"
                aria-labelledby="tab-requests"
              >
                <DatabaseRequestsTab
                  queries={queries}
                  proxies={proxies}
                  onClearQueries={handleClearQueries}
                />
              </div>
            )}
            {activeTab === "mocks" && (
              <div
                role="tabpanel"
                id="tabpanel-mocks"
                aria-labelledby="tab-mocks"
              >
                {canUseMocks ? (
                  <DatabaseMocksView
                    mocks={databaseMocks}
                    proxies={proxies}
                    onRefreshMocks={onRefreshDatabaseMocks || loadData}
                  />
                ) : (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <MdCheckCircle className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Premium Feature: Database Mocks
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Database mock management requires a premium license.
                      Upgrade to unlock the ability to create, manage, and use
                      mocks for your database queries.
                    </p>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        Start your free 30-day trial or upgrade to premium
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            show={true}
            onClose={() => setToast(null)}
          />
        )}

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, proxy: null })}
          onConfirm={handleConfirmProxyDelete}
          title="Remove Database Proxy"
          itemName={deleteModal.proxy?.name}
          itemType="database-proxy"
          description={
            deleteModal.proxy
              ? `${
                  deleteModal.proxy.protocol?.toUpperCase() || "DATABASE"
                } • Port ${deleteModal.proxy.port} → ${
                  deleteModal.proxy.targetHost
                }:${deleteModal.proxy.targetPort}`
              : ""
          }
        />

        {/* Clear Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={clearModal.isOpen}
          onClose={() =>
            setClearModal({ isOpen: false, proxyPort: null, proxyName: null })
          }
          onConfirm={handleConfirmClearQueries}
          title="Clear Database Queries"
          itemName={
            clearModal.proxyPort
              ? `${
                  clearModal.proxyName || `Port ${clearModal.proxyPort}`
                } queries`
              : "All database queries"
          }
          itemType="data"
          action="clear"
          consequences={[
            clearModal.proxyPort
              ? "All query history for this proxy will be cleared"
              : "All database query history will be cleared",
            "This data cannot be recovered",
            "Active mocks and configurations will not be affected",
          ]}
        />
      </main>
    </PremiumFeatureBlock>
  );
};

// Overview Tab Component
function DatabaseProxyOverview({
  proxies,
  queries,
  stats,
  getProxyQueries,
  proxyNotifications = new Map(),
  onClearNotifications = () => {},
}) {
  const queriesArray = Array.isArray(queries) ? queries : [];
  const proxiesArray = Array.isArray(proxies) ? proxies : [];
  const recentQueries = queriesArray.slice(0, 10);

  const getProtocolIcon = (protocol) => {
    switch (protocol) {
      case "postgresql":
        return "🐘";
      case "mysql":
        return "🐬";
      case "mongodb":
        return "🍃";
      case "sqlserver":
        return "🏢";
      case "redis":
        return "🔴";
      default:
        return "🗄️";
    }
  };

  const getProtocolColor = (protocol) => {
    switch (protocol) {
      case "postgresql":
        return "text-blue-600";
      case "mysql":
        return "text-orange-600";
      case "mongodb":
        return "text-green-600";
      case "sqlserver":
        return "text-purple-600";
      case "redis":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Database Proxy Status
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Protocol-specific database connection intercepting
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
          Configured Database Proxies
        </h3>
        {proxies.length === 0 ? (
          <div className="text-center py-8">
            <MdStorage className="mx-auto h-12 w-12 mb-4 opacity-50 text-gray-500 dark:text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No database proxies configured
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Create proxies to start intercepting database connections
            </p>
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-2xl mx-auto text-left">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Getting Started:
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>1. Go to the "Proxies" tab and click "Add Proxy"</li>
                <li>
                  2. Configure port 5433 to proxy PostgreSQL on localhost:5432
                </li>
                <li>3. Start the proxy and point your app to localhost:5433</li>
                <li>4. All database queries will be intercepted and logged</li>
              </ol>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                💡 Configure your application to connect to the proxy port
                instead of the original database port
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {proxiesArray.map((proxy) => {
              const proxyQueries = getProxyQueries(proxy.port);
              const successCount = proxyQueries.filter(
                (q) => q.status === "success"
              ).length;
              const failCount = proxyQueries.filter(
                (q) => q.status === "failed"
              ).length;
              const mockedCount = proxyQueries.filter(
                (q) => q.status === "mocked"
              ).length;

              return (
                <div
                  key={proxy.port}
                  className="bg-white dark:bg-gray-800 border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {getProtocolIcon(proxy.protocol)}
                        </span>
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {proxy.name}
                        </h4>
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
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        <span
                          className={`font-medium ${getProtocolColor(
                            proxy.protocol
                          )}`}
                        >
                          {(proxy.protocol || "unknown").toUpperCase()}
                        </span>{" "}
                        Port {proxy.port} → {proxy.targetHost}:
                        {proxy.targetPort}
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
                      {proxyQueries.length} queries
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

      {/* Recent Queries */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Recent Database Queries
        </h3>
        {recentQueries.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No database queries intercepted yet</p>
            <p className="text-sm">
              Configure proxies and connect your database applications to see
              queries here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentQueries.map((query) => (
              <div
                key={query.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      query.status === "success" || query.status === "executed"
                        ? "bg-green-400"
                        : query.status === "failed"
                        ? "bg-red-400"
                        : query.status === "mocked"
                        ? "bg-blue-400"
                        : "bg-yellow-400"
                    }`}
                  ></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {query.type || "QUERY"}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
                        {typeof query.query === "string"
                          ? query.query.substring(0, 50)
                          : query.query?.sql?.substring(0, 50) ||
                            query.rawQuery?.sql?.substring(0, 50) ||
                            "No SQL"}
                        ...
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>via port {query.proxyPort}</span>
                      {query.duration && <span>• {query.duration}ms</span>}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                  {new Date(query.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Database Proxies Tab Component
function DatabaseProxiesTab({
  proxies,
  showAddProxy,
  setShowAddProxy,
  newProxy,
  setNewProxy,
  editingProxy,
  setEditingProxy,
  onCreateProxy,
  onStartProxy,
  onStopProxy,
  onUpdateProxy,
  onRemoveProxy,
  getProxyQueries,
  onClearQueries,
  // Connection string props
  useConnectionString,
  setUseConnectionString,
  connectionString,
  setConnectionString,
  connectionStringError,
  setConnectionStringError,
  parsedConnectionDetails,
  setParsedConnectionDetails,
  handleConnectionStringChange,
  toggleConnectionStringMode,
}) {
  const safeProxies = Array.isArray(proxies) ? proxies : [];
  const [portWarning, setPortWarning] = useState(null);
  const handlePortBlur = createPortBlurHandler(newProxy.port, setPortWarning);

  // UI-only: selected protocol variant (includes version) -> maps to base protocol
  // Values are like: "postgresql@15", "mysql@8.0", "sqlserver@2022", etc.
  const [protocolVariant, setProtocolVariant] = useState("postgresql");

  const variantDefaults = {
    // PostgreSQL
    postgresql: {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL Proxy",
    },
    "postgresql@15": {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL 15 Proxy",
    },
    "postgresql@13": {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL 13 Proxy",
    },
    // MySQL
    mysql: {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL Proxy",
    },
    "mysql@8.0": {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL 8.0 Proxy",
    },
    "mysql@5.7": {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL 5.7 Proxy",
    },
    // MongoDB
    mongodb: {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB Proxy",
    },
    "mongodb@7.0": {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB 7.0 Proxy",
    },
    "mongodb@5.0": {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB 5.0 Proxy",
    },
    // SQL Server
    sqlserver: {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server Proxy",
    },
    "sqlserver@2022": {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server 2022 Proxy",
    },
    "sqlserver@2019": {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server 2019 Proxy",
    },
    // Redis
    redis: {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis Proxy",
    },
    "redis@7": {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis 7 Proxy",
    },
    "redis@6": {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis 6 Proxy",
    },
  };

  return (
    <div className="space-y-4">
      {/* Add Proxy Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Database Proxy Servers
        </h3>
        <button
          onClick={() => setShowAddProxy(!showAddProxy)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowAddProxy(!showAddProxy);
            }
          }}
          data-testid="add-proxy-button"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <MdAdd />
          Add Proxy
        </button>
      </div>

      {/* Add Proxy Form */}
      {showAddProxy && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Add New Database Proxy
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {useConnectionString
                  ? "Connection String"
                  : "Manual Configuration"}
              </span>
              <button
                onClick={toggleConnectionStringMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  useConnectionString
                    ? "bg-blue-600"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useConnectionString ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Connection String Mode */}
          {useConnectionString ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="connection-string"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Database Connection String *
                </label>
                <textarea
                  id="connection-string"
                  data-testid="connection-string-input"
                  value={connectionString}
                  onChange={(e) => handleConnectionStringChange(e.target.value)}
                  placeholder="mongodb://username:password@localhost:27017/database?authSource=admin"
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white resize-none ${
                    connectionStringError
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
                {connectionStringError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <MdError className="text-sm" />
                    {connectionStringError}
                  </p>
                )}
              </div>

              {/* Proxy Port Configuration */}
              {parsedConnectionDetails && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="proxy-port-cs"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Proxy Port *
                    </label>
                    <input
                      id="proxy-port-cs"
                      type="number"
                      value={newProxy.port}
                      onChange={(e) =>
                        setNewProxy({ ...newProxy, port: e.target.value })
                      }
                      placeholder="37017"
                      min="1"
                      max="65535"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Port where the proxy will listen for connections
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Proxy Name
                    </label>
                    <input
                      type="text"
                      value={newProxy.name}
                      onChange={(e) =>
                        setNewProxy({ ...newProxy, name: e.target.value })
                      }
                      placeholder="MongoDB Proxy"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Parsed Details Preview */}
              {parsedConnectionDetails && (
                <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Parsed Connection Details:
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                    <div>
                      <strong>Protocol:</strong>{" "}
                      {parsedConnectionDetails.protocol}
                    </div>
                    <div>
                      <strong>Target:</strong>{" "}
                      {parsedConnectionDetails.targetHost}:
                      {parsedConnectionDetails.targetPort}
                    </div>
                    <div>
                      <strong>Database:</strong>{" "}
                      {parsedConnectionDetails.database || "N/A"}
                    </div>
                    <div>
                      <strong>Proxy Will Run On:</strong> localhost:
                      {newProxy.port ||
                        parsedConnectionDetails.suggestedProxyPort}
                    </div>
                  </div>
                </div>
              )}

              {/* Example URLs */}
              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Example Connection Strings:
                </h5>
                <div className="space-y-1 text-xs font-mono text-blue-700 dark:text-blue-300">
                  <div>
                    <strong>MongoDB:</strong>{" "}
                    mongodb://admin:pass@localhost:27017/db?authSource=admin
                  </div>
                  <div>
                    <strong>PostgreSQL:</strong>{" "}
                    postgresql://user:pass@localhost:5432/database
                  </div>
                  <div>
                    <strong>MySQL:</strong>{" "}
                    mysql://user:pass@localhost:3306/database
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Manual Configuration Mode */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div>
                <label
                  htmlFor="proxy-port"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Proxy Port *
                </label>
                <input
                  id="proxy-port"
                  type="number"
                  data-testid="proxy-port-input"
                  aria-label="Proxy Port"
                  value={newProxy.port}
                  onChange={(e) => {
                    setNewProxy({ ...newProxy, port: e.target.value });
                    setPortWarning(null); // Clear warning when user starts typing
                  }}
                  onBlur={handlePortBlur}
                  placeholder="5433"
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
                <label
                  htmlFor="proxy-target-host"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Target Host *
                </label>
                <input
                  id="proxy-target-host"
                  type="text"
                  data-testid="proxy-target-host-input"
                  aria-label="Target Host"
                  value={newProxy.targetHost}
                  onChange={(e) =>
                    setNewProxy({ ...newProxy, targetHost: e.target.value })
                  }
                  placeholder="localhost"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="proxy-target-port"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Target Port *
                </label>
                <input
                  id="proxy-target-port"
                  type="number"
                  data-testid="proxy-target-port-input"
                  aria-label="Target Port"
                  value={newProxy.targetPort}
                  onChange={(e) =>
                    setNewProxy({ ...newProxy, targetPort: e.target.value })
                  }
                  placeholder="5432"
                  min="1"
                  max="65535"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="proxy-protocol"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Protocol *
                </label>
                <select
                  id="proxy-protocol"
                  data-testid="proxy-protocol-select"
                  value={protocolVariant}
                  onChange={(e) => {
                    const variant = e.target.value;
                    setProtocolVariant(variant);
                    const def =
                      variantDefaults[variant] || variantDefaults["postgresql"];
                    setNewProxy({
                      ...newProxy,
                      protocol: def.base,
                      port: def.port,
                      targetPort: def.targetPort,
                      name: def.name,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                >
                  <optgroup label="PostgreSQL">
                    <option value="postgresql@15">PostgreSQL › 15</option>
                    <option value="postgresql@13">PostgreSQL › 13</option>
                    <option value="postgresql">PostgreSQL (Any)</option>
                  </optgroup>
                  <optgroup label="MySQL">
                    <option value="mysql@8.0">MySQL › 8.0</option>
                    <option value="mysql@5.7">MySQL › 5.7</option>
                    <option value="mysql">MySQL (Any)</option>
                  </optgroup>
                  <optgroup label="SQL Server">
                    <option value="sqlserver@2022">SQL Server › 2022</option>
                    <option value="sqlserver@2019">SQL Server › 2019</option>
                    <option value="sqlserver">SQL Server (Any)</option>
                  </optgroup>
                  <optgroup label="MongoDB">
                    <option value="mongodb@7.0">MongoDB › 7.0</option>
                    <option value="mongodb@5.0">MongoDB › 5.0</option>
                    <option value="mongodb">MongoDB (Any)</option>
                  </optgroup>
                  <optgroup label="Redis">
                    <option value="redis@7">Redis › 7</option>
                    <option value="redis@6">Redis › 6</option>
                    <option value="redis">Redis (Any)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label
                  htmlFor="proxy-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Name *
                </label>
                <input
                  id="proxy-name"
                  type="text"
                  data-testid="proxy-name-input"
                  aria-label="Name"
                  value={newProxy.name}
                  onChange={(e) =>
                    setNewProxy({ ...newProxy, name: e.target.value })
                  }
                  placeholder="PostgreSQL Proxy"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowAddProxy(false);
                setPortWarning(null);
                // Reset connection string state
                setConnectionString("");
                setConnectionStringError("");
                setParsedConnectionDetails(null);
                setUseConnectionString(false);
                // Reset manual form
                setNewProxy({
                  port: "",
                  targetHost: "",
                  targetPort: "",
                  protocol: "postgresql",
                  name: "",
                });
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
          {/* Usage Information */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg">
            {useConnectionString && parsedConnectionDetails ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    <strong>🎯 How to Use This Proxy:</strong>
                  </p>
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <div>
                      1. Start this proxy (it will listen on port{" "}
                      {newProxy.port ||
                        parsedConnectionDetails.suggestedProxyPort}
                      )
                    </div>
                    <div>
                      2. Update your Node.js application to use the proxy
                      connection string below
                    </div>
                    <div>
                      3. All database requests will be intercepted and forwarded
                      to the real database
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Original Database Connection:
                  </p>
                  <code className="block text-xs bg-blue-100 dark:bg-blue-800 p-2 rounded border font-mono break-all">
                    {connectionString}
                  </code>
                </div>

                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    ⚡ Use This in Your Node.js Code:
                  </p>
                  <code className="block text-xs bg-blue-100 dark:bg-blue-800 p-2 rounded border font-mono break-all">
                    {generateProxyConnectionString(
                      connectionString,
                      parseInt(
                        newProxy.port ||
                          parsedConnectionDetails.suggestedProxyPort
                      )
                    )}
                  </code>
                </div>

                <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                      📝 Node.js Integration Example:
                    </p>
                    <button
                      onClick={() => {
                        const code = `// Update your server.js configuration:
const configs = {
  ${parsedConnectionDetails.protocol}${
                          parsedConnectionDetails.targetPort
                        }: "${generateProxyConnectionString(
                          connectionString,
                          parseInt(
                            newProxy.port ||
                              parsedConnectionDetails.suggestedProxyPort
                          )
                        )}",
  // ... other configs
};

// Your existing code works unchanged!
// Just start the proxy in Sniffler and use the new connection string`;
                        navigator.clipboard.writeText(code);
                      }}
                      className="text-xs px-2 py-1 bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-300 dark:hover:bg-blue-600"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <code className="block text-xs text-blue-700 dark:text-blue-300 font-mono whitespace-pre-wrap">
                    {`// Update your server.js configuration:
const configs = {
  ${parsedConnectionDetails.protocol}${
                      parsedConnectionDetails.targetPort
                    }: "${generateProxyConnectionString(
                      connectionString,
                      parseInt(
                        newProxy.port ||
                          parsedConnectionDetails.suggestedProxyPort
                      )
                    )}",
  // ... other configs
};

// Your existing MongoDB functions work unchanged!
// Just start this proxy and use the updated connection string`}
                  </code>
                </div>

                <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 p-2 rounded">
                  <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                    ✅ Steps to integrate:
                  </p>
                  <ol className="text-xs text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside">
                    <li>Create this proxy (click "Create Proxy" button)</li>
                    <li>Start the proxy (click ▶️ Start button)</li>
                    <li>Update your connection string in server.js</li>
                    <li>Run your server - all queries will be intercepted!</li>
                  </ol>
                </div>
              </div>
            ) : (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Usage:</strong> Configure your application to connect to{" "}
                <code>localhost:{newProxy.port || "PORT"}</code> instead of the
                original database. All queries will be intercepted and forwarded
                to the target database.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Proxies List */}
      <div className="space-y-4">
        {safeProxies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdStorage className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No database proxy servers configured</p>
            <p className="text-sm">
              Create your first proxy to start intercepting database connections
            </p>
          </div>
        ) : (
          safeProxies.map((proxy) => (
            <DatabaseProxyCard
              key={proxy.port}
              proxy={proxy}
              editingProxy={editingProxy}
              setEditingProxy={setEditingProxy}
              onStartProxy={onStartProxy}
              onStopProxy={onStopProxy}
              onUpdateProxy={onUpdateProxy}
              onRemoveProxy={onRemoveProxy}
              getProxyQueries={getProxyQueries}
              onClearQueries={onClearQueries}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Database Proxy Card Component
function DatabaseProxyCard({
  proxy,
  editingProxy,
  setEditingProxy,
  onStartProxy,
  onStopProxy,
  onUpdateProxy,
  onRemoveProxy,
  getProxyQueries,
  onClearQueries,
}) {
  const [editForm, setEditForm] = useState(proxy);
  const proxyQueries = getProxyQueries(proxy.port);
  const isEditing = editingProxy === proxy.port;

  const getProtocolIcon = (protocol) => {
    switch (protocol) {
      case "postgresql":
        return "🐘";
      case "mysql":
        return "🐬";
      case "mongodb":
        return "🍃";
      case "sqlserver":
        return "🏢";
      case "redis":
        return "🔴";
      default:
        return "🗄️";
    }
  };

  const getProtocolColor = (protocol) => {
    switch (protocol) {
      case "postgresql":
        return "text-blue-600";
      case "mysql":
        return "text-orange-600";
      case "mongodb":
        return "text-green-600";
      case "sqlserver":
        return "text-purple-600";
      case "redis":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

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
          Edit Database Proxy
        </h4>
        <div className="grid gap-4 md:grid-cols-3">
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
              Target Host
            </label>
            <input
              type="text"
              value={editForm.targetHost}
              onChange={(e) =>
                setEditForm({ ...editForm, targetHost: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
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
                  targetPort: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="md:col-span-3">
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
            <span className="text-xl">{getProtocolIcon(proxy.protocol)}</span>
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {proxy.name}
            </h4>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                proxy.isRunning
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
              aria-label={`${proxy.name} proxy status`}
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span
                className={`font-medium ${getProtocolColor(proxy.protocol)}`}
              >
                {(proxy.protocol || "unknown").toUpperCase()}
              </span>{" "}
              • Port {proxy.port} → {proxy.targetHost}:{proxy.targetPort}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {proxyQueries.length} queries
            </span>
            <span className="text-green-600 dark:text-green-400">
              {proxyQueries.filter((q) => q.status === "success").length}{" "}
              success
            </span>
            <span className="text-red-600 dark:text-red-400">
              {proxyQueries.filter((q) => q.status === "failed").length} failed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4">
          {proxy.isRunning ? (
            <button
              onClick={() => onStopProxy(proxy)}
              disabled={proxy.isStopping}
              className={`p-2 rounded-lg transition-colors ${
                proxy.isStopping
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
              }`}
              title={proxy.isStopping ? "Stopping proxy..." : "Stop proxy"}
            >
              {proxy.isStopping ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
              ) : (
                <MdStop className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              onClick={() => onStartProxy(proxy)}
              disabled={proxy.isStarting}
              className={`p-2 rounded-lg transition-colors ${
                proxy.isStarting
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900 animate-pulse"
              }`}
              title={
                proxy.isStarting
                  ? "Starting proxy..."
                  : "Start proxy (Click to activate)"
              }
            >
              {proxy.isStarting ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin"></div>
              ) : (
                <MdPlayArrow className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            onClick={() => {
              setEditingProxy(proxy.port);
              setEditForm(proxy);
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Edit proxy"
            disabled={proxy.isRunning}
          >
            <MdEdit />
          </button>
          <button
            onClick={() => onClearQueries(proxy.port)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear queries"
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
          <strong>Configure your app:</strong> Connect to{" "}
          <code>localhost:{proxy.port}</code> instead of{" "}
          <code>
            {proxy.targetHost}:{proxy.targetPort}
          </code>
        </p>
      </div>
    </div>
  );
}

// Database Requests Tab Component
function DatabaseRequestsTab({ queries, proxies, onClearQueries }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedProxy, setSelectedProxy] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [viewMode, setViewMode] = useState("list"); // New view mode
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Extract SQL command type from query content
  const extractSQLCommandType = (query) => {
    let queryText = "";

    // Extract query text from different formats
    if (typeof query.query === "string") {
      queryText = query.query;
    } else if (query.query?.content) {
      queryText = query.query.content;
    } else if (query.query?.payload) {
      queryText = query.query.payload;
    } else if (query.query?.sql) {
      queryText = query.query.sql;
    } else if (query.rawQuery?.sql) {
      queryText = query.rawQuery.sql;
    } else {
      return "UNKNOWN";
    }

    // Clean and normalize the query text
    queryText = queryText.trim().toUpperCase();

    // Extract the first word which should be the SQL command
    const firstWord = queryText.split(/\s+/)[0];

    // Map common SQL commands
    const sqlCommands = {
      SELECT: "SELECT",
      INSERT: "INSERT",
      UPDATE: "UPDATE",
      DELETE: "DELETE",
      CREATE: "CREATE",
      DROP: "DROP",
      ALTER: "ALTER",
      TRUNCATE: "TRUNCATE",
      GRANT: "GRANT",
      REVOKE: "REVOKE",
      BEGIN: "TRANSACTION",
      START: "TRANSACTION",
      COMMIT: "TRANSACTION",
      ROLLBACK: "TRANSACTION",
      EXPLAIN: "EXPLAIN",
      DESCRIBE: "DESCRIBE",
      DESC: "DESCRIBE",
      SHOW: "SHOW",
      USE: "USE",
      SET: "SET",
      CALL: "CALL",
      EXECUTE: "EXECUTE",
      PREPARE: "PREPARE",
    };

    return sqlCommands[firstWord] || firstWord || "UNKNOWN";
  };

  // Group queries by hierarchy: Proxy Name → SQL Command Type → Table/Family
  const groupQueriesByHierarchy = (queries, proxies) => {
    const groups = {};

    queries.forEach((query) => {
      // Level 1: Proxy Name
      const proxy = proxies.find((p) => p.port === query.proxyPort);
      const proxyName = proxy ? proxy.name : `Port ${query.proxyPort}`;

      if (!groups[proxyName]) {
        groups[proxyName] = {
          name: proxyName,
          count: 0,
          types: {},
        };
      }

      // Level 2: SQL Command Type (SELECT, INSERT, UPDATE, etc.)
      const sqlCommandType = extractSQLCommandType(query);
      if (!groups[proxyName].types[sqlCommandType]) {
        groups[proxyName].types[sqlCommandType] = {
          name: sqlCommandType,
          count: 0,
          families: {},
        };
      }

      // Level 3: Family (based on table name or query pattern)
      let familyName = "Other";
      if (query.table) {
        familyName = `${query.table} table`;
      } else {
        const queryText =
          typeof query.query === "string"
            ? query.query
            : query.query?.content ||
              query.query?.payload ||
              query.query?.sql ||
              query.rawQuery?.sql ||
              "";

        // Try to extract table name from query
        const upperQuery = queryText.toUpperCase();
        if (upperQuery.includes("FROM ")) {
          const fromMatch = upperQuery.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (fromMatch) {
            familyName = `${fromMatch[1].toLowerCase()} table`;
          }
        } else if (upperQuery.includes("INTO ")) {
          const intoMatch = upperQuery.match(/INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (intoMatch) {
            familyName = `${intoMatch[1].toLowerCase()} table`;
          }
        } else if (upperQuery.includes("UPDATE ")) {
          const updateMatch = upperQuery.match(
            /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/
          );
          if (updateMatch) {
            familyName = `${updateMatch[1].toLowerCase()} table`;
          }
        } else {
          // Fallback to keyword-based grouping
          if (queryText.toLowerCase().includes("user"))
            familyName = "user table";
          else if (queryText.toLowerCase().includes("order"))
            familyName = "order table";
          else if (queryText.toLowerCase().includes("product"))
            familyName = "product table";
          else if (queryText.toLowerCase().includes("car"))
            familyName = "car table";
        }
      }

      if (!groups[proxyName].types[sqlCommandType].families[familyName]) {
        groups[proxyName].types[sqlCommandType].families[familyName] = {
          name: familyName,
          count: 0,
          queries: [],
        };
      }

      // Add query to the hierarchy
      groups[proxyName].types[sqlCommandType].families[familyName].queries.push(
        query
      );
      groups[proxyName].types[sqlCommandType].families[familyName].count++;
      groups[proxyName].types[sqlCommandType].count++;
      groups[proxyName].count++;
    });

    return groups;
  };

  // Simplified grouping for filtered queries: SQL Command Type → Table/Family (no proxy level)
  const groupQueriesSimplified = (queries) => {
    const types = {};

    queries.forEach((query) => {
      // Level 1: SQL Command Type (SELECT, INSERT, UPDATE, etc.)
      const sqlCommandType = extractSQLCommandType(query);
      if (!types[sqlCommandType]) {
        types[sqlCommandType] = {
          name: sqlCommandType,
          count: 0,
          families: {},
        };
      }

      // Level 2: Family (based on table name or query pattern)
      let familyName = "Other";
      if (query.table) {
        familyName = `${query.table} table`;
      } else {
        const queryText =
          typeof query.query === "string"
            ? query.query
            : query.query?.content ||
              query.query?.payload ||
              query.query?.sql ||
              query.rawQuery?.sql ||
              "";

        // Try to extract table name from query
        const upperQuery = queryText.toUpperCase();
        if (upperQuery.includes("FROM ")) {
          const fromMatch = upperQuery.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (fromMatch) {
            familyName = `${fromMatch[1].toLowerCase()} table`;
          }
        } else if (upperQuery.includes("INTO ")) {
          const intoMatch = upperQuery.match(/INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (intoMatch) {
            familyName = `${intoMatch[1].toLowerCase()} table`;
          }
        } else if (upperQuery.includes("UPDATE ")) {
          const updateMatch = upperQuery.match(
            /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/
          );
          if (updateMatch) {
            familyName = `${updateMatch[1].toLowerCase()} table`;
          }
        } else {
          // Fallback to keyword-based grouping
          if (queryText.toLowerCase().includes("user"))
            familyName = "user table";
          else if (queryText.toLowerCase().includes("order"))
            familyName = "order table";
          else if (queryText.toLowerCase().includes("product"))
            familyName = "product table";
          else if (queryText.toLowerCase().includes("car"))
            familyName = "car table";
        }
      }

      if (!types[sqlCommandType].families[familyName]) {
        types[sqlCommandType].families[familyName] = {
          name: familyName,
          count: 0,
          queries: [],
        };
      }

      // Add query to the hierarchy
      types[sqlCommandType].families[familyName].queries.push(query);
      types[sqlCommandType].families[familyName].count++;
      types[sqlCommandType].count++;
    });

    return types;
  };

  // Get icon for SQL command type
  const getSQLCommandIcon = (commandType) => {
    const icons = {
      SELECT: "🔍",
      INSERT: "➕",
      UPDATE: "✏️",
      DELETE: "🗑️",
      CREATE: "🏗️",
      DROP: "💥",
      ALTER: "🔧",
      TRUNCATE: "🧹",
      GRANT: "🔑",
      REVOKE: "🚫",
      TRANSACTION: "🔄",
      EXPLAIN: "📊",
      DESCRIBE: "📋",
      SHOW: "👁️",
      USE: "🎯",
      SET: "⚙️",
      CALL: "📞",
      EXECUTE: "▶️",
      PREPARE: "📝",
      UNKNOWN: "❓",
    };
    return icons[commandType] || "❓";
  };

  const filteredQueries = queries.filter((query) => {
    if (selectedStatus !== "all" && query.status !== selectedStatus) {
      return false;
    }

    if (selectedProxy !== "all") {
      const proxyPort = parseInt(selectedProxy);
      if (query.proxyPort !== proxyPort) return false;
    }

    if (searchFilter.trim()) {
      const searchLower = searchFilter.toLowerCase();
      const queryText =
        typeof query.query === "string"
          ? query.query
          : query.query?.sql || query.rawQuery?.sql || "";

      if (!queryText.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  const groupedQueries =
    selectedProxy === "all"
      ? groupQueriesByHierarchy(filteredQueries, proxies)
      : null; // Use simplified grouping when specific proxy is selected

  const simplifiedGroups =
    selectedProxy !== "all" ? groupQueriesSimplified(filteredQueries) : null;

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Proxy Filter Tabs */}
      {proxies && proxies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav
              className="flex w-full overflow-x-auto xs:max-w-[70vw] xl:max-w-full"
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
                <span className="text-base">🗄️</span>
                <span>All Proxies</span>
                <span
                  className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
                    selectedProxy === "all"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {queries.length}
                </span>
              </button>
              {proxies.map((proxy) => {
                const proxyQueries = queries.filter(
                  (query) => query.proxyPort === proxy.port
                );
                const getProtocolIcon = (protocol) => {
                  switch (protocol) {
                    case "postgresql":
                      return "🐘";
                    case "mysql":
                      return "🐬";
                    case "mongodb":
                      return "🍃";
                    case "sqlserver":
                      return "🏢";
                    case "redis":
                      return "🔴";
                    default:
                      return "🗄️";
                  }
                };

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
                    <span className="text-base">
                      {getProtocolIcon(proxy.protocol)}
                    </span>
                    <span className="truncate max-w-32">{proxy.name}</span>
                    <span className="text-xs text-gray-500">:{proxy.port}</span>
                    <span
                      className={`ml-1 py-0.5 px-2 rounded-full text-xs ${
                        selectedProxy === proxy.port.toString()
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {proxyQueries.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "grouped"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Grouped View
          </button>
        </div>
      </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Filter queries..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={() => {
            // Pass the selected proxy port when clearing, or null for all
            const proxyPortToClear =
              selectedProxy === "all" ? null : parseInt(selectedProxy);
            onClearQueries(proxyPortToClear);
          }}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          <MdDelete />
          {selectedProxy === "all" ? "Clear All" : "Clear Selected"}
        </button>
      </div>

      {/* Queries List */}
      <div className="space-y-2">
        {filteredQueries.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MdList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No queries match the current filters</p>
          </div>
        ) : viewMode === "grouped" ? (
          selectedProxy === "all" ? (
            // Full Hierarchy: Proxy Name → SQL Command Type → Table/Family → Queries (when viewing all proxies)
            <div className="space-y-4">
              {Object.values(groupedQueries).map((proxyGroup) => (
                <div key={proxyGroup.name} className="border rounded-lg">
                  {/* Proxy Level */}
                  <div
                    className="bg-gray-50 dark:bg-gray-700 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-b"
                    onClick={() => toggleGroup(`proxy-${proxyGroup.name}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🗄️</span>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {proxyGroup.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {proxyGroup.count} total queries
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-500">
                        {expandedGroups.has(`proxy-${proxyGroup.name}`)
                          ? "▼"
                          : "▶"}
                      </span>
                    </div>
                  </div>

                  {/* Type Level */}
                  {expandedGroups.has(`proxy-${proxyGroup.name}`) && (
                    <div className="p-2">
                      {Object.values(proxyGroup.types).map((typeGroup) => (
                        <div key={typeGroup.name} className="mb-3">
                          <div
                            className="bg-blue-50 dark:bg-blue-900 p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors rounded"
                            onClick={() =>
                              toggleGroup(
                                `type-${proxyGroup.name}-${typeGroup.name}`
                              )
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {getSQLCommandIcon(typeGroup.name)}
                                </span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {typeGroup.name}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  ({typeGroup.count} queries)
                                </span>
                              </div>
                              <span className="text-gray-500">
                                {expandedGroups.has(
                                  `type-${proxyGroup.name}-${typeGroup.name}`
                                )
                                  ? "▼"
                                  : "▶"}
                              </span>
                            </div>
                          </div>

                          {/* Family Level */}
                          {expandedGroups.has(
                            `type-${proxyGroup.name}-${typeGroup.name}`
                          ) && (
                            <div className="ml-4 mt-2 space-y-2">
                              {Object.values(typeGroup.families).map(
                                (familyGroup) => (
                                  <div key={familyGroup.name}>
                                    <div
                                      className="bg-green-50 dark:bg-green-900 p-2 cursor-pointer hover:bg-green-100 dark:hover:bg-green-800 transition-colors rounded"
                                      onClick={() =>
                                        toggleGroup(
                                          `family-${proxyGroup.name}-${typeGroup.name}-${familyGroup.name}`
                                        )
                                      }
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                                            📁 {familyGroup.name}
                                          </span>
                                          <span className="text-xs text-gray-600 dark:text-gray-400">
                                            ({familyGroup.count} queries)
                                          </span>
                                        </div>
                                        <span className="text-gray-500 text-sm">
                                          {expandedGroups.has(
                                            `family-${proxyGroup.name}-${typeGroup.name}-${familyGroup.name}`
                                          )
                                            ? "▼"
                                            : "▶"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Query Level */}
                                    {expandedGroups.has(
                                      `family-${proxyGroup.name}-${typeGroup.name}-${familyGroup.name}`
                                    ) && (
                                      <div className="ml-4 mt-2 space-y-1">
                                        {familyGroup.queries.map((query) => (
                                          <DatabaseQueryItem
                                            key={query.id}
                                            query={query}
                                            proxies={proxies}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Simplified Hierarchy: SQL Command Type → Table/Family → Queries (when viewing specific proxy)
            <div className="space-y-4">
              {Object.values(simplifiedGroups).map((typeGroup) => (
                <div key={typeGroup.name} className="border rounded-lg">
                  {/* SQL Command Type Level */}
                  <div
                    className="bg-blue-50 dark:bg-blue-900 p-4 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors border-b"
                    onClick={() => toggleGroup(`type-${typeGroup.name}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {getSQLCommandIcon(typeGroup.name)}
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {typeGroup.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {typeGroup.count} queries
                          </p>
                        </div>
                      </div>
                      <span className="text-gray-500">
                        {expandedGroups.has(`type-${typeGroup.name}`)
                          ? "▼"
                          : "▶"}
                      </span>
                    </div>
                  </div>

                  {/* Table/Family Level */}
                  {expandedGroups.has(`type-${typeGroup.name}`) && (
                    <div className="p-2">
                      {Object.values(typeGroup.families).map((familyGroup) => (
                        <div key={familyGroup.name} className="mb-3">
                          <div
                            className="bg-green-50 dark:bg-green-900 p-3 cursor-pointer hover:bg-green-100 dark:hover:bg-green-800 transition-colors rounded"
                            onClick={() =>
                              toggleGroup(
                                `family-${typeGroup.name}-${familyGroup.name}`
                              )
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  📁 {familyGroup.name}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  ({familyGroup.count} queries)
                                </span>
                              </div>
                              <span className="text-gray-500">
                                {expandedGroups.has(
                                  `family-${typeGroup.name}-${familyGroup.name}`
                                )
                                  ? "▼"
                                  : "▶"}
                              </span>
                            </div>
                          </div>

                          {/* Query Level */}
                          {expandedGroups.has(
                            `family-${typeGroup.name}-${familyGroup.name}`
                          ) && (
                            <div className="ml-4 mt-2 space-y-1">
                              {familyGroup.queries.map((query) => (
                                <DatabaseQueryItem
                                  key={query.id}
                                  query={query}
                                  proxies={proxies}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // List View: Simple flat list
          filteredQueries.map((query) => (
            <DatabaseQueryItem key={query.id} query={query} proxies={proxies} />
          ))
        )}
      </div>
    </div>
  );
}

// Database Query Item Component
function DatabaseQueryItem({ query, proxies }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract SQL command type from query content for display
  const getSQLCommandType = (query) => {
    let queryText = "";

    if (typeof query.query === "string") {
      queryText = query.query;
    } else if (query.query?.content) {
      queryText = query.query.content;
    } else if (query.query?.payload) {
      queryText = query.query.payload;
    } else if (query.query?.sql) {
      queryText = query.query.sql;
    } else if (query.rawQuery?.sql) {
      queryText = query.rawQuery.sql;
    } else {
      return query.type || "UNKNOWN";
    }

    const firstWord = queryText.trim().toUpperCase().split(/\s+/)[0];
    const sqlCommands = {
      SELECT: "SELECT",
      INSERT: "INSERT",
      UPDATE: "UPDATE",
      DELETE: "DELETE",
      CREATE: "CREATE",
      DROP: "DROP",
      ALTER: "ALTER",
      TRUNCATE: "TRUNCATE",
      GRANT: "GRANT",
      REVOKE: "REVOKE",
      BEGIN: "TRANSACTION",
      START: "TRANSACTION",
      COMMIT: "TRANSACTION",
      ROLLBACK: "TRANSACTION",
      EXPLAIN: "EXPLAIN",
      DESCRIBE: "DESCRIBE",
      DESC: "DESCRIBE",
      SHOW: "SHOW",
      USE: "USE",
      SET: "SET",
      CALL: "CALL",
      EXECUTE: "EXECUTE",
      PREPARE: "PREPARE",
    };

    return sqlCommands[firstWord] || firstWord || query.type || "UNKNOWN";
  };

  const getSQLCommandIcon = (commandType) => {
    const icons = {
      SELECT: "🔍",
      INSERT: "➕",
      UPDATE: "✏️",
      DELETE: "🗑️",
      CREATE: "🏗️",
      DROP: "💥",
      ALTER: "🔧",
      TRUNCATE: "🧹",
      GRANT: "🔑",
      REVOKE: "🚫",
      TRANSACTION: "🔄",
      EXPLAIN: "📊",
      DESCRIBE: "📋",
      SHOW: "👁️",
      USE: "🎯",
      SET: "⚙️",
      CALL: "📞",
      EXECUTE: "▶️",
      PREPARE: "📝",
      UNKNOWN: "❓",
    };
    return icons[commandType] || "❓";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
      case "executed":
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
      case "executed":
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

  const proxy = proxies.find((p) => p.port === query.proxyPort);
  const sqlCommandType = getSQLCommandType(query);

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(query.status)}`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {getStatusIcon(query.status)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">
                {getSQLCommandIcon(sqlCommandType)}
              </span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {sqlCommandType}
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
                {typeof query.query === "string"
                  ? query.query.substring(0, 100)
                  : query.query?.content?.substring(0, 100) ||
                    query.query?.payload?.substring(0, 100) ||
                    query.query?.sql?.substring(0, 100) ||
                    query.rawQuery?.sql?.substring(0, 100) ||
                    "No SQL"}
                ...
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>via {proxy?.name || `port ${query.proxyPort}`}</span>
              {query.duration && <span>• {query.duration}ms</span>}
              <span>• {new Date(query.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {query.response && (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                query.status === "success" || query.status === "executed"
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
              }`}
            >
              {query.status?.toUpperCase()}
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
            {/* Query Details */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Query
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">SQL Command:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <span>{getSQLCommandIcon(sqlCommandType)}</span>
                    {sqlCommandType}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Protocol Type:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {query.type || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Proxy:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {proxy?.name || `Port ${query.proxyPort}`}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Query:</span>
                  <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto max-h-32">
                    {typeof query.query === "string"
                      ? query.query
                      : query.query?.content ||
                        query.query?.payload ||
                        query.query?.sql ||
                        query.rawQuery?.sql ||
                        "No SQL"}
                  </pre>
                </div>
              </div>
            </div>

            {/* Response Details */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Response
              </h4>
              {query.response ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {query.status}
                    </span>
                  </div>
                  {query.duration && (
                    <div>
                      <span className="font-medium">Duration:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {query.duration}ms
                      </span>
                    </div>
                  )}
                  {query.response.rows && (
                    <div>
                      <span className="font-medium">Rows:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {query.response.rows.length}
                      </span>
                    </div>
                  )}
                  {query.response.rows && query.response.rows.length > 0 && (
                    <div>
                      <span className="font-medium">Data:</span>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto max-h-32">
                        {JSON.stringify(
                          query.response.rows.slice(0, 5),
                          null,
                          2
                        )}
                        {query.response.rows.length > 5 && "\n... (truncated)"}
                      </pre>
                    </div>
                  )}
                </div>
              ) : query.error ? (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  <span className="font-medium">Error:</span>
                  <span className="ml-2">{query.error}</span>
                </div>
              ) : (
                <div className="text-yellow-600 dark:text-yellow-400 text-sm">
                  Pending response...
                </div>
              )}
            </div>
          </div>

          {/* Validation Results (Testing Mode) */}
          {query.validationResults && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Validation Results
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Mock Exists:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      query.validationResults.mockExists
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
                    }`}
                  >
                    {query.validationResults.mockExists ? "Yes" : "No"}
                  </span>
                </div>

                {query.validationResults.mockExists && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Response Matches:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        query.validationResults.responseMatches
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                          : "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200"
                      }`}
                    >
                      {query.validationResults.responseMatches
                        ? "Match"
                        : "Response differs from mock"}
                    </span>
                  </div>
                )}

                {query.validationResults.differences &&
                  query.validationResults.differences.length > 0 && (
                    <div>
                      <span className="font-medium">Differences:</span>
                      <ul className="mt-1 ml-4 list-disc text-orange-600 dark:text-orange-400">
                        {query.validationResults.differences.map(
                          (diff, index) => (
                            <li key={index} className="text-xs">
                              {diff}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DatabaseProxyView;
