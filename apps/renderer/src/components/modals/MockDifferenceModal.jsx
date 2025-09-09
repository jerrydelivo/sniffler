import { useState } from "react";
import { formatJson } from "../../utils/helpers";
import JsonDiffViewer from "../common/JsonDiffViewer";

function MockDifferenceModal({
  request,
  mock,
  comparison,
  onClose,
  onMockUpdated,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!request || !mock || !comparison) {
    return null;
  }

  const handleReplaceMock = async () => {
    if (!request.response || !request.proxyPort) {
      // console.error("Missing request response or proxy port");
      return;
    }

    setIsUpdating(true);
    try {
      const response = {
        statusCode: request.response.statusCode,
        headers: request.response.headers,
        body: request.response.body,
      };

      const result = await window.electronAPI.updateMock({
        port: request.proxyPort,
        method: request.method,
        url: request.url,
        response,
      });

      if (result.success) {
        // Notify parent component that mock was updated
        if (onMockUpdated) {
          onMockUpdated();
        }
        onClose();
      } else {
        // console.error("Failed to update mock:", result.error);
      }
    } catch (error) {
      // console.error("Error updating mock:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getSeverityColor = (type) => {
    switch (type) {
      case "statusCode":
        return "bg-red-100 text-red-800 border-red-200";
      case "header":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "body":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityIcon = (type) => {
    switch (type) {
      case "statusCode":
        return "🚨";
      case "header":
        return "⚠️";
      case "body":
        return "📄";
      default:
        return "ℹ️";
    }
  };

  const formatJsonSafe = (value) => {
    if (typeof value === "string") {
      try {
        return formatJson(value);
      } catch {
        return value;
      }
    }
    return typeof value === "object"
      ? JSON.stringify(value, null, 2)
      : String(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Mock Difference Analysis
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all font-mono">
              {request.method} {request.url}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  comparison.hasDifferences
                    ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                    : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                }`}
              >
                {comparison.hasDifferences
                  ? `⚠️ ${comparison.differences.length} Difference${
                      comparison.differences.length > 1 ? "s" : ""
                    } Found`
                  : "✅ Matches Mock"}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReplaceMock}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm flex items-center gap-2 hover:shadow-md disabled:cursor-not-allowed"
            >
              <span>{isUpdating ? "⏳" : "🔄"}</span>
              {isUpdating ? "Updating..." : "Replace Mock"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm flex items-center gap-2 hover:shadow-md"
            >
              <span>✕</span>
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {["overview", "details", "comparison"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab === "overview" && "📊 Overview"}
              {tab === "details" && "🔍 Details"}
              {tab === "comparison" && "🔄 Side-by-Side"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6 max-h-[calc(90vh-180px)]">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Summary
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {comparison.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`p-4 rounded-lg border ${
                      comparison.statusCodeMatches
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {comparison.statusCodeMatches ? "✅" : "❌"}
                      </span>
                      <span className="font-medium">Status Code</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {comparison.statusCodeMatches ? "Matches" : "Different"}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${
                      comparison.headersMatch
                        ? "bg-green-50 border-green-200"
                        : "bg-orange-50 border-orange-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {comparison.headersMatch ? "✅" : "⚠️"}
                      </span>
                      <span className="font-medium">Headers</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {comparison.headersMatch ? "Match" : "Differ"}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border ${
                      comparison.bodyMatches
                        ? "bg-green-50 border-green-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {comparison.bodyMatches ? "✅" : "📝"}
                      </span>
                      <span className="font-medium">Body</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {comparison.bodyMatches ? "Matches" : "Different"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">🔄</span>
                    Actual Response
                  </h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status Code
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white">
                        {request.response?.statusCode || "N/A"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Duration
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {request.duration ? `${request.duration}ms` : "N/A"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Time
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {new Date(request.timestamp).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">🎭</span>
                    Mock Response
                  </h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status Code
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white">
                        {mock.statusCode}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Mock Name
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {mock.name || `${mock.method} ${mock.url}`}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Created
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {mock.createdAt
                          ? new Date(mock.createdAt).toLocaleDateString()
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6">
              {comparison.differences.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl mb-4 block">✅</span>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Perfect Match!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    The response matches the mock exactly.
                  </p>
                </div>
              ) : (
                comparison.differences.map((diff, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getSeverityColor(
                      diff.type
                    )}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">
                        {getSeverityIcon(diff.type)}
                      </span>
                      <div className="flex-1">
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
                              diff.expected.length > 100
                                ? `${diff.expected.substring(0, 100)}...`
                                : String(diff.expected)}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              Actual (Response)
                            </p>
                            <div className="bg-gray-100 p-2 rounded text-xs font-mono overflow-auto max-h-32">
                              {typeof diff.actual === "string" &&
                              diff.actual.length > 100
                                ? `${diff.actual.substring(0, 100)}...`
                                : String(diff.actual)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Mock Response Body Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Complete Mock Response
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Status Code
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded font-mono text-lg font-bold">
                      {mock.statusCode}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Headers
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto max-h-32">
                      <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                        {formatJsonSafe(mock.headers || {})}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Response Body
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto max-h-64">
                      <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
                        {formatJsonSafe(mock.body || "")}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "comparison" && (
            <div className="space-y-6">
              {/* Status Code Comparison */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🔢</span>
                  Status Code Comparison
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Actual Status
                    </p>
                    <div
                      className={`rounded-lg px-4 py-3 text-center font-mono text-lg font-bold ${
                        comparison.statusMatches
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {request.response?.statusCode || "N/A"}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Expected Status
                    </p>
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg px-4 py-3 text-center font-mono text-lg font-bold">
                      {mock.statusCode}
                    </div>
                  </div>
                </div>
                {!comparison.statusMatches && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <span className="font-medium">
                        Status mismatch detected:
                      </span>{" "}
                      Expected {mock.statusCode}, but got{" "}
                      {request.response?.statusCode || "undefined"}
                    </p>
                  </div>
                )}
              </div>

              {/* Headers Comparison */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Headers Comparison
                </h3>
                <JsonDiffViewer
                  actualContent={request.response?.headers || {}}
                  expectedContent={mock.headers || {}}
                  showLegend={!comparison.headersMatch}
                  maxHeight="max-h-48"
                />
              </div>

              {/* Body Comparison */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  Response Body Comparison
                </h3>
                <JsonDiffViewer
                  actualContent={request.response?.body || ""}
                  expectedContent={mock.body || ""}
                  showLegend={!comparison.bodyMatches}
                  maxHeight="max-h-64"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MockDifferenceModal;
