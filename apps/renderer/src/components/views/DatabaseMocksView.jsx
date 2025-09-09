import { useState, useEffect } from "react";
import {
  MdVisibility,
  MdDelete,
  MdList,
  MdFolder,
  MdPause,
  MdPlayArrow,
  MdDeleteForever,
} from "react-icons/md";
import Toast from "../common/Toast";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";

// Extract SQL command type from mock pattern
const extractSQLCommandType = (mock) => {
  // Safety check for mock object
  if (!mock || typeof mock !== "object") return "UNKNOWN";

  let queryText = "";

  // Extract query text from pattern
  if (typeof mock.pattern === "string") {
    queryText = mock.pattern;
  } else if (mock.pattern?.sql) {
    queryText = mock.pattern.sql;
  }

  if (!queryText) return "UNKNOWN";

  // Clean the query text
  queryText = queryText.trim();
  const normalizedQuery = queryText.toUpperCase();

  // Handle SQL queries first
  const sqlMatch = queryText
    .toLowerCase()
    .match(
      /^\s*(select|insert|update|delete|create|drop|alter|truncate|grant|revoke|begin|commit|rollback|explain|describe|show|use|set|call|execute|prepare)\b/i
    );

  if (sqlMatch) {
    return sqlMatch[1].toUpperCase();
  }

  // Handle MongoDB queries (formatted as db.collection.operation())
  // Check for both DB. and db. patterns to handle case normalization
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".FIND"))
    return "FIND";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".INSERT"))
    return "INSERT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".UPDATE"))
    return "UPDATE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DELETE"))
    return "DELETE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".AGGREGATE"))
    return "AGGREGATE";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".COUNT"))
    return "COUNT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DISTINCT"))
    return "DISTINCT";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".DROP"))
    return "DROP";
  if (normalizedQuery.includes("DB.") && normalizedQuery.includes(".CREATE"))
    return "CREATE";

  // Also handle lowercase patterns
  const lowerQuery = queryText.toLowerCase();
  if (lowerQuery.includes("db.") && lowerQuery.includes(".find")) return "FIND";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".insert"))
    return "INSERT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".update"))
    return "UPDATE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".delete"))
    return "DELETE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".aggregate"))
    return "AGGREGATE";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".count"))
    return "COUNT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".distinct"))
    return "DISTINCT";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".drop")) return "DROP";
  if (lowerQuery.includes("db.") && lowerQuery.includes(".create"))
    return "CREATE";

  return "UNKNOWN";
};

// Get icon for SQL command type
const getSQLCommandIcon = (commandType) => {
  const icons = {
    // SQL Commands
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
    // MongoDB Commands
    FIND: "🔍",
    AGGREGATE: "📊",
    COUNT: "🔢",
    DISTINCT: "🎯",
    UNKNOWN: "❓",
  };
  return icons[commandType] || "❓";
};

// Get protocol icon for proxy display
const getProtocolIcon = (protocol) => {
  const icons = {
    postgresql: "🐘",
    mysql: "🐬",
    mongodb: "🍃",
    sqlserver: "🏢",
  };
  return icons[protocol?.toLowerCase()] || "🗄️";
};

