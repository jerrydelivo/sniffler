import { useState, useEffect } from "react";
import {
  X,
  Play,
  Square,
  Trash2,
  Database,
  Activity,
  Clock,
  AlertTriangle,
} from "lucide-react";

const DatabaseProxyDetailModal = ({
  isOpen,
  onClose,
  proxy,
  onStart,
  onStop,
  onDelete,
}) => {
  const [queries, setQueries] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && proxy) {
      loadProxyData();
    }
  }, [isOpen, proxy]);

  const loadProxyData = async () => {
    if (!proxy) return;

    setLoading(true);
    try {
      // Load intercepted queries
      const queryData = await window.electronAPI.getDatabaseProxyQueries(
        proxy.port
      );
      setQueries(queryData || []);

      // Load mocks
      const mockData = await window.electronAPI.getDatabaseProxyMocks(
        proxy.port
      );
      setMocks(mockData || []);
    } catch (error) {
      // console.error("Failed to load proxy data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      default:
        return "🗄️";
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatQueryType = (query) => {
    if (query.type) return query.type.toUpperCase();

    // Try to detect query type from SQL
    const sql =
      query.query?.sql?.toLowerCase() || query.query?.type?.toLowerCase() || "";
    if (sql.startsWith("select")) return "SELECT";
    if (sql.startsWith("insert")) return "INSERT";
    if (sql.startsWith("update")) return "UPDATE";
    if (sql.startsWith("delete")) return "DELETE";
    if (sql.startsWith("create")) return "CREATE";
    if (sql.startsWith("drop")) return "DROP";
    if (sql.startsWith("alter")) return "ALTER";

    return "QUERY";
  };

  const getQueryTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case "select":
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
      case "insert":
        return "text-green-600 bg-green-50 dark:bg-green-900/20";
      case "update":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
      case "delete":
        return "text-red-600 bg-red-50 dark:bg-red-900/20";
      case "create":
      case "drop":
      case "alter":
        return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
    }
  };

  if (!isOpen || !proxy) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getProtocolIcon(proxy.protocol)}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {proxy.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {proxy.protocol.toUpperCase()} • Port {proxy.port} →{" "}
                {proxy.targetHost}:{proxy.targetPort}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  proxy.isRunning ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  proxy.isRunning ? "text-green-600" : "text-gray-500"
                }`}
              >
                {proxy.isRunning ? "Running" : "Stopped"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700">
          <div className="flex space-x-2">
            {proxy.isRunning ? (
              <button
                onClick={() => onStop(proxy)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Square size={18} />
                <span>Stop Proxy</span>
              </button>
            ) : (
              <button
                onClick={() => onStart(proxy)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Play size={18} />
                <span>Start Proxy</span>
              </button>
            )}
            <button
              onClick={() => onDelete(proxy)}
              disabled={proxy.isRunning}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "overview", label: "Overview", icon: Database },
              { id: "queries", label: "Queries", icon: Activity },
              { id: "mocks", label: "Mocks", icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.id === "queries" && queries.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-1">
                    {queries.length}
                  </span>
                )}
                {tab.id === "mocks" && mocks.length > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs rounded-full px-2 py-1">
                    {mocks.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading...
              </p>
            </div>
          )}

          {!loading && activeTab === "overview" && (
            <div className="space-y-6">
              {/* Configuration */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Protocol
                    </div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {proxy.protocol.toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Proxy Port
                    </div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {proxy.port}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Target
                    </div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {proxy.targetHost}:{proxy.targetPort}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Created
                    </div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatTimestamp(proxy.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              {proxy.stats && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        Connections
                      </div>
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {proxy.stats.totalConnections || 0}
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Queries
                      </div>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {proxy.stats.totalQueries || 0}
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <div className="text-sm text-red-600 dark:text-red-400">
                        Errors
                      </div>
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {proxy.stats.totalErrors || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "queries" && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Recent Queries
              </h3>
              {queries.length === 0 ? (
                <div className="text-center py-8">
                  <Activity size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No queries intercepted yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queries
                    .slice(-10)
                    .reverse()
                    .map((query, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getQueryTypeColor(
                                formatQueryType(query)
                              )}`}
                            >
                              {formatQueryType(query)}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatTimestamp(query.timestamp)}
                            </span>
                          </div>
                          {query.duration && (
                            <span className="text-sm text-gray-500">
                              {query.duration}ms
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm bg-white dark:bg-gray-800 rounded p-3 overflow-x-auto">
                          {query.query?.sql ||
                            query.query?.type ||
                            query.command ||
                            "Unknown query"}
                        </div>
                        {query.error && (
                          <div className="mt-2 flex items-center space-x-2 text-red-600 dark:text-red-400">
                            <AlertTriangle size={16} />
                            <span className="text-sm">{query.error}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "mocks" && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Active Mocks
              </h3>
              {mocks.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No mocks configured
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mocks.map((mock, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {mock.name || `Mock ${index + 1}`}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {mock.usageCount || 0} uses
                        </span>
                      </div>
                      <div className="font-mono text-sm bg-white dark:bg-gray-800 rounded p-3 overflow-x-auto">
                        {mock.pattern || mock.query || "Unknown pattern"}
                      </div>
                      {mock.response && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Response:
                          </div>
                          <div className="font-mono text-xs bg-white dark:bg-gray-800 rounded p-2 max-h-20 overflow-y-auto">
                            {JSON.stringify(mock.response, null, 2)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseProxyDetailModal;
