import { useState, useEffect } from "react";
import { X, Trash2, Edit, Clock, Database, Activity } from "lucide-react";
import { ReliableInput } from "../ReliableInput";

const DatabaseMockDetailModal = ({
  isOpen,
  onClose,
  mock,
  proxies,
  onUpdate,
  onDelete,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState("details");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(mock);
  const [usageHistory, setUsageHistory] = useState([]);

  useEffect(() => {
    if (mock) {
      setEditData(mock);
      loadUsageHistory();
    }
  }, [mock]);

  const loadUsageHistory = async () => {
    try {
      if (mock?.id) {
        const history = await window.electronAPI.getDatabaseMockUsage(mock.id);
        setUsageHistory(history || []);
      }
    } catch (error) {
      // console.error("Failed to load usage history:", error);
    }
  };

  const handleSave = async () => {
    try {
      await onUpdate(editData);
      setIsEditing(false);
    } catch (error) {
      // console.error("Failed to update mock:", error);
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

  const getPatternTypeLabel = (type) => {
    switch (type) {
      case "exact":
        return "Exact Match";
      case "contains":
        return "Contains";
      case "regex":
        return "Regular Expression";
      default:
        return "Unknown";
    }
  };

  const getResponseTypeLabel = (type) => {
    switch (type) {
      case "json":
        return "JSON Response";
      case "rows":
        return "Table Rows";
      case "error":
        return "Error Response";
      case "empty":
        return "Empty Result";
      default:
        return "Unknown";
    }
  };

  if (!isOpen || !mock) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getProtocolIcon(mock.protocol)}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {mock.name || "Database Mock"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {mock.protocol.toUpperCase()} •{" "}
                {getPatternTypeLabel(mock.patternType)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
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
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Edit size={18} />
              <span>{isEditing ? "Cancel Edit" : "Edit"}</span>
            </button>
            <button
              onClick={() => onDelete(mock)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          </div>
          {isEditing && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "details", label: "Details", icon: Database },
              { id: "pattern", label: "Pattern", icon: Edit },
              { id: "response", label: "Response", icon: Activity },
              { id: "usage", label: "Usage", icon: Clock },
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
                {tab.id === "usage" && mock.usageCount > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-1">
                    {mock.usageCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {activeTab === "details" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        Name
                      </label>
                      {isEditing ? (
                        <ReliableInput
                          value={editData.name}
                          onChange={(e) =>
                            setEditData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          fullWidth
                          size="small"
                        />
                      ) : (
                        <div className="text-gray-900 dark:text-white font-medium">
                          {mock.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        Protocol
                      </label>
                      <div className="text-gray-900 dark:text-white font-medium">
                        {mock.protocol.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        Pattern Type
                      </label>
                      <div className="text-gray-900 dark:text-white font-medium">
                        {getPatternTypeLabel(mock.patternType)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        Response Type
                      </label>
                      <div className="text-gray-900 dark:text-white font-medium">
                        {getResponseTypeLabel(mock.responseType)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        Usage Count
                      </div>
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                        {mock.usageCount || 0}
                      </div>
                    </div>
                    {mock.lastUsed && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <div className="text-sm text-green-600 dark:text-green-400">
                          Last Used
                        </div>
                        <div className="text-sm font-medium text-green-700 dark:text-green-300">
                          {formatTimestamp(mock.lastUsed)}
                        </div>
                      </div>
                    )}
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Created
                      </div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatTimestamp(mock.createdAt || new Date())}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                {isEditing ? (
                  <ReliableInput
                    value={editData.description || ""}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    multiline
                    rows={3}
                    placeholder="Add a description..."
                    fullWidth
                  />
                ) : (
                  <div className="text-gray-700 dark:text-gray-300">
                    {mock.description || "No description provided"}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "pattern" && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Query Pattern
              </h3>
              {isEditing ? (
                <ReliableInput
                  value={editData.pattern}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      pattern: e.target.value,
                    }))
                  }
                  multiline
                  rows={8}
                  fullWidth
                  InputProps={{
                    style: { fontFamily: "monospace", fontSize: "0.875rem" },
                  }}
                />
              ) : (
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 rounded-lg p-4 whitespace-pre-wrap">
                  {mock.pattern}
                </div>
              )}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Pattern Type
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {getPatternTypeLabel(mock.patternType)} -{" "}
                  {mock.patternType === "exact"
                    ? "Query must match exactly"
                    : mock.patternType === "contains"
                    ? "Query must contain this pattern"
                    : "Pattern is treated as a regular expression"}
                </div>
              </div>
            </div>
          )}

          {activeTab === "response" && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Mock Response
              </h3>
              {isEditing ? (
                <ReliableInput
                  value={
                    typeof editData.response === "object"
                      ? JSON.stringify(editData.response, null, 2)
                      : editData.response || ""
                  }
                  onChange={(e) => {
                    let value = e.target.value;
                    if (editData.responseType === "json") {
                      try {
                        value = JSON.parse(value);
                      } catch (e) {
                        // Keep as string if JSON parsing fails
                      }
                    }
                    setEditData((prev) => ({ ...prev, response: value }));
                  }}
                  multiline
                  rows={12}
                  fullWidth
                  InputProps={{
                    style: { fontFamily: "monospace", fontSize: "0.875rem" },
                  }}
                />
              ) : (
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {mock.responseType === "empty" ? (
                    <span className="text-gray-500 italic">Empty response</span>
                  ) : typeof mock.response === "object" ? (
                    JSON.stringify(mock.response, null, 2)
                  ) : (
                    mock.response
                  )}
                </div>
              )}
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Response Type
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  {getResponseTypeLabel(mock.responseType)}
                </div>
              </div>
            </div>
          )}

          {activeTab === "usage" && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Usage History
              </h3>
              {usageHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    This mock hasn't been used yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usageHistory
                    .slice(-10)
                    .reverse()
                    .map((usage, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatTimestamp(usage.timestamp)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {usage.duration}ms
                          </span>
                        </div>
                        <div className="font-mono text-sm bg-white dark:bg-gray-800 rounded p-3">
                          {usage.query}
                        </div>
                        {usage.clientInfo && (
                          <div className="mt-2 text-xs text-gray-500">
                            Client: {usage.clientInfo.address}:
                            {usage.clientInfo.port}
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

export default DatabaseMockDetailModal;
