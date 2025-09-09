import { useState, useEffect } from "react";
import { MdVisibility, MdCompare, MdSave } from "react-icons/md";
import RequestDetailModal from "../modals/RequestDetailModal";
import CreateRequestModal from "../modals/CreateRequestModal";
import MockDifferenceModal from "../modals/MockDifferenceModal";
import { getStatusCodeColor } from "../../utils/helpers";

import {
  compareRequestWithMock,
  findMatchingMock,
  getDifferenceSummary,
} from "../../utils/mockComparison";
import Toast from "../common/Toast";

function RequestsView({
  requests,
  onRefreshMocks,
  mocks = [],
  hideHeader = false,
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [selectedDifference, setSelectedDifference] = useState(null);
  const [autoReplaceMocksOnDifference, setAutoReplaceMocksOnDifference] =
    useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // Load settings to get auto-replace setting
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.getSettings();
          if (result.success && result.settings) {
            if (
              result.settings.hasOwnProperty("autoReplaceMocksOnDifference")
            ) {
              setAutoReplaceMocksOnDifference(
                result.settings.autoReplaceMocksOnDifference
              );
            }
          }
        }
      } catch (error) {
        // Failed to load settings - continue with defaults
      }
    };
    loadSettings();
  }, []);

  // Listen for mock difference events
  useEffect(() => {
    if (window.electronAPI) {
      const handleMockDifference = (data) => {
        showToast(
          `⚠️ Response differs from mock for ${data.request.method} ${data.request.url}`,
          "warning"
        );
      };

      const handleMockAutoReplaced = (data) => {
        showToast(
          `🔄 Mock automatically updated for ${data.request.method} ${data.request.url}`,
          "success"
        );
        // Refresh mocks to show the updated data
        if (onRefreshMocks) {
          onRefreshMocks();
        }
      };

      window.electronAPI.onMockDifferenceDetected(handleMockDifference);
      window.electronAPI.onMockAutoReplaced(handleMockAutoReplaced);

      return () => {
        // Clean up event listeners
        try {
          window.electronAPI.removeAllListeners?.("mock-difference-detected");
          window.electronAPI.removeAllListeners?.("mock-auto-replaced");
        } catch (error) {
          // Error removing event listeners - continue
        }
      };
    }
  }, [onRefreshMocks]);

  // Function to get mock comparison for a request
  const getMockComparison = (request) => {
    if (!request || !request.response || !mocks || mocks.length === 0) {
      return null;
    }

    // Check if the request already has mock comparison data from the backend
    if (request.mockComparison) {
      return request.mockComparison;
    }

    // Find matching mock and compare
    const matchingMock = findMatchingMock(request, mocks);
    if (matchingMock) {
      return compareRequestWithMock(request, matchingMock);
    }

    return null;
  };

  // Function to check if a request has differences with its mock
  const hasMatchingMockWithDifferences = (request) => {
    const comparison = getMockComparison(request);
    return comparison && comparison.hasDifferences;
  };

  // Function to get matching mock for a request
  const getMatchingMock = (request) => {
    return findMatchingMock(request, mocks);
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: "", type: "success" });
  };

  const filteredRequests = requests.filter((request) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "success" && request.status === "success") ||
      (filter === "failed" && request.status === "failed") ||
      (filter === "pending" &&
        (!request.status || request.status === "pending")) ||
      (filter === "mock-differences" &&
        hasMatchingMockWithDifferences(request));

    const matchesSearch =
      search === "" ||
      request.url.toLowerCase().includes(search.toLowerCase()) ||
      request.method.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const handleReplaceMock = async (request) => {
    if (!request.response) {
      showToast("Cannot replace mock from request without response", "error");
      return;
    }

    const matchingMock = getMatchingMock(request);
    if (!matchingMock) {
      showToast("No existing mock found to replace", "error");
      return;
    }

    if (window.electronAPI) {
      try {
        // First remove the existing mock
        const removeResult = await window.electronAPI.removeMock({
          port: request.proxyPort,
          method: request.method,
          url: request.url,
        });

        if (!removeResult.success) {
          showToast(
            `Failed to remove existing mock: ${removeResult.error}`,
            "error"
          );
          return;
        }

        // Then add the new mock with the updated response
        const addResult = await window.electronAPI.addMock({
          port: request.proxyPort,
          method: request.method,
          url: request.url,
          response: {
            statusCode: request.response.statusCode,
            headers: request.response.headers,
            body: request.response.body,
            name: `${request.method} ${request.url}`,
            enabled: matchingMock.enabled, // Keep the same enabled state as the old mock
          },
        });

        if (addResult.success) {
          showToast("🔄 Mock replaced successfully!", "success");
          // Refresh mocks in the parent component
          if (onRefreshMocks) {
            await onRefreshMocks();
          }
        } else {
          showToast(
            `Failed to create replacement mock: ${addResult.error}`,
            "error"
          );
        }
      } catch (error) {
        showToast("Failed to replace mock: Network error", "error");
      }
    }
  };

  const handleSaveAsMock = async (request) => {
    if (!request.response) {
      showToast("Cannot create mock from request without response", "error");
      return;
    }

    // Normalize URLs for comparison (remove trailing slash, sort query params)
    const normalizeUrl = (url) => {
      try {
        const urlObj = new URL(url, "http://localhost");
        // Remove trailing slash
        let pathname = urlObj.pathname.replace(/\/$/, "") || "/";
        // Sort query parameters
        const searchParams = new URLSearchParams(urlObj.search);
        searchParams.sort();
        const search = searchParams.toString();
        return pathname + (search ? "?" + search : "");
      } catch {
        // If URL parsing fails, just trim and remove trailing slash
        return url.trim().replace(/\/$/, "") || "/";
      }
    };

    const requestUrl = normalizeUrl(request.url);

    // Check if a mock already exists for this method, URL, and port
    const existingMock = mocks.find(
      (mock) =>
        mock.method === request.method &&
        normalizeUrl(mock.url) === requestUrl &&
        mock.proxyPort === request.proxyPort
    );

    if (existingMock) {
      showToast(
        `Mock already exists for ${request.method} ${request.url} on port ${request.proxyPort}`,
        "warning"
      );
      return;
    }

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.addMock({
          port: request.proxyPort,
          method: request.method,
          url: request.url,
          response: {
            statusCode: request.response.statusCode,
            headers: request.response.headers,
            body: request.response.body,
            name: `${request.method} ${request.url}`,
            enabled: false, // New mocks should be disabled by default
          },
        });

        if (result.success) {
          showToast(`🎭 Mock saved successfully!`, "success");
          // Refresh mocks in the parent component and wait for it
          if (onRefreshMocks) {
            await onRefreshMocks();
          }
        } else {
          if (result.patternBlocked) {
            showToast(`🔄 ${result.error}`, "info");
          } else {
            showToast(`Failed to save mock: ${result.error}`, "error");
          }
        }
      } catch (error) {
        showToast("Failed to save mock: Network error", "error");
      }
    }
  };

  const handleCreateMockFromRequest = async (requestData) => {
    try {
      const result = await window.electronAPI.addMock({
        port: requestData.proxyPort,
        method: requestData.method,
        url: requestData.url,
        response: {
          statusCode: requestData.response.statusCode,
          headers: requestData.response.headers,
          body: requestData.response.body,
          name: `${requestData.method} ${requestData.url}`,
          enabled: false, // New mocks should be disabled by default
        },
      });

      if (result.success) {
        showToast(`🎭 Mock created successfully from request!`, "success");
        // Refresh mocks in the parent component
        if (onRefreshMocks) {
          await onRefreshMocks();
        }
      } else {
        if (result.patternBlocked) {
          showToast(`🔄 ${result.error}`, "info");
        } else {
          showToast(`Failed to create mock: ${result.error}`, "error");
        }
      }
    } catch (error) {
      showToast("Failed to create mock: Network error", "error");
    }
  };

  const handleRefreshRequests = async () => {
    // No need to manually refresh - the real-time event listeners in App.jsx
    // will automatically update the requests list when new requests come in
  };

  const renderRequestRow = (request, index, isSubRequest = false) => {
    const mockComparison = getMockComparison(request);
    const matchingMock = getMatchingMock(request);
    const hasMockDifferences = hasMatchingMockWithDifferences(request);

    // Check for special tags
    const isReplacedRequest = request.tags?.includes("replaced");
    const isMockReplacedRequest = request.tags?.includes("mock-replaced");

    return (
      <tr
        key={request.id || index}
        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
          isSubRequest ? "bg-gray-25 dark:bg-gray-750" : ""
        } ${hasMockDifferences ? "border-l-4 border-orange-400" : ""}`}
      >
        <td className="px-4 py-4 whitespace-nowrap align-middle">
          {isSubRequest && <span className="ml-4 mr-2 text-gray-400">└</span>}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                request.status === "success"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : request.status === "failed"
                  ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  : request.status === "timeout"
                  ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                  : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
              }`}
            >
              {request.status === "success"
                ? "✓ Success"
                : request.status === "failed"
                ? "✗ Failed"
                : request.status === "timeout"
                ? "⏱ Timeout"
                : "⏳ Pending"}
            </span>
            {isReplacedRequest && (
              <span
                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800"
                title="This request was replaced by a newer version"
              >
                🔄 Replaced
              </span>
            )}
            {isMockReplacedRequest && (
              <span
                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                title="This request replaced an existing mock"
              >
                🎭 Mock Updated
              </span>
            )}
            {matchingMock && !isReplacedRequest && !isMockReplacedRequest && (
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  hasMockDifferences
                    ? "bg-orange-100 text-orange-800"
                    : "bg-blue-100 text-blue-800"
                }`}
                title={
                  mockComparison ? mockComparison.summary : "Has matching mock"
                }
              >
                {hasMockDifferences ? "⚠️ Different" : "🎭 Mocked"}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap align-middle">
          <span
            className={`font-mono px-3 py-1.5 rounded text-sm font-bold ${getStatusCodeColor(
              request.response?.statusCode
            )}`}
          >
            {request.response?.statusCode || "-"}
          </span>
        </td>
        <td className="px-4 py-4 whitespace-nowrap align-middle">
          <span
            className={`font-medium px-2 py-1 rounded text-xs ${
              request.method === "GET"
                ? "bg-green-100 text-green-800"
                : request.method === "POST"
                ? "bg-blue-100 text-blue-800"
                : request.method === "PUT"
                ? "bg-orange-100 text-orange-800"
                : request.method === "DELETE"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {request.method}
          </span>
        </td>
        <td className="px-4 py-4 max-w-md align-middle">
          <span className="text-gray-600 dark:text-gray-300 truncate block">
            {request.url}
          </span>
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 align-middle">
          {new Date(request.timestamp).toLocaleTimeString()}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 align-middle">
          {request.duration ? `${request.duration}ms` : "-"}
        </td>
        <td className="flex px-4 py-4 whitespace-nowrap space-x-2 align-middle">
          <button
            onClick={() => setSelectedRequest(request)}
            className="flex items-center justify-center w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 shadow-sm"
            title="View request details"
          >
            <MdVisibility className="text-sm" />
          </button>
          {hasMockDifferences && !isReplacedRequest && (
            <button
              onClick={() =>
                setSelectedDifference({
                  request,
                  mock: matchingMock,
                  comparison: mockComparison,
                })
              }
              className="flex items-center justify-center w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors duration-200 shadow-sm"
              title="View differences"
            >
              <MdCompare className="text-sm" />
            </button>
          )}
          {request.response && request.status === "success" && (
            <>
              {hasMockDifferences ? (
                // Show "Replace as Mock" button for requests with Mock Diff tag
                <button
                  onClick={() => handleReplaceMock(request)}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-md transition-colors duration-200 shadow-sm"
                >
                  � Replace as Mock
                </button>
              ) : matchingMock &&
                !isReplacedRequest &&
                !isMockReplacedRequest ? null : ( // Don't show any green button for requests with Mock tag (matching mock with no differences)
                // Show "Save as Mock" button for requests without matching mocks
                <button
                  onClick={() => handleSaveAsMock(request)}
                  className="flex items-center justify-center w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200 shadow-sm"
                  title="Save as Mock"
                >
                  <MdSave className="text-sm" />
                </button>
              )}
            </>
          )}
        </td>
      </tr>
    );
  };

  const renderMobileCard = (request, index, isSubRequest = false) => {
    const mockComparison = getMockComparison(request);
    const matchingMock = getMatchingMock(request);
    const hasMockDifferences = hasMatchingMockWithDifferences(request);

    // Check for special tags
    const isReplacedRequest = request.tags?.includes("replaced");
    const isMockReplacedRequest = request.tags?.includes("mock-replaced");

    return (
      <div
        key={request.id || index}
        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
          isSubRequest
            ? "ml-4 border-l-2 border-gray-300 dark:border-gray-600"
            : ""
        } ${hasMockDifferences ? "border-l-4 border-orange-400" : ""}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-wrap">
            {isSubRequest && <span className="text-gray-400 mr-2">└</span>}
            <span
              className={`font-medium px-2 py-1 rounded text-xs ${
                request.method === "GET"
                  ? "bg-green-100 text-green-800"
                  : request.method === "POST"
                  ? "bg-blue-100 text-blue-800"
                  : request.method === "PUT"
                  ? "bg-orange-100 text-orange-800"
                  : request.method === "DELETE"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {request.method}
            </span>
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                request.status === "success"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : request.status === "failed"
                  ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  : request.status === "timeout"
                  ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                  : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
              }`}
            >
              {request.status === "success"
                ? "✓ Success"
                : request.status === "failed"
                ? "✗ Failed"
                : request.status === "timeout"
                ? "⏱ Timeout"
                : "⏳ Pending"}
            </span>
            {isReplacedRequest && (
              <span
                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800"
                title="This request was replaced by a newer version"
              >
                🔄 Replaced
              </span>
            )}
            {isMockReplacedRequest && (
              <span
                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                title="This request replaced an existing mock"
              >
                🎭 Mock Updated
              </span>
            )}
            {matchingMock && !isReplacedRequest && !isMockReplacedRequest && (
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  hasMockDifferences
                    ? "bg-orange-100 text-orange-800"
                    : "bg-blue-100 text-blue-800"
                }`}
                title={
                  mockComparison ? mockComparison.summary : "Has matching mock"
                }
              >
                {hasMockDifferences ? "⚠️ Different" : "🎭 Mocked"}
              </span>
            )}
            {request.response?.statusCode && (
              <span
                className={`ml-2 font-mono px-3 py-1.5 rounded text-sm font-bold ${getStatusCodeColor(
                  request.response.statusCode
                )}`}
              >
                {request.response.statusCode}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(request.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
            {request.url}
          </p>
          {request.duration && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Duration: {request.duration}ms
            </p>
          )}
          {hasMockDifferences && mockComparison && !isReplacedRequest && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              {getDifferenceSummary(mockComparison)}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedRequest(request)}
            className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 shadow-sm"
            title="View Details"
          >
            <MdVisibility />
          </button>
          {hasMockDifferences && !isReplacedRequest && (
            <button
              onClick={() =>
                setSelectedDifference({
                  request,
                  mock: matchingMock,
                  comparison: mockComparison,
                })
              }
              className="flex items-center justify-center w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors duration-200 shadow-sm"
              title="View Differences"
            >
              <MdCompare />
            </button>
          )}
          {request.response && request.status === "success" && (
            <>
              {hasMockDifferences ? (
                // Show "Replace as Mock" button for requests with Mock Diff tag
                <button
                  onClick={() => handleReplaceMock(request)}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-md transition-colors duration-200 shadow-sm"
                >
                  � Replace as Mock
                </button>
              ) : matchingMock &&
                !isReplacedRequest &&
                !isMockReplacedRequest ? null : ( // Don't show any green button for requests with Mock tag (matching mock with no differences)
                // Show "Save as Mock" button for requests without matching mocks
                <button
                  onClick={() => handleSaveAsMock(request)}
                  className="flex items-center justify-center w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200 shadow-sm"
                  title="Save as Mock"
                >
                  <MdSave />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {!hideHeader && (
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
          Requests
        </h1>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="flex-shrink-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Requests</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="mock-differences">Mock Differences</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by URL or method..."
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowCreateRequestModal(true)}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <span>🚀</span>
              Send Request
            </button>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={async () => {
                if (
                  window.electronAPI &&
                  confirm(
                    "Are you sure you want to clear all requests? This action cannot be undone."
                  )
                ) {
                  try {
                    // Get all active proxies and clear requests for each
                    const proxies = await window.electronAPI.getProxies();
                    for (const proxy of proxies) {
                      await window.electronAPI.clearRequests(proxy.port);
                    }
                    // Force refresh the parent component
                    window.location.reload();
                  } catch (error) {
                    alert("Failed to clear requests: " + error.message);
                  }
                }
              }}
              className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table - Mobile: Card View, Desktop: Table View */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredRequests.map((request, index) =>
                renderRequestRow(request, index, false)
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden">
          {filteredRequests.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredRequests.map((request, index) =>
                renderMobileCard(request, index, false)
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No requests found
              </p>
            </div>
          )}
        </div>

        {/* Empty State for Desktop */}
        {filteredRequests.length === 0 && (
          <div className="hidden lg:block text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No requests found
            </p>
          </div>
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          mocks={mocks}
          onClose={() => setSelectedRequest(null)}
          onSaveAsMock={handleSaveAsMock}
          onReplaceMock={handleReplaceMock}
        />
      )}

      {/* Create Request Modal */}
      {showCreateRequestModal && (
        <CreateRequestModal
          onClose={() => setShowCreateRequestModal(false)}
          onRefreshRequests={handleRefreshRequests}
          onCreateMock={handleCreateMockFromRequest}
        />
      )}

      {/* Mock Difference Modal */}
      {selectedDifference && (
        <MockDifferenceModal
          request={selectedDifference.request}
          mock={selectedDifference.mock}
          comparison={selectedDifference.comparison}
          onClose={() => setSelectedDifference(null)}
          onMockUpdated={() => {
            setSelectedDifference(null);
            onRefreshMocks();
          }}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={hideToast}
      />
    </div>
  );
}

export default RequestsView;
