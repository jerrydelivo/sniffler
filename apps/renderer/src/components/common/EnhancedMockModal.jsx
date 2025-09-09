import {
  MdClose,
  MdContentCopy,
  MdCode,
  MdInfo,
  MdStorage,
  MdPause,
  MdPlayArrow,
  MdDelete,
} from "react-icons/md";

function EnhancedMockModal({
  show,
  mock,
  onClose,
  onToggle,
  onDelete,
  onCopy,
  proxies,
  isDatabaseMock,
  formatJsonForDisplay,
}) {
  if (!show || !mock) return null;

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopy("Copied to clipboard", "success");
    } catch (error) {
      onCopy("Failed to copy to clipboard", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-screen overflow-auto">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 p-6 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                {isDatabaseMock(mock) ? (
                  <MdStorage className="text-white text-2xl" />
                ) : (
                  <MdCode className="text-white text-2xl" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isDatabaseMock(mock) ? "Database" : "API"} Mock Details
                </h2>
                <p className="text-blue-100 text-sm">
                  {mock.name || `${mock.method} ${mock.url}`}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  mock.enabled
                    ? "bg-green-500 text-white"
                    : "bg-gray-500 text-white"
                }`}
              >
                {mock.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 p-2 rounded-lg hover:bg-black hover:bg-opacity-20"
            >
              <MdClose className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MdInfo className="text-blue-500" />
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Name:
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {mock.name || "Unnamed"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Method:
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
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
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Status:
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        mock.statusCode >= 200 && mock.statusCode < 300
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : mock.statusCode >= 400
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      }`}
                    >
                      {mock.statusCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Port:
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {mock.proxyPort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Created:
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {new Date(mock.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* URL */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {isDatabaseMock(mock) ? "Query Pattern" : "URL Path"}
                  </h3>
                  <button
                    onClick={() => copyToClipboard(mock.url)}
                    className="text-blue-500 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    <MdContentCopy />
                  </button>
                </div>
                <div className="bg-gray-900 rounded p-3 overflow-x-auto">
                  <code className="text-green-400 text-sm whitespace-pre-wrap break-all">
                    {mock.url}
                  </code>
                </div>
              </div>
            </div>

            {/* Response Data */}
            <div className="space-y-4">
              {/* Headers */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Headers
                  </h3>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(mock.headers || {}, null, 2)
                      )
                    }
                    className="text-blue-500 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Copy headers"
                  >
                    <MdContentCopy />
                  </button>
                </div>
                <div className="bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
                  <pre className="text-blue-400 text-sm">
                    {JSON.stringify(mock.headers || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Body */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {isDatabaseMock(mock)
                      ? "Mock Result Data"
                      : "Response Body"}
                  </h3>
                  <button
                    onClick={() => copyToClipboard(mock.body || "")}
                    className="text-blue-500 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Copy response body"
                  >
                    <MdContentCopy />
                  </button>
                </div>
                <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
                  <pre className="text-green-400 text-sm">
                    {(() => {
                      try {
                        return JSON.stringify(
                          JSON.parse(mock.body || "{}"),
                          null,
                          2
                        );
                      } catch {
                        return mock.body || "No body";
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Database Info */}
          {isDatabaseMock(mock) && (
            <div className="mt-6 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <MdStorage className="text-blue-500" />
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Database Mock Information
                </h3>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  <strong>Type:</strong> Database Query Mock
                </p>
                <p>
                  <strong>Proxy:</strong>{" "}
                  {(() => {
                    const proxy = proxies.find(
                      (p) => p.port === mock.proxyPort
                    );
                    return proxy
                      ? `${proxy.name} (${
                          proxy.protocol || "Unknown protocol"
                        })`
                      : "Unknown";
                  })()}
                </p>
                <p className="text-xs bg-blue-100 dark:bg-blue-800 p-2 rounded">
                  <strong>Note:</strong> This mock intercepts database queries
                  and returns the configured result data instead of executing
                  the actual query against the database.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-600 mt-6">
            <button
              onClick={() => onToggle(mock)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                mock.enabled
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {mock.enabled ? <MdPause /> : <MdPlayArrow />}
              {mock.enabled ? "Disable" : "Enable"}
            </button>
            <button
              onClick={() => onDelete(mock)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              <MdDelete />
              Delete
            </button>
            <button
              onClick={onClose}
              className="ml-auto px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedMockModal;