// Group mocks by hierarchy: Proxy → Family → Request Type
const groupMocksByHierarchy = (mocks, proxies = []) => {
  const proxyGroups = {};

  mocks.forEach((mock) => {
    // Get proxy information
    let proxyName = mock.proxyName;
    let protocol = mock.protocol;

    if (!proxyName && mock.proxyPort) {
      const proxy = proxies.find((p) => p.port === mock.proxyPort);
      proxyName = proxy ? proxy.name : `Port ${mock.proxyPort}`;
      protocol = proxy ? proxy.protocol : protocol;
    }

    if (!proxyName) {
      proxyName = "Unknown Proxy";
    }

    // Initialize proxy group
    if (!proxyGroups[proxyName]) {
      proxyGroups[proxyName] = {
        name: proxyName,
        protocol: protocol,
        count: 0,
        families: {},
      };
    }

    // Determine family name (table/collection name)
    let familyName = "Other";
    if (mock.pattern && typeof mock.pattern === "string") {
      const queryText = mock.pattern.toLowerCase();

      // Simple table extraction patterns
      if (queryText.includes("users") || queryText.includes("user")) {
        familyName = "Users";
      } else if (queryText.includes("orders") || queryText.includes("order")) {
        familyName = "Orders";
      } else if (
        queryText.includes("products") ||
        queryText.includes("product")
      ) {
        familyName = "Products";
      } else if (
        queryText.includes("customers") ||
        queryText.includes("customer")
      ) {
        familyName = "Customers";
      } else if (queryText.includes("cars") || queryText.includes("car")) {
        familyName = "Cars";
      }
    }

    // Get SQL command type
    const sqlCommandType = extractSQLCommandType(mock);

    // Initialize family group
    if (!proxyGroups[proxyName].families[familyName]) {
      proxyGroups[proxyName].families[familyName] = {
        name: familyName,
        count: 0,
        types: {},
      };
    }

    // Initialize type group
    if (!proxyGroups[proxyName].families[familyName].types[sqlCommandType]) {
      proxyGroups[proxyName].families[familyName].types[sqlCommandType] = {
        name: sqlCommandType,
        count: 0,
        mocks: [],
      };
    }

    // Add mock to the hierarchy
    proxyGroups[proxyName].families[familyName].types[
      sqlCommandType
    ].mocks.push(mock);
    proxyGroups[proxyName].families[familyName].types[sqlCommandType].count++;
    proxyGroups[proxyName].families[familyName].count++;
    proxyGroups[proxyName].count++;
  });

  return proxyGroups;
};

// Simplified grouping for specific proxy: Family → Request Type
const groupMocksSimplified = (mocks) => {
  const families = {};

  mocks.forEach((mock) => {
    // Determine family name (table/collection name)
    let familyName = "Other";
    if (mock.pattern && typeof mock.pattern === "string") {
      const queryText = mock.pattern.toLowerCase();

      // Simple table extraction patterns
      if (queryText.includes("users") || queryText.includes("user")) {
        familyName = "Users";
      } else if (queryText.includes("orders") || queryText.includes("order")) {
        familyName = "Orders";
      } else if (
        queryText.includes("products") ||
        queryText.includes("product")
      ) {
        familyName = "Products";
      } else if (
        queryText.includes("customers") ||
        queryText.includes("customer")
      ) {
        familyName = "Customers";
      } else if (queryText.includes("cars") || queryText.includes("car")) {
        familyName = "Cars";
      }
    }

    // Get SQL command type
    const sqlCommandType = extractSQLCommandType(mock);

    // Initialize family group
    if (!families[familyName]) {
      families[familyName] = {
        name: familyName,
        count: 0,
        types: {},
      };
    }

    // Initialize type group
    if (!families[familyName].types[sqlCommandType]) {
      families[familyName].types[sqlCommandType] = {
        name: sqlCommandType,
        count: 0,
        mocks: [],
      };
    }

    // Add mock to the hierarchy
    families[familyName].types[sqlCommandType].mocks.push(mock);
    families[familyName].types[sqlCommandType].count++;
    families[familyName].count++;
  });

  return families;
};

// Simple grouping by SQL command type only (for use with proxy-filtered tabs)
const groupMocksByCommandType = (mocks) => {
  const types = {};

  // Ensure mocks is an array and filter out any malformed mocks
  const safeMocks = Array.isArray(mocks)
    ? mocks.filter((mock) => mock && typeof mock === "object")
    : [];

  safeMocks.forEach((mock) => {
    const sqlCommandType = extractSQLCommandType(mock);

    // Initialize type group
    if (!types[sqlCommandType]) {
      types[sqlCommandType] = {
        name: sqlCommandType,
        count: 0,
        mocks: [],
      };
    }

    // Add mock to the type group
    types[sqlCommandType].mocks.push(mock);
    types[sqlCommandType].count++;
  });

  return types;
};

