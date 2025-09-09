import { useState, useEffect } from "react";
import { formatJson, getStatusCodeColor } from "../../utils/helpers";
import {
  compareRequestWithMock,
  findMatchingMock,
  getDifferenceSummary,
} from "../../utils/mockComparison";

function RequestDetailModal({
  request,
  onClose,
  onSaveAsMock,
  onReplaceMock,
  mocks = [],
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [autoReplaceMocksOnDifference, setAutoReplaceMocksOnDifference] =
    useState(false);

  // Load auto-replace setting
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.getSettings();
          if (
            result.success &&
            result.settings?.hasOwnProperty("autoReplaceMocksOnDifference")
          ) {
            setAutoReplaceMocksOnDifference(
              result.settings.autoReplaceMocksOnDifference
            );
          }
        }
      } catch (error) {
        // console.error("Failed to load auto-replace setting:", error);
      }
    };
    loadSettings();
  }, []);

  // Check for mock comparison
  const matchingMock = findMatchingMock(request, mocks);
  const mockComparison = matchingMock
    ? compareRequestWithMock(request, matchingMock)
    : null;
  const hasMockDifferences = mockComparison?.hasDifferences || false;

  // Determine which tabs to show
  const baseTabs = ["overview", "headers", "body", "response"];
  const tabs = matchingMock ? [...baseTabs, "mock-comparison"] : baseTabs;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900">
          <div className="min-w-0 flex-1 mb-4 sm:mb-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Request Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all font-mono">
              {request.method} {request.url}
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {request.response && request.status === "success" && (
              <>
                {hasMockDifferences ? (
                  // Show "Replace as Mock" button for requests with Mock Diff tag
                  <button
                    onClick={() => onReplaceMock && onReplaceMock(request)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>�</span>
                    Replace as Mock
                  </button>
                ) : matchingMock ? // Don't show any button for requests with Mock tag (matching mock with no differences)
                null : (
                  // Show "Save as Mock" button for requests without matching mocks
                  <button
                    onClick={() => onSaveAsMock(request)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>💾</span>
                    Save as Mock
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <span>✕</span>
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto bg-gray-50 dark:bg-gray-900">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === tab
                  ? "border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              } ${
                tab === "mock-comparison" && hasMockDifferences
                  ? "text-orange-600 dark:text-orange-400"
                  : ""
              }`}
            >
              {tab === "overview" && "📊 Overview"}
              {tab === "headers" && "📋 Headers"}
              {tab === "body" && "📤 Request Body"}
              {tab === "response" && "📥 Response"}
              {tab === "mock-comparison" &&
                `🔍 Mock ${hasMockDifferences ? "Differences" : "Comparison"}`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📤</span>
                    Request Info
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Method
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                        {request.method}
                      </dd>
                    </div>
                    <div className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        URL
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white break-all font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-right max-w-xs">
                        {request.url}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Timestamp
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-mono">
                        {new Date(request.timestamp).toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Proxy Port
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
                        {request.proxyPort}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📥</span>
                    Response Info
                  </h3>
                  {request.response ? (
                    <dl className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Status Code
                        </dt>
                        <dd
                          className={`font-mono px-3 py-1.5 rounded text-base font-bold inline-block ${getStatusCodeColor(
                            request.response.statusCode
                          )}`}
                        >
                          {request.response.statusCode}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Status Message
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {request.response.statusMessage}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Duration
                        </dt>
                        <dd className="text-sm font-bold text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                          {request.duration}ms
                        </dd>
                      </div>
                      <div className="flex justify-between items-start py-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Content Type
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white break-all bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-right max-w-xs">
                          {request.response.headers["content-type"] ||
                            "Unknown"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-2 block">❌</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No response received
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "headers" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📤</span>
                  Request Headers
                </h3>
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 sm:p-4 overflow-auto border border-gray-300 dark:border-gray-600">
                  <pre className="text-xs sm:text-sm text-green-400 whitespace-pre-wrap font-mono">
                    {JSON.stringify(request.headers, null, 2)}
                  </pre>
                </div>
              </div>
              {request.response && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📥</span>
                    Response Headers
                  </h3>
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 sm:p-4 overflow-auto border border-gray-300 dark:border-gray-600">
                    <pre className="text-xs sm:text-sm text-green-400 whitespace-pre-wrap font-mono">
                      {JSON.stringify(request.response.headers, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "body" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">📤</span>
                Request Body
              </h3>
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 sm:p-4 overflow-auto border border-gray-300 dark:border-gray-600">
                <pre className="text-xs sm:text-sm text-green-400 whitespace-pre-wrap font-mono">
                  {request.body ? formatJson(request.body) : "No body data"}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "response" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">📥</span>
                Response Body
              </h3>
              {request.response ? (
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 sm:p-4 overflow-auto border border-gray-300 dark:border-gray-600">
                  <pre className="text-xs sm:text-sm text-green-400 whitespace-pre-wrap font-mono">
                    {request.response.body
                      ? formatJson(request.response.body)
                      : "No response body"}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">❌</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No response received
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "mock-comparison" && matchingMock && (
            <div className="space-y-6">
              {/* Comparison Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🔍</span>
                  Mock Comparison Summary
                </h3>

                <div
                  className={`p-4 rounded-lg border ${
                    hasMockDifferences
                      ? "bg-orange-50 border-orange-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {hasMockDifferences ? "⚠️" : "✅"}
                    </span>
                    <span className="font-medium text-gray-900">
                      {mockComparison
                        ? mockComparison.summary
                        : "No comparison available"}
                    </span>
                  </div>
                  {hasMockDifferences && mockComparison && (
                    <p className="text-sm text-gray-700">
                      {getDifferenceSummary(mockComparison)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div
                    className={`p-4 rounded-lg border ${
                      mockComparison?.statusCodeMatches
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {mockComparison?.statusCodeMatches ? "✅" : "❌"}
                      </span>
                      <span className="font-medium">Status Code</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Actual: {request.response?.statusCode} | Mock:{" "}
                      {matchingMock.statusCode}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${
                      mockComparison?.headersMatch
                        ? "bg-green-50 border-green-200"
                        : "bg-orange-50 border-orange-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {mockComparison?.headersMatch ? "✅" : "⚠️"}
                      </span>
                      <span className="font-medium">Headers</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {mockComparison?.headersMatch ? "Match" : "Differ"}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${
                      mockComparison?.bodyMatches
                        ? "bg-green-50 border-green-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {mockComparison?.bodyMatches ? "✅" : "📝"}
                      </span>
                      <span className="font-medium">Body</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {mockComparison?.bodyMatches ? "Matches" : "Different"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mock Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🎭</span>
                  Mock Details
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Mock Name
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white mt-1">
                      {matchingMock.name ||
                        `${matchingMock.method} ${matchingMock.url}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white mt-1">
                      {matchingMock.enabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Created
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white mt-1">
                      {matchingMock.createdAt
                        ? new Date(matchingMock.createdAt).toLocaleString()
                        : "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tags
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white mt-1">
                      {matchingMock.tags?.length
                        ? matchingMock.tags.join(", ")
                        : "None"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Detailed Differences */}
              {hasMockDifferences &&
                mockComparison &&
                mockComparison.differences.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      Detailed Differences
                    </h3>
                    <div className="space-y-4">
                      {mockComparison.differences.map((diff, index) => (
                        <div
                          key={index}
                          className="p-4 border border-orange-200 rounded-lg bg-orange-50"
                        >
                          <h4 className="font-medium text-gray-900 mb-2">
                            {diff.field}
                          </h4>
                          <p className="text-sm text-gray-700 mb-3">
                            {diff.message}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                Expected (Mock)
                              </p>
                              <div className="bg-gray-100 p-2 rounded text-xs font-mono overflow-auto max-h-32">
                                {typeof diff.expected === "string" &&
                                diff.expected.length > 200
                                  ? `${diff.expected.substring(0, 200)}...`
                                  : String(diff.expected)}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                Actual (Response)
                              </p>
                              <div className="bg-gray-100 p-2 rounded text-xs font-mono overflow-auto max-h-32">
                                {typeof diff.actual === "string" &&
                                diff.actual.length > 200
                                  ? `${diff.actual.substring(0, 200)}...`
                                  : String(diff.actual)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RequestDetailModal;
