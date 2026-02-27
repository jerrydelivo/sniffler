import { useState } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Copy,
  Code,
} from "lucide-react";

const ResponseModal = ({ isOpen, onClose, response, request }) => {
  const [activeTab, setActiveTab] = useState("body");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !response) return null;

  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300)
      return "text-green-600 dark:text-green-400";
    if (statusCode >= 300 && statusCode < 400)
      return "text-yellow-600 dark:text-yellow-400";
    if (statusCode >= 400 && statusCode < 500)
      return "text-orange-600 dark:text-orange-400";
    if (statusCode >= 500) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getStatusIcon = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300)
      return <CheckCircle className="text-green-500" size={20} />;
    if (statusCode >= 300 && statusCode < 400)
      return <Info className="text-yellow-500" size={20} />;
    if (statusCode >= 400 && statusCode < 500)
      return <AlertCircle className="text-orange-500" size={20} />;
    if (statusCode >= 500)
      return <XCircle className="text-red-500" size={20} />;
    return <Info className="text-gray-500" size={20} />;
  };

  const formatBody = (body) => {
    if (!body) return "No response body";

    try {
      // Try to parse as JSON for pretty formatting
      if (typeof body === "string") {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      } else if (typeof body === "object") {
        return JSON.stringify(body, null, 2);
      }
      return body.toString();
    } catch (e) {
      // If not JSON, return as-is
      return typeof body === "string" ? body : body.toString();
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const tabs = [
    { id: "body", label: "Response Body", icon: <Code size={16} /> },
    { id: "headers", label: "Headers", icon: <Info size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {getStatusIcon(response.statusCode)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Response Details
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {request?.method} {request?.url}
                </span>
                <span
                  className={`text-sm font-semibold ${getStatusColor(
                    response.statusCode
                  )}`}
                >
                  {response.statusCode}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === "body" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Response Body
                </h3>
                <button
                  onClick={() => copyToClipboard(formatBody(response.body))}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  <Copy size={14} />
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200">
                {formatBody(response.body)}
              </pre>
            </div>
          )}

          {activeTab === "headers" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Response Headers
                </h3>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(response.headers, null, 2))
                  }
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  <Copy size={14} />
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <div className="space-y-2">
                {response.headers &&
                Object.keys(response.headers).length > 0 ? (
                  Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="font-medium text-gray-700 dark:text-gray-300 w-1/3 break-all">
                        {key}:
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 w-2/3 break-all ml-2">
                        {Array.isArray(value) ? value.join(", ") : value}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    No headers
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResponseModal;