// Legacy Database-specific family grouping function - groups by database name (proxy name)
const groupDatabaseMocksByFamily = (mocks, proxies = []) => {
  const families = {};

  // Ensure mocks is an array and filter out any malformed mocks
  const safeMocks = Array.isArray(mocks)
    ? mocks.filter((mock) => mock && typeof mock === "object")
    : [];

  safeMocks.forEach((mock) => {
    // Try to get database name from proxy name first, then fallback
    let databaseName = mock.proxyName;

    if (!databaseName && mock.proxyPort) {
      // Find the proxy by port to get its name
      const proxy = Array.isArray(proxies)
        ? proxies.find((p) => p && p.port === mock.proxyPort)
        : null;
      databaseName = proxy ? proxy.name : `Port ${mock.proxyPort}`;
    }

    // Ensure databaseName is never null/undefined
    if (!databaseName || databaseName === null || databaseName === undefined) {
      databaseName = "Unknown Database";
    }

    // Ensure databaseName is a string
    databaseName = String(databaseName);

    if (families[databaseName] === undefined) {
      families[databaseName] = {
        basePath: databaseName,
        mocks: [],
        subfamilies: {},
        count: 0,
      };
    }

    families[databaseName].mocks.push(mock);
    families[databaseName].count++;
  });

  return Object.values(families).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Ensure basePath is always a string before calling localeCompare
    const aPath = a.basePath || "";
    const bPath = b.basePath || "";
    return aPath.localeCompare(bPath);
  });
};

// Database-specific family display name
const getDatabaseFamilyDisplayName = (family) => {
  const { basePath, count } = family;
  return `${basePath} (${count} mock${count !== 1 ? "s" : ""})`;
};

// Database-specific subfamilies (simplified for database mocks)
const getDatabaseSubfamilies = (family) => {
  const subfamilies = [];

  // Add direct mocks to the family
  if (family.mocks && family.mocks.length > 0) {
    subfamilies.push({
      path: family.basePath,
      mocks: family.mocks,
      count: family.mocks.length,
      isMainPath: true,
    });
  }

  return subfamilies;
};

