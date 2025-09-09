import { useState, useEffect } from "react";
import {
  MdVisibility,
  MdDelete,
  MdList,
  MdPause,
  MdPlayArrow,
  MdFolder,
  MdRefresh,
  MdDeleteForever,
} from "react-icons/md";
import MockDetailModal from "../modals/MockDetailModal";
import CreateMockModal from "../modals/CreateMockModal";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import Toast from "../common/Toast";
import {
  groupMocksByFamily,
  getMockFamilyDisplayName,
  getMockSubfamilies,
} from "../../utils/requestFamilies";

function MocksView({ mocks, onRefreshMocks, hideHeader = false }) {
  const [selectedMock, setSelectedMock] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState("families"); // Default to families
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());
  const [expandedSubfolders, setExpandedSubfolders] = useState(new Set()); // Track nested folder expansion
  const [toast, setToast] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [deleteFamilyModal, setDeleteFamilyModal] = useState({
    isOpen: false,
    familyName: null,
    familyMocks: [],
  });

  const showToast = (message, type = "info") => {
    setToast({ isOpen: true, message, type });
  };

  // Load settings to get default view mode
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.getSettings();
          if (result.success && result.settings?.defaultMockViewMode) {
            setViewMode(result.settings.defaultMockViewMode);
          }
        }
      } catch (error) {}
    };

    loadViewMode();
  }, []);

  // Group mocks by family when in family view
  const mockFamilies = viewMode === "families" ? groupMocksByFamily(mocks) : [];

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
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 ${
        isInFamily ? "ml-4 border-l-4 border-blue-200 dark:border-blue-800" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Mock Details - Left Side */}
        <div className="flex-1 min-w-0">
          {/* Mock Details */}
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
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Status: {mock.statusCode}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Port: {mock.proxyPort}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Created: {new Date(mock.createdAt).toLocaleDateString()}
            </span>
            {mock.tags && mock.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {mock.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-1">
            {mock.name || `${mock.method} ${mock.url}`}
          </h3>
        </div>

        {/* Buttons - Right Side */}
        <div className="flex gap-2">
          {/* Resend Button */}
          <button
            onClick={() => handleRepeatSendRequest(mock)}
            className="flex items-center justify-center w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            title="Resend the original request"
          >
            <MdRefresh className="text-lg" />
          </button>

          <button
            onClick={() => setSelectedMock(mock)}
            className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
            title="View mock details"
          >
            <MdVisibility />
          </button>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleToggleMock(mock)}
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
              onClick={() => handleDeleteMock(mock)}
              className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm"
              title="Delete mock"
            >
              <MdDelete />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleToggleMock = async (mock) => {
    if (window.electronAPI) {
      const result = await window.electronAPI.toggleMock({
        port: mock.proxyPort,
        method: mock.method,
        url: mock.url,
      });

      if (result.success) {
        if (onRefreshMocks) {
          onRefreshMocks();
        }
      } else {
        alert(`Failed to toggle mock: ${result.error}`);
      }
    }
  };

  const handleDeleteMock = async (mock) => {
    if (
      confirm(
        `Are you sure you want to delete the mock for ${mock.method} ${mock.url}?`
      )
    ) {
      if (window.electronAPI) {
        const result = await window.electronAPI.removeMock({
          port: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });

        if (result.success) {
          if (onRefreshMocks) {
            onRefreshMocks();
          }
        } else {
          alert(`Failed to delete mock: ${result.error}`);
        }
      }
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
        await window.electronAPI.removeMock({
          port: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
      }

      if (onRefreshMocks) {
        onRefreshMocks();
      }
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

  const handleRepeatSendRequest = async (mock) => {
    if (!window.electronAPI) {
      showToast("Cannot send request: API not available", "error");
      return;
    }

    try {
      showToast("Sending request...", "info");

      // Reconstruct the original request from the mock data
      const requestData = {
        port: mock.proxyPort,
        method: mock.method,
        url: mock.url,
        headers: mock.originalRequestHeaders || {
          "Content-Type": "application/json",
        },
        body: mock.originalRequestBody || undefined,
      };

      const result = await window.electronAPI.sendRequest(requestData);

      if (result.success) {
        const statusCode = result.response.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 400;
        showToast(
          `✅ Request sent successfully! Status: ${statusCode}`,
          isSuccess ? "success" : "warning"
        );
      } else {
        showToast(`❌ Failed to send request: ${result.error}`, "error");
      }
    } catch (error) {
      showToast(`❌ Error sending request: ${error.message}`, "error");
    }
  };

  const handleEnableAllMocks = async () => {
    if (!window.electronAPI) {
      showToast("API not available", "error");
      return;
    }

    const disabledMocks = mocks.filter((mock) => !mock.enabled);
    if (disabledMocks.length === 0) {
      showToast("All mocks are already enabled", "info");
      return;
    }

    try {
      showToast(`Enabling ${disabledMocks.length} mocks...`, "info");

      for (const mock of disabledMocks) {
        await window.electronAPI.toggleMock({
          port: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
      }

      showToast(`✅ Enabled ${disabledMocks.length} mocks`, "success");
      if (onRefreshMocks) {
        onRefreshMocks();
      }
    } catch (error) {
      showToast(`❌ Failed to enable mocks: ${error.message}`, "error");
    }
  };

  const handleDisableAllMocks = async () => {
    if (!window.electronAPI) {
      showToast("API not available", "error");
      return;
    }

    const enabledMocks = mocks.filter((mock) => mock.enabled);
    if (enabledMocks.length === 0) {
      showToast("All mocks are already disabled", "info");
      return;
    }

    try {
      showToast(`Disabling ${enabledMocks.length} mocks...`, "info");

      for (const mock of enabledMocks) {
        await window.electronAPI.toggleMock({
          port: mock.proxyPort,
          method: mock.method,
          url: mock.url,
        });
      }

      showToast(`✅ Disabled ${enabledMocks.length} mocks`, "success");
      if (onRefreshMocks) {
        onRefreshMocks();
      }
    } catch (error) {
      showToast(`❌ Failed to disable mocks: ${error.message}`, "error");
    }
  };

  return (
    <div>
      {!hideHeader && (
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Mocks ({mocks.length})
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Create Mock
              </button>
              <button
                onClick={onRefreshMocks}
                className="bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Refresh
              </button>
              {mocks.length > 0 && (
                <>
                  <button
                    onClick={handleEnableAllMocks}
                    className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                    title="Enable all mocks"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={handleDisableAllMocks}
                    className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-orange-700 text-sm"
                    title="Disable all mocks"
                  >
                    Disable All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          {mocks.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
              {viewMode === "families" && mockFamilies.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const allFamilyPaths = mockFamilies.map(
                        (f) => f.basePath
                      );
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
        </div>
      )}

      {hideHeader && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {mocks.length} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Create Mock
              </button>
              <button
                onClick={onRefreshMocks}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Refresh
              </button>
              {mocks.length > 0 && (
                <>
                  <button
                    onClick={handleEnableAllMocks}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    title="Enable all mocks"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={handleDisableAllMocks}
                    className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                    title="Disable all mocks"
                  >
                    Disable All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* View Mode Toggle for hideHeader mode */}
          {mocks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <MdList className="inline mr-1" /> List
              </button>
              <button
                onClick={() => setViewMode("families")}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === "families"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <MdFolder className="inline mr-1" /> Families
              </button>
            </div>
          )}
        </div>
      )}

      {mocks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="text-center py-6 sm:py-8">
            <div className="text-4xl sm:text-6xl mb-4">🎭</div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
              No mocks created yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Start capturing requests or create one manually to begin mocking
              API responses.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              Create Your First Mock
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {viewMode === "families"
            ? // Family View
              mockFamilies.map((family, familyIndex) => {
                const familyKey = family.basePath; // Use just basePath since we no longer group by method
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
              mocks.map((mock) => renderMockCard(mock, false))}
        </div>
      )}

      {/* Mock Detail Modal */}
      {selectedMock && (
        <MockDetailModal
          mock={selectedMock}
          onClose={() => setSelectedMock(null)}
        />
      )}

      {/* Create Mock Form */}
      {showCreateForm && (
        <CreateMockModal
          onClose={() => setShowCreateForm(false)}
          onRefreshMocks={onRefreshMocks}
        />
      )}

      {/* Toast */}
      <Toast
        show={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
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
            ? `${deleteFamilyModal.familyMocks.length} proxy request mocks`
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

export default MocksView;
