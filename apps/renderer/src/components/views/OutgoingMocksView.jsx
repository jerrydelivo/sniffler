import { useState, useEffect } from "react";
import {
  MdVisibility,
  MdDelete,
  MdList,
  MdFolder,
  MdPause,
  MdPlayArrow,
  MdClose,
  MdContentCopy,
  MdStorage,
  MdDeleteForever,
} from "react-icons/md";
import Toast from "../common/Toast";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import {
  groupMocksByFamily,
  getMockFamilyDisplayName,
  getMockSubfamilies,
} from "../../utils/requestFamilies";
import { formatContent, isBinaryContent } from "../../utils/helpers";

function OutgoingMocksView({ mocks, proxies, onRefreshMocks }) {
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info",
  });
  const [selectedProxy, setSelectedProxy] = useState("all");
  const [formProxyPort, setFormProxyPort] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState("families"); // Default to families
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());
  const [expandedSubfolders, setExpandedSubfolders] = useState(new Set());
  const [showMockDetailsModal, setShowMockDetailsModal] = useState(false);
  const [selectedMockForDetails, setSelectedMockForDetails] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, mock: null });
  const [deleteFamilyModal, setDeleteFamilyModal] = useState({
    isOpen: false,
    familyName: null,
    familyMocks: [],
  });
  const [formData, setFormData] = useState({
    method: "GET",
    url: "",
    statusCode: 200,
    headers: '{\n  "Content-Type": "application/json"\n}',
    body: '{\n  "message": "Mock response"\n}',
    name: "",
  });

  useEffect(() => {
    // Set default selected proxy when proxies are available
    if (proxies.length > 0) {
      if (!selectedProxy || selectedProxy === "") {
        setSelectedProxy("all");
      }
      if (!formProxyPort) {
        setFormProxyPort(proxies[0].port.toString());
      }
    }
  }, [proxies, selectedProxy, formProxyPort]);

  // Function to detect if proxies are database-related
  const isDatabaseProxy = (proxy) => {
    if (!proxy) return false;

    // Check if proxy has protocol property (direct database proxy)
    if (
      proxy.protocol &&
      [
        "postgresql",
        "mysql",
        "mongodb",
        "sqlserver",
        "postgres",
        "mongo",
        "mssql",
      ].includes(proxy.protocol.toLowerCase())
    ) {
      return true;
    }

    // Check targetUrl for common database ports and patterns
    if (proxy.targetUrl) {
      const url = proxy.targetUrl.toLowerCase();
      // Common database ports
      const dbPorts = [
        ":5432",
        ":3306",
        ":27017",
        ":1433",
        ":1521",
        ":6379",
        ":9042",
      ];
      if (dbPorts.some((port) => url.includes(port))) {
        return true;
      }

      // Common database hostnames/patterns
      const dbPatterns = [
        "postgres",
        "mysql",
        "mongo",
        "redis",
        "cassandra",
        "oracle",
        "sqlserver",
        "database",
        "db.",
      ];
      if (dbPatterns.some((pattern) => url.includes(pattern))) {
        return true;
      }
    }

    return false;
  };

  // Function to check if any of the current proxies are database proxies
  const hasDatabaseProxies = () => {
    return proxies.some((proxy) => isDatabaseProxy(proxy));
  };

  // Auto-select family view for database proxies
  useEffect(() => {
    if (proxies.length > 0 && hasDatabaseProxies()) {
      setViewMode("families");
    }
  }, [proxies]);

  // Ensure mocks is always an array to prevent errors
  const safeMocks = Array.isArray(mocks) ? mocks : [];

  // Filter mocks based on selected proxy
  const filteredMocks =
    selectedProxy === "all"
      ? safeMocks
      : safeMocks.filter(
          (mock) => mock && mock.proxyPort === parseInt(selectedProxy)
        );

  // Group mocks by family when in family view
  const mockFamilies =
    viewMode === "families" ? groupMocksByFamily(filteredMocks) : [];

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

    const addPathsRecursively = (family, basePath = "") => {
      const currentPath = basePath
        ? `${basePath}/${family.basePath}`
        : family.basePath;
      paths.add(currentPath);

      if (family.subfamilies) {
        Object.values(family.subfamilies).forEach((subfamily) => {
          addPathsRecursively(subfamily, currentPath);
        });
      }
    };

    families.forEach((family) => {
      paths.add(family.basePath);
      if (family.subfamilies) {
        Object.values(family.subfamilies).forEach((subfamily) => {
          addPathsRecursively(subfamily, family.basePath);
        });
      }
    });

    return paths;
  };

  // Remove the loadMocks function since mocks are passed as props
  // and managed by the parent component

  // Proxies are loaded by the parent component and passed as props

  // Recursive function to render subfamilies with unlimited nesting
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
                {subfamily.hasNestedSubfamilies && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {isSubfolderExpanded
                      ? "Click to collapse"
                      : "Click to expand"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Render mocks in this subfolder */}
          {(subfamily.isSubPath ? isSubfolderExpanded : true) && (
            <div className="space-y-3">
              {subfamily.mocks.map((mock) => renderMockCard(mock, true))}

              {/* Recursively render nested subfamilies */}
              {subfamily.subfamilies &&
                Object.keys(subfamily.subfamilies).length > 0 &&
                renderSubfamilies(
                  Object.values(subfamily.subfamilies).map(
                    (nestedSubfamily) => ({
                      ...nestedSubfamily,
                      isSubPath: true,
                      subName: nestedSubfamily.basePath || "Unnamed",
                      hasNestedSubfamilies:
                        nestedSubfamily.subfamilies &&
                        Object.keys(nestedSubfamily.subfamilies).length > 0,
                    })
                  ),
                  subfolderPath,
                  level + 1
                )}
            </div>
          )}
        </div>
      );
    });
  };

  const renderMockCard = (mock, isInFamily = false) => (
    <div
      key={mock.id}
      data-testid={`outgoing-mock-card-${mock.method}-${(
        mock.url || ""
      ).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${
        isInFamily ? "ml-4 border-l-4 border-blue-200 dark:border-blue-800" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Mock Details - Left Side */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`font-medium px-2 py-1 rounded text-xs ${
                mock.method === "GET"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : mock.method === "POST"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : mock.method === "PUT"
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                  : mock.method === "DELETE"
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
              }`}
            >
              {mock.method}
            </span>
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                mock.enabled
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
              }`}
            >
              {mock.enabled ? "Enabled" : "Disabled"}
            </span>
            <span
              className="text-xs sm:text-sm text-gray-500 dark:text-gray-400"
              data-testid="outgoing-mock-status-code"
            >
              Status: {mock.statusCode}
            </span>
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              data-testid="outgoing-mock-proxy-port"
            >
              Port: {mock.proxyPort}
            </span>
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              data-testid="outgoing-mock-created-at"
            >
              Created:{" "}
              {new Date(mock.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>

          <h3
            className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1"
            data-testid="outgoing-mock-title"
          >
            {mock.name || `${mock.method} ${mock.url}`}
          </h3>
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
    console.log("viewMockDetails called with mock:", mock);
    console.log("Mock headers:", mock?.headers);
    console.log("Mock headers type:", typeof mock?.headers);
    setSelectedMockForDetails(mock);
    setShowMockDetailsModal(true);
  };

  const closeMockDetailsModal = () => {
    setShowMockDetailsModal(false);
    setSelectedMockForDetails(null);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard", "success");
    } catch (error) {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const formatJsonForDisplay = (jsonString) => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch (error) {
      return jsonString;
    }
  };

  const isDatabaseMock = (mock) => {
    if (!mock) return false;

    // Check if the mock is for a database proxy
    const proxy = proxies.find((p) => p.port === mock.proxyPort);
    return isDatabaseProxy(proxy);
  };

  const removeMock = async (mock) => {
    setDeleteModal({ isOpen: true, mock });
  };

  const handleConfirmMockDelete = async () => {
    const mock = deleteModal.mock;
    if (!mock) return;

    try {
      const result = await window.electronAPI.removeOutgoingMock({
        proxyPort: mock.proxyPort,
        method: mock.method,
        url: mock.url,
      });
      if (result.success) {
        closeMockDetailsModal(); // Close modal if open
        onRefreshMocks();
        showToast("Mock removed", "success");

        // Close delete modal
        setDeleteModal({ isOpen: false, mock: null });
      }
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
        await window.electronAPI.removeOutgoingMock({
          proxyPort: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
      }

      closeMockDetailsModal(); // Close modal if open
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
      const result = await window.electronAPI.toggleOutgoingMock({
        proxyPort: mock.proxyPort,
        method: mock.method,
        url: mock.url,
      });
      if (result.success) {
        onRefreshMocks();
        showToast(`Mock ${mock.enabled ? "disabled" : "enabled"}`, "success");

        // Update the selected mock for details if it's the same mock
        if (
          selectedMockForDetails &&
          selectedMockForDetails.proxyPort === mock.proxyPort &&
          selectedMockForDetails.method === mock.method &&
          selectedMockForDetails.url === mock.url
        ) {
          setSelectedMockForDetails({
            ...selectedMockForDetails,
            enabled: !mock.enabled,
          });
        }
      } else {
        showToast("Failed to toggle mock", "error");
      }
    } catch (error) {
      showToast("Failed to toggle mock", "error");
    }
  };

  const handleCreateMock = async (e) => {
    e.preventDefault();

    if (!formProxyPort) {
      showToast("Please select a proxy", "error");
      return;
    }

    try {
      const headers = JSON.parse(formData.headers);

      const result = await window.electronAPI.addOutgoingMock({
        proxyPort: parseInt(formProxyPort),
        method: formData.method,
        url: formData.url,
        response: {
          statusCode: parseInt(formData.statusCode),
          headers: headers,
          body: formData.body,
          name: formData.name || `${formData.method} ${formData.url}`,
          enabled: true,
        },
      });

      if (result.success) {
        setShowCreateForm(false);
        // Refresh the mocks data to ensure it appears in UI immediately
        onRefreshMocks();
        setFormData({
          method: "GET",
          url: "",
          statusCode: 200,
          headers: '{\n  "Content-Type": "application/json"\n}',
          body: '{\n  "message": "Mock response"\n}',
          name: "",
        });
        showToast("Outgoing mock created", "success");
      } else {
        showToast(`Failed to create mock: ${result.error}`, "error");
      }
    } catch (error) {
      showToast("Invalid JSON in headers: " + error.message, "error");
    }
  };

  const handleEnableAllMocks = async () => {
    if (!window.electronAPI) {
      showToast("API not available", "error");
      return;
    }

    const disabledMocks = filteredMocks.filter((mock) => !mock.enabled);
    if (disabledMocks.length === 0) {
      showToast("All visible mocks are already enabled", "info");
      return;
    }

    try {
      showToast(`Enabling ${disabledMocks.length} mocks...`, "info");

      for (const mock of disabledMocks) {
        await window.electronAPI.toggleOutgoingMock({
          proxyPort: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
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
      showToast("All visible mocks are already disabled", "info");
      return;
    }

    try {
      showToast(`Disabling ${enabledMocks.length} mocks...`, "info");

      for (const mock of enabledMocks) {
        await window.electronAPI.toggleOutgoingMock({
          proxyPort: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
      }

      showToast(`✅ Disabled ${enabledMocks.length} mocks`, "success");
      onRefreshMocks();
    } catch (error) {
      showToast(`❌ Failed to disable mocks: ${error.message}`, "error");
    }
  };

  const groupedMocks = safeMocks.reduce((acc, mock) => {
    if (!acc[mock.proxyPort]) {
      acc[mock.proxyPort] = [];
    }
    acc[mock.proxyPort].push(mock);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Outgoing Request Mocks ({filteredMocks.length})
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Mock responses for outgoing proxy requests during testing
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
                title="Enable all mocks"
              >
                Enable All
              </button>
              <button
                onClick={handleDisableAllMocks}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm"
                title="Disable all mocks"
              >
                Disable All
              </button>
            </>
          )}
        </div>
      </div>

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
                  {safeMocks.length}
                </span>
              </button>
              {proxies.map((proxy) => {
                const proxyMocks = safeMocks.filter(
                  (mock) => mock && mock.proxyPort === proxy.port
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
          {viewMode === "families" && mockFamilies.length > 0 && (
            <>
              <button
                onClick={() => {
                  const allFamilyPaths = mockFamilies.map((f) => f.basePath);
                  const allSubfolderPaths = getAllFolderPaths(mockFamilies);
                  setExpandedFamilies(new Set(allFamilyPaths));
                  setExpandedSubfolders(allSubfolderPaths);
                }}
                className="px-3 py-1.5 rounded text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Expand All
              </button>
              <button
                onClick={() => {
                  setExpandedFamilies(new Set());
                  setExpandedSubfolders(new Set());
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
                  Create Outgoing Mock
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
                    value={formProxyPort}
                    onChange={(e) => setFormProxyPort(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="" disabled>
                      Select a proxy
                    </option>
                    {proxies.map((proxy) => (
                      <option key={proxy.port} value={proxy.port}>
                        Port {proxy.port} - {proxy.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Method
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) =>
                        setFormData({ ...formData, method: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {["GET", "POST", "PUT", "DELETE", "PATCH"].map(
                        (method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Status Code
                    </label>
                    <input
                      type="number"
                      value={formData.statusCode}
                      onChange={(e) =>
                        setFormData({ ...formData, statusCode: e.target.value })
                      }
                      min="100"
                      max="599"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    URL Path
                  </label>
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="/api/users"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Mock Name (Optional)
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

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Response Headers (JSON)
                  </label>
                  <textarea
                    value={formData.headers}
                    onChange={(e) =>
                      setFormData({ ...formData, headers: e.target.value })
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Response Body
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={(e) =>
                      setFormData({ ...formData, body: e.target.value })
                    }
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm"
                    placeholder="Response body content"
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

      {/* Mock Details Modal - Compact Version */}
      {showMockDetailsModal && selectedMockForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Compact Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium px-2 py-1 rounded text-xs ${
                    selectedMockForDetails?.method === "GET"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : selectedMockForDetails?.method === "POST"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : selectedMockForDetails?.method === "PUT"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                      : selectedMockForDetails?.method === "DELETE"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  {selectedMockForDetails?.method}
                </span>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    selectedMockForDetails?.enabled
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {selectedMockForDetails?.enabled ? "ON" : "OFF"}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {selectedMockForDetails?.name || selectedMockForDetails?.url}
                </span>
              </div>
              <button
                onClick={closeMockDetailsModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <MdClose className="text-lg" />
              </button>
            </div>

            {/* Compact Content */}
            <div className="p-3">
              <div className="space-y-3 overflow-y-auto max-h-[calc(70vh-140px)]">
                {/* Condensed Info Row */}
                <div className="flex items-center gap-4 text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <span className="font-mono text-gray-600 dark:text-gray-300 truncate flex-1">
                    {selectedMockForDetails?.url}
                  </span>
                  <span
                    className={`px-2 py-1 rounded font-medium ${
                      selectedMockForDetails?.statusCode >= 200 &&
                      selectedMockForDetails?.statusCode < 300
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : selectedMockForDetails?.statusCode >= 400
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    }`}
                  >
                    {selectedMockForDetails?.statusCode}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    :{selectedMockForDetails?.proxyPort}
                  </span>
                </div>

                {/* Compact Headers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Headers
                    </span>
                    <button
                      onClick={() => {
                        try {
                          const headers = selectedMockForDetails?.headers;
                          let headersString;
                          if (typeof headers === "string") {
                            headersString = formatJsonForDisplay(headers);
                          } else if (
                            typeof headers === "object" &&
                            headers !== null
                          ) {
                            headersString = JSON.stringify(headers, null, 2);
                          } else {
                            headersString = "{}";
                          }
                          copyToClipboard(headersString);
                        } catch (error) {
                          copyToClipboard(
                            JSON.stringify(
                              selectedMockForDetails?.headers || {},
                              null,
                              2
                            )
                          );
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                      title="Copy"
                    >
                      <MdContentCopy className="text-xs" />
                    </button>
                  </div>
                  <div className="bg-gray-900 dark:bg-black rounded p-2 max-h-32 overflow-y-auto">
                    <pre className="text-cyan-400 text-xs font-mono">
                      {(() => {
                        try {
                          const headers = selectedMockForDetails?.headers;
                          if (typeof headers === "string") {
                            return formatJsonForDisplay(headers);
                          } else if (
                            typeof headers === "object" &&
                            headers !== null
                          ) {
                            return JSON.stringify(headers, null, 2);
                          } else {
                            return "{}";
                          }
                        } catch (error) {
                          return JSON.stringify(
                            selectedMockForDetails?.headers || {},
                            null,
                            2
                          );
                        }
                      })()}
                    </pre>
                  </div>
                </div>

                {/* Compact Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Response Body
                    </span>
                    <button
                      onClick={() => {
                        const bodyContent = selectedMockForDetails?.body || "";
                        const contentType = (() => {
                          try {
                            const headers = selectedMockForDetails?.headers;
                            if (
                              typeof headers === "object" &&
                              headers !== null
                            ) {
                              return (
                                headers["content-type"] ||
                                headers["Content-Type"] ||
                                ""
                              );
                            } else if (typeof headers === "string") {
                              const parsed = JSON.parse(headers);
                              return (
                                parsed["content-type"] ||
                                parsed["Content-Type"] ||
                                ""
                              );
                            }
                            return "";
                          } catch {
                            return "";
                          }
                        })();
                        copyToClipboard(
                          formatContent(bodyContent, contentType)
                        );
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                      title="Copy"
                    >
                      <MdContentCopy className="text-xs" />
                    </button>
                  </div>
                  <div className="bg-gray-900 dark:bg-black rounded p-2 max-h-32 overflow-y-auto">
                    <pre className="text-green-400 text-xs font-mono">
                      {(() => {
                        const bodyContent = selectedMockForDetails?.body || "";
                        const contentType = (() => {
                          try {
                            const headers = selectedMockForDetails?.headers;
                            if (
                              typeof headers === "object" &&
                              headers !== null
                            ) {
                              return (
                                headers["content-type"] ||
                                headers["Content-Type"] ||
                                ""
                              );
                            } else if (typeof headers === "string") {
                              const parsed = JSON.parse(headers);
                              return (
                                parsed["content-type"] ||
                                parsed["Content-Type"] ||
                                ""
                              );
                            }
                            return "";
                          } catch {
                            return "";
                          }
                        })();

                        const formatted = formatContent(
                          bodyContent,
                          contentType
                        );
                        const isBinary = isBinaryContent(formatted);

                        return (
                          <span
                            className={
                              isBinary ? "text-yellow-400" : "text-green-400"
                            }
                          >
                            {formatted || "No response body"}
                          </span>
                        );
                      })()}
                    </pre>
                  </div>
                </div>

                {/* Database Badge (if applicable) */}
                {isDatabaseMock(selectedMockForDetails) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <MdStorage className="text-blue-600 dark:text-blue-400 text-sm" />
                      <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                        Database Mock
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Footer */}
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                <button
                  onClick={() => toggleMock(selectedMockForDetails)}
                  className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                    selectedMockForDetails?.enabled
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  {selectedMockForDetails?.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => removeMock(selectedMockForDetails)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={closeMockDetailsModal}
                  className="ml-auto px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium transition-colors"
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
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {selectedProxy === "all"
                ? "No outgoing mocks created yet"
                : "No mocks for this proxy"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {selectedProxy === "all"
                ? "Create mocks to intercept outgoing requests during testing."
                : "Create mocks for this proxy to intercept its outgoing requests."}
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
          {viewMode === "families"
            ? // Family View
              mockFamilies.map((family, familyIndex) => {
                const familyKey = family.basePath;
                const isExpanded = expandedFamilies.has(familyKey);
                const subfamilies = getMockSubfamilies(family);

                return (
                  <div key={familyKey} className="space-y-3">
                    {/* Family Header */}
                    <div
                      className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => toggleFamilyExpansion(familyKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">
                            {isExpanded ? "📂" : "📁"}
                          </span>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">
                              {getMockFamilyDisplayName(family)}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {(() => {
                                const directMocks = family.mocks
                                  ? family.mocks.length
                                  : 0;
                                const totalMocks = family.count;
                                const nestedMocks = totalMocks - directMocks;

                                if (directMocks > 0 && nestedMocks > 0) {
                                  return `${directMocks} direct, ${nestedMocks} in subfolders`;
                                } else if (directMocks > 0) {
                                  return `${directMocks} direct`;
                                } else {
                                  return `${nestedMocks} in subfolders`;
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Get all mocks from this family including nested ones
                              const allFamilyMocks = [];
                              const collectMocks = (subfamily) => {
                                if (subfamily.mocks) {
                                  allFamilyMocks.push(...subfamily.mocks);
                                }
                                if (subfamily.subfamilies) {
                                  Object.values(subfamily.subfamilies).forEach(
                                    collectMocks
                                  );
                                }
                              };
                              collectMocks(family);
                              handleDeleteFamily(
                                family.basePath,
                                allFamilyMocks
                              );
                            }}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title={`Delete all ${family.count} mocks in ${family.basePath} family`}
                          >
                            <MdDeleteForever className="text-xl" />
                          </button>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {isExpanded
                              ? "Click to collapse"
                              : "Click to expand"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Family Mocks */}
                    {isExpanded && (
                      <div className="space-y-3 ml-4">
                        {renderSubfamilies(subfamilies)}
                      </div>
                    )}
                  </div>
                );
              })
            : // List View
              filteredMocks.map((mock) => renderMockCard(mock, false))}
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
        title="Remove Outgoing Mock"
        itemName={
          deleteModal.mock?.name ||
          (deleteModal.mock
            ? `${deleteModal.mock.method} ${deleteModal.mock.url}`
            : "")
        }
        itemType="item"
        description={
          deleteModal.mock ? `Port ${deleteModal.mock.proxyPort}` : ""
        }
        consequences={[
          "The mock configuration will be permanently removed",
          "Requests matching this pattern will reach the real target server",
          "All associated response data will be deleted",
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
            ? `${deleteFamilyModal.familyMocks.length} outgoing request mocks`
            : ""
        }
        consequences={[
          "All mocks in this family will be permanently removed",
          "All associated URL pattern matching will stop working",
          "Requests matching these patterns will reach the real target server",
          "This action cannot be undone",
        ]}
      />
    </div>
  );
}

export default OutgoingMocksView;
