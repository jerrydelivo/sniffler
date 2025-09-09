import { useState } from "react";
import { formatJson } from "../../utils/helpers";

function MockDetailModal({ mock, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-3/4 flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🎭</span>
              Mock Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-mono">
              {mock.method} {mock.url}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm flex items-center gap-2 hover:shadow-md"
          >
            <span>✕</span>
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {["overview", "headers", "response body"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-all duration-200 ${
                activeTab === tab
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab === "overview" && "📊"} {tab === "headers" && "📋"}{" "}
              {tab === "response body" && "📄"} {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">ℹ️</span>
                    Mock Info
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Method
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                        {mock.method}
                      </dd>
                    </div>
                    <div className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        URL
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white break-all font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-right max-w-xs">
                        {mock.url}
                      </dd>
                    </div>

                    <div className="flex justify-between items-center py-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Proxy Port
                      </dt>
                      <dd className="text-sm font-bold text-gray-900 dark:text-white bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
                        {mock.proxyPort}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📤</span>
                    Response Info
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status Code
                      </dt>
                      <dd
                        className={`text-sm font-bold px-2 py-1 rounded ${
                          mock.statusCode >= 200 && mock.statusCode < 300
                            ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                            : mock.statusCode >= 400
                            ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                            : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                        }`}
                      >
                        {mock.statusCode}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Created
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-mono">
                        {new Date(mock.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    {mock.updatedAt && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Updated
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {new Date(mock.updatedAt).toLocaleString()}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Content Type
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                        {mock.headers["content-type"] ||
                          mock.headers["Content-Type"] ||
                          "Unknown"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {activeTab === "headers" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">📋</span>
                Response Headers
              </h3>
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono overflow-auto">
                  {JSON.stringify(mock.headers, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "response body" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  Response Body
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const content = mock.body
                        ? formatJson(mock.body)
                        : "No response body";
                      navigator.clipboard.writeText(content);
                      // You could add a toast notification here
                    }}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {mock.headers?.["content-type"] ||
                      mock.headers?.["Content-Type"] ||
                      "application/json"}
                  </span>
                </div>
              </div>

              {mock.body ? (
                <div className="space-y-4">
                  {/* Pretty formatted view */}
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <div className="bg-gray-800 px-4 py-2 border-b border-gray-600">
                      <span className="text-xs text-gray-400 font-medium">
                        Formatted JSON
                      </span>
                    </div>
                    <div className="p-4 overflow-auto max-h-96">
                      <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono">
                        {formatJson(mock.body)}
                      </pre>
                    </div>
                  </div>

                  {/* Raw view */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-2">
                        <span className="transition-transform group-open:rotate-90">
                          ▶
                        </span>
                        View Raw Response
                      </span>
                    </summary>
                    <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                      <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                          Raw Content
                        </span>
                      </div>
                      <div className="p-4 overflow-auto max-h-48">
                        <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                          {typeof mock.body === "string"
                            ? mock.body
                            : JSON.stringify(mock.body)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <span className="text-4xl mb-4 block opacity-50">📭</span>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No response body
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    This mock has an empty response body
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MockDetailModal;