function DatabaseMocksView({ mocks, proxies, onRefreshMocks }) {
  // Ensure mocks and proxies are arrays to prevent errors
  const safeMocks = Array.isArray(mocks) ? mocks : [];
  const safeProxies = Array.isArray(proxies) ? proxies : [];

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info",
  });
  const [selectedProxy, setSelectedProxy] = useState("all"); // Start with "all" instead of empty
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState("families"); // Default to list view
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());
  const [expandedSubfolders, setExpandedSubfolders] = useState(new Set());
  const [selectedMock, setSelectedMock] = useState(null);
  const [showMockDetails, setShowMockDetails] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, mock: null });
  const [deleteFamilyModal, setDeleteFamilyModal] = useState({
    isOpen: false,
    familyName: null,
    familyMocks: [],
  });
  const [formData, setFormData] = useState({
    protocol: "postgresql",
    pattern: "",
    response: '{\n  "rows": [],\n  "rowCount": 0\n}',
    name: "",
  });

  useEffect(() => {
    // Set default proxy selection if not set and if there are proxies
    if (!selectedProxy || selectedProxy === "all") {
      // Keep "all" selected by default, no need to auto-select first proxy
    }
  }, [safeProxies]);

  useEffect(() => {
    // Set up real-time event listeners for database mocks
    if (window.electronAPI) {
      const handleMockAdded = (mock) => {
        onRefreshMocks();
        showToast("Database mock created successfully", "success");
      };

      const handleMockRemoved = (data) => {
        onRefreshMocks();
        showToast("Database mock removed", "success");
      };

      const handleMockToggled = (mock) => {
        onRefreshMocks();
        showToast(`Mock ${mock.enabled ? "enabled" : "disabled"}`, "success");
      };

      const handleMockUpdated = (mock) => {
        onRefreshMocks();
        showToast("Database mock updated", "success");
      };

      window.electronAPI.onDatabaseMockAdded?.(handleMockAdded);
      window.electronAPI.onDatabaseMockRemoved?.(handleMockRemoved);
      window.electronAPI.onDatabaseMockToggled?.(handleMockToggled);
      window.electronAPI.onDatabaseMockUpdated?.(handleMockUpdated);
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, [onRefreshMocks]);

  // Filter mocks based on selected proxy
  const filteredMocks =
    selectedProxy === "all"
      ? safeMocks
      : safeMocks.filter(
          (mock) => mock && mock.proxyPort === parseInt(selectedProxy)
        );

  // Group mocks by SQL command type for family view
  const mocksByCommandType =
    viewMode === "families" ? groupMocksByCommandType(filteredMocks) : null;

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: "", type: "info" });
  };

  const toggleFamilyExpansion = (familyKey) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(familyKey)) {
      newExpanded.delete(familyKey);
    } else {
      newExpanded.add(familyKey);
    }
    setExpandedFamilies(newExpanded);
  };

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSubfolderExpansion = (subfolderPath) => {
    const newExpanded = new Set(expandedSubfolders);
    if (newExpanded.has(subfolderPath)) {
      newExpanded.delete(subfolderPath);
    } else {
      newExpanded.add(subfolderPath);
    }
    setExpandedSubfolders(newExpanded);
  };

  // Helper function to recursively expand all folders
  const getAllFolderPaths = (families) => {
    const paths = new Set();
    families.forEach((family) => {
      paths.add(family.basePath);
    });
    return paths;
  };

  const handleCreateMock = async (e) => {
    e.preventDefault();

    if (!selectedProxy) {
      showToast("Please select a proxy", "error");
      return;
    }

    try {
      const mockData = {
        proxyPort: parseInt(selectedProxy),
        protocol: formData.protocol,
        pattern: formData.pattern,
        response: JSON.parse(formData.response),
        name: formData.name || `Mock for ${formData.pattern}`,
      };

      await window.electronAPI.createDatabaseMock(mockData);
      setShowCreateForm(false);
      onRefreshMocks();
      setFormData({
        protocol: "postgresql",
        pattern: "",
        response: '{\n  "rows": [],\n  "rowCount": 0\n}',
        name: "",
      });
      showToast("Database mock created", "success");
    } catch (error) {
      showToast("Failed to create mock: " + error.message, "error");
    }
  };

  // Simplified recursive function for database subfamilies
  const renderSubfamilies = (subfamilies, parentPath = "", level = 0) => {
    return subfamilies.map((subfamily, subIndex) => {
      const subfolderName =
        subfamily.subName || subfamily.basePath || `Subfolder-${subIndex}`;
      const subfolderPath = `${parentPath}/${subfolderName}`;
      const isSubfolderExpanded = expandedSubfolders.has(subfolderPath);
      const marginLeft = level * 4; // Increase indentation for each level

      return (
        <div
          key={`${parentPath}-${subIndex}-${level}`}
          className="space-y-3"
          style={{ marginLeft: `${marginLeft}rem` }}
        >
          {subfamily.isSubPath && (
            <div
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border-l-4 border-blue-300 dark:border-blue-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              onClick={() => toggleSubfolderExpansion(subfolderPath)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {isSubfolderExpanded ? "📂" : "📁"}
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {subfolderName} ({subfamily.count})
                </span>
              </div>
            </div>
          )}

          {/* Render mocks in this subfolder */}
          {(subfamily.isSubPath ? isSubfolderExpanded : true) && (
            <div className="space-y-3">
              {subfamily.mocks.map((mock) => renderMockCard(mock, true))}
            </div>
          )}
        </div>
      );
    });
  };

  const renderMockCard = (mock, isInFamily = false) => (
    <div
      key={mock.id}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${
        isInFamily ? "ml-4 border-l-4 border-blue-200 dark:border-blue-800" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Mock Details - Left Side */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-medium px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {mock.protocol?.toUpperCase() || "DATABASE"}
            </span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={mock.enabled}
                onChange={() => toggleMock(mock)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  mock.enabled
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                }`}
              >
                {mock.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Port: {mock.proxyPort}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Used: {mock.usageCount || 0} times
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1">
            {mock.name || `Mock for ${mock.pattern}`}
          </h3>

          {mock.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {mock.description}
            </p>
          )}

          <div className="text-xs text-gray-500 mb-2">
            Pattern:{" "}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
              {mock.pattern}
            </code>
          </div>
        </div>

        {/* Buttons - Right Side */}
        <div className="flex gap-2">
          <button
            onClick={() => viewMockDetails(mock)}
            className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
            title="View mock details"
          >
            <MdVisibility />
          </button>
          <button
            onClick={() => toggleMock(mock)}
            className={`flex items-center justify-center w-10 h-10 rounded-lg font-medium transition-colors duration-200 shadow-sm ${
              mock.enabled
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
            title={mock.enabled ? "Disable mock" : "Enable mock"}
          >
            {mock.enabled ? <MdPause /> : <MdPlayArrow />}
          </button>
          <button
            onClick={() => removeMock(mock)}
            className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
            title="Remove mock"
          >
            <MdDelete />
          </button>
        </div>
      </div>
    </div>
  );

  const viewMockDetails = (mock) => {
    setSelectedMock(mock);
    setShowMockDetails(true);
  };

  const removeMock = async (mock) => {
    setDeleteModal({ isOpen: true, mock });
  };

  const handleConfirmMockDelete = async () => {
    const mock = deleteModal.mock;
    if (!mock) return;

    try {
      await window.electronAPI.deleteDatabaseMock(mock.id);
      onRefreshMocks();
      showToast("Mock removed", "success");

      // Close modal
      setDeleteModal({ isOpen: false, mock: null });
    } catch (error) {
      showToast("Failed to remove mock", "error");
      // Keep modal open on error
    }
  };

  const handleDeleteFamily = (familyName, familyMocks) => {
    setDeleteFamilyModal({ isOpen: true, familyName, familyMocks });
  };

  const handleConfirmFamilyDelete = async () => {
    const { familyMocks } = deleteFamilyModal;
    if (!familyMocks || familyMocks.length === 0) return;

    try {
      showToast(`Deleting ${familyMocks.length} mocks from family...`, "info");

      for (const mock of familyMocks) {
        await window.electronAPI.deleteDatabaseMock(mock.id);
      }

      onRefreshMocks();
      showToast(
        `Successfully deleted ${familyMocks.length} mocks from family`,
        "success"
      );

      // Close modal
      setDeleteFamilyModal({
        isOpen: false,
        familyName: null,
        familyMocks: [],
      });
    } catch (error) {
      showToast("Failed to delete family mocks", "error");
      // Keep modal open on error
    }
  };

  const toggleMock = async (mock) => {
    try {
      const result = await window.electronAPI.toggleDatabaseMock(
        mock.id,
        !mock.enabled
      );
      if (result) {
        onRefreshMocks();
        showToast(`Mock ${mock.enabled ? "disabled" : "enabled"}`, "success");
      } else {
        showToast("Failed to toggle mock", "error");
      }
    } catch (error) {
      showToast("Failed to toggle mock", "error");
    }
  };

  const handleEnableAllMocks = async () => {
    if (!window.electronAPI) {
      showToast("API not available", "error");
      return;
    }

    const disabledMocks = filteredMocks.filter((mock) => !mock.enabled);
    if (disabledMocks.length === 0) {
      showToast(
        `All ${
          selectedProxy === "all" ? "" : "filtered "
        }mocks are already enabled`,
        "info"
      );
      return;
    }

    try {
      showToast(`Enabling ${disabledMocks.length} mocks...`, "info");

      for (const mock of disabledMocks) {
        await window.electronAPI.toggleDatabaseMock(mock.id, true);
      }

      showToast(`✅ Enabled ${disabledMocks.length} mocks`, "success");
      onRefreshMocks();
    } catch (error) {
      showToast(`❌ Failed to enable mocks: ${error.message}`, "error");
    }
  };

  const handleDisableAllMocks = async () => {
    if (!window.electronAPI) {
      showToast("API not available", "error");
      return;
    }

    const enabledMocks = filteredMocks.filter((mock) => mock.enabled);
    if (enabledMocks.length === 0) {
      showToast(
        `All ${
          selectedProxy === "all" ? "" : "filtered "
        }mocks are already disabled`,
        "info"
      );
      return;
    }

    try {
      showToast(`Disabling ${enabledMocks.length} mocks...`, "info");

      for (const mock of enabledMocks) {
        await window.electronAPI.toggleDatabaseMock(mock.id, false);
      }

      showToast(`✅ Disabled ${enabledMocks.length} mocks`, "success");
      onRefreshMocks();
    } catch (error) {
      showToast(`❌ Failed to disable mocks: ${error.message}`, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Database Mocks ({filteredMocks.length}
            {selectedProxy !== "all" ? ` of ${safeMocks.length}` : ""})
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Mock responses for database queries (active only during testing
            mode)
            {selectedProxy !== "all" && (
              <span className="ml-1 font-medium">
                • Filtered by{" "}
                {proxies.find((p) => p.port.toString() === selectedProxy)
                  ?.name || `Port ${selectedProxy}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Create Mock
          </button>
          <button
            onClick={onRefreshMocks}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
          >
            Refresh
          </button>
          {filteredMocks.length > 0 && (
            <>
              <button
                onClick={handleEnableAllMocks}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                title={`Enable all ${
                  selectedProxy === "all" ? "" : "filtered "
                }mocks`}
              >
                Enable All{selectedProxy !== "all" && " Filtered"}
              </button>
              <button
                onClick={handleDisableAllMocks}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm"
                title={`Disable all ${
                  selectedProxy === "all" ? "" : "filtered "
                }mocks`}
              >
                Disable All{selectedProxy !== "all" && " Filtered"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Proxy Filter Tabs */}
      {safeProxies && safeProxies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav
              className="flex w-full overflow-x-auto max-w-[70vw]"
              role="tablist"
              aria-label="Proxy Filter Tabs"
            >
              <button
                role="tab"
                aria-selected={selectedProxy === "all"}
                onClick={() => setSelectedProxy("all")}
                className={`py-3 px-3 text-sm font-medium border-b-2 flex items-center gap-2 flex-shrink-0 min-w-0 max-w-48 ${
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
                  {safeMocks.length}
                </span>
              </button>
              {safeProxies.map((proxy) => {
                const proxyMocks = safeMocks.filter(
                  (mock) => mock.proxyPort === proxy.port
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
                    className={`py-3 px-3 text-sm font-medium border-b-2 flex items-center gap-2 flex-shrink-0 min-w-0 max-w-48 ${
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
                      {proxyMocks.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {filteredMocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode("families")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "families"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <MdFolder className="inline mr-1" /> Family View
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <MdList className="inline mr-1" /> List View
          </button>
          {viewMode === "families" && mocksByCommandType && (
            <>
              <button
                onClick={() => {
                  // Expand all command type groups
                  const allGroups = new Set();
                  Object.keys(mocksByCommandType).forEach((commandType) => {
                    allGroups.add(`type-${commandType}`);
                  });
                  setExpandedGroups(allGroups);
                }}
                className="px-3 py-1.5 rounded text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Expand All
              </button>
              <button
                onClick={() => {
                  setExpandedGroups(new Set());
                }}
                className="px-3 py-1.5 rounded text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Collapse All
              </button>
            </>
          )}
        </div>
      )}

      {/* Create Mock Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Create Database Mock
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <form onSubmit={handleCreateMock} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Proxy Port
                  </label>
                  <select
                    value={selectedProxy}
                    onChange={(e) => setSelectedProxy(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    {safeProxies.map((proxy) => (
                      <option key={proxy.port} value={proxy.port}>
                        Port {proxy.port} - {proxy.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Protocol
                    </label>
                    <select
                      value={formData.protocol}
                      onChange={(e) =>
                        setFormData({ ...formData, protocol: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="sqlserver">SQL Server</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Mock Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="User List Mock"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Query Pattern
                  </label>
                  <textarea
                    value={formData.pattern}
                    onChange={(e) =>
                      setFormData({ ...formData, pattern: e.target.value })
                    }
                    rows={4}
                    placeholder="SELECT * FROM users"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Mock Response (JSON)
                  </label>
                  <textarea
                    value={formData.response}
                    onChange={(e) =>
                      setFormData({ ...formData, response: e.target.value })
                    }
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm"
                    placeholder="Response data"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    Create Mock
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mock Details Modal */}
      {showMockDetails && selectedMock && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Mock Details
                </h2>
                <button
                  onClick={() => setShowMockDetails(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {selectedMock.name || "Unnamed Mock"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Protocol
                    </label>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {selectedMock.protocol?.toUpperCase() || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Proxy Port
                    </label>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {selectedMock.proxyPort}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Query Pattern
                  </label>
                  <pre className="px-4 py-3 bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm rounded-lg overflow-x-auto">
                    {selectedMock.pattern}
                  </pre>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Mock Response
                  </label>
                  <pre className="px-4 py-3 bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm rounded-lg overflow-x-auto max-h-64">
                    {JSON.stringify(selectedMock.response, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <div
                      className={`px-4 py-3 rounded-lg ${
                        selectedMock.enabled
                          ? "bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200"
                          : "bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200"
                      }`}
                    >
                      {selectedMock.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Usage Count
                    </label>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {selectedMock.usageCount || 0} times
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowMockDetails(false)}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mocks List */}
      {filteredMocks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🗄️</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {safeMocks.length === 0
                ? "No database mocks created yet"
                : `No mocks found for ${
                    selectedProxy === "all"
                      ? "selected filter"
                      : safeProxies.find(
                          (p) => p.port.toString() === selectedProxy
                        )?.name || `Port ${selectedProxy}`
                  }`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {safeMocks.length === 0
                ? "Create mocks to intercept database queries during testing."
                : selectedProxy !== "all"
                ? "Try selecting a different proxy or create a new mock for this proxy."
                : "No mocks match the current filter."}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Your First Mock
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === "families" ? (
            // Family View: Group by SQL Command Type
            <div className="space-y-4">
              {Object.values(mocksByCommandType).map((typeGroup) => (
                <div key={typeGroup.name} className="border rounded-lg">
                  {/* Command Type Level */}
                  <div className="bg-blue-50 dark:bg-blue-900 p-4 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors border-b">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 flex-1"
                        onClick={() => toggleGroup(`type-${typeGroup.name}`)}
                      >
                        <span className="text-2xl">
                          {getSQLCommandIcon(typeGroup.name)}
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {typeGroup.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {typeGroup.count} mocks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFamily(typeGroup.name, typeGroup.mocks);
                          }}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                          title={`Delete all ${typeGroup.count} mocks in ${typeGroup.name} family`}
                        >
                          <MdDeleteForever className="text-xl" />
                        </button>
                        <span className="text-gray-500">
                          {expandedGroups.has(`type-${typeGroup.name}`) ? (
                            <MdFolder className="text-xl" />
                          ) : (
                            <MdPlayArrow className="text-xl" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mock Level */}
                  {expandedGroups.has(`type-${typeGroup.name}`) && (
                    <div className="p-2 space-y-1">
                      {typeGroup.mocks.map((mock) =>
                        renderMockCard(mock, true)
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // List View
            filteredMocks.map((mock) => renderMockCard(mock, false))
          )}
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={hideToast}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, mock: null })}
        onConfirm={handleConfirmMockDelete}
        title="Remove Database Mock"
        itemName={
          deleteModal.mock?.name ||
          (deleteModal.mock ? `Mock for ${deleteModal.mock.pattern}` : "")
        }
        itemType="item"
        description={
          deleteModal.mock
            ? `${
                deleteModal.mock.protocol?.toUpperCase() || "DATABASE"
              } • Port ${deleteModal.mock.proxyPort}`
            : ""
        }
        consequences={[
          "The mock configuration will be permanently removed",
          "All associated pattern matching will stop working",
          "Queries matching this pattern will reach the real database",
          "This action cannot be undone",
        ]}
      />

      {/* Delete Family Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteFamilyModal.isOpen}
        onClose={() =>
          setDeleteFamilyModal({
            isOpen: false,
            familyName: null,
            familyMocks: [],
          })
        }
        onConfirm={handleConfirmFamilyDelete}
        title="Delete Mock Family"
        itemName={
          deleteFamilyModal.familyName
            ? `${deleteFamilyModal.familyName} Family`
            : ""
        }
        itemType="data"
        description={
          deleteFamilyModal.familyMocks
            ? `${deleteFamilyModal.familyMocks.length} database mocks`
            : ""
        }
        consequences={[
          "All mocks in this family will be permanently removed",
          "All associated pattern matching for this SQL command type will stop working",
          "Queries matching these patterns will reach the real database",
          "This action cannot be undone",
        ]}
      />
    </div>
  );
}

export default DatabaseMocksView;
