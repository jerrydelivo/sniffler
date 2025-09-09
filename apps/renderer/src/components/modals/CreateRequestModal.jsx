import { useState, useEffect } from "react";
import ConfirmationModal from "./ConfirmationModal";

function CreateRequestModal({ onClose, onRefreshRequests, onCreateMock }) {
  const [formData, setFormData] = useState({
    method: "GET",
    url: "",
    headers: '{\n  "Content-Type": "application/json"\n}',
    body: "",
  });
  const [selectedProxy, setSelectedProxy] = useState("");
  const [proxies, setProxies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createMockOnSuccess, setCreateMockOnSuccess] = useState(true);
  const [showMockConfirmation, setShowMockConfirmation] = useState(false);
  const [pendingMockData, setPendingMockData] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadProxies();
    loadDefaultCreateMockSetting();
  }, []);

  const loadDefaultCreateMockSetting = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.getSettings();
        if (
          result.success &&
          result.settings?.autoSaveRequestsAsMocks !== undefined
        ) {
          setCreateMockOnSuccess(result.settings.autoSaveRequestsAsMocks);
        }
      }
    } catch (error) {
      // console.error("Failed to load default mock setting:", error);
    }
  };

  const loadProxies = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getProxies();
      setProxies(result);
      if (result.length > 0) {
        setSelectedProxy(result[0].port.toString());
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProxy) {
      alert("Please select a proxy");
      return;
    }

    setIsLoading(true);

    try {
      let headers = {};
      if (formData.headers.trim()) {
        headers = JSON.parse(formData.headers);
      }

      let body = undefined;
      if (
        formData.method !== "GET" &&
        formData.method !== "HEAD" &&
        formData.body.trim()
      ) {
        body = formData.body;
      }

      if (window.electronAPI) {
        const result = await window.electronAPI.sendRequest({
          port: parseInt(selectedProxy),
          method: formData.method,
          url: formData.url,
          headers: headers,
          body: body,
        });

        if (result.success) {
          // Show success message
          const message = `Request sent successfully! Status: ${result.response.statusCode}`;

          // If request was successful and user wants to create a mock
          if (
            result.response.statusCode >= 200 &&
            result.response.statusCode < 400 &&
            createMockOnSuccess
          ) {
            // If the checkbox is checked, automatically create the mock without asking
            if (onCreateMock) {
              await onCreateMock({
                proxyPort: parseInt(selectedProxy),
                method: formData.method,
                url: formData.url,
                response: result.response,
              });
            }
            // Show success message and reset form
            setSuccessMessage(
              `Request sent successfully! Status: ${result.response.statusCode}. Mock created automatically!`
            );
            setShowSuccess(true);
            resetForm();
            setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
          } else if (
            result.response.statusCode >= 200 &&
            result.response.statusCode < 400
          ) {
            // If request is successful but user didn't check the box, show confirmation
            setPendingMockData({
              proxyPort: parseInt(selectedProxy),
              method: formData.method,
              url: formData.url,
              response: result.response,
              requestStatus: result.response.statusCode,
            });
            setShowMockConfirmation(true);
            return; // Don't reset form yet, wait for mock confirmation
          } else {
            // If request failed, just show the message and reset form
            setSuccessMessage(message);
            setShowSuccess(true);
            resetForm();
            setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
          }

          // Refresh requests if callback provided
          if (onRefreshRequests) {
            await onRefreshRequests();
          }

          // Don't close the modal - let user send more requests
        } else {
          alert(`Failed to send request: ${result.error}`);
        }
      } else {
        alert(`Failed to send request: ${result.error}`);
      }
    } catch (error) {
      if (error.message.includes("JSON")) {
        alert("Invalid JSON in headers: " + error.message);
      } else {
        alert("Failed to send request: " + error.message);
      }
    }

    setIsLoading(false);
  };

  const handleMockConfirmation = async (confirmed) => {
    setShowMockConfirmation(false);

    if (confirmed && pendingMockData && onCreateMock) {
      await onCreateMock(pendingMockData);
      setSuccessMessage(
        `Request sent successfully! Status: ${pendingMockData.requestStatus}. Mock created!`
      );
    } else {
      setSuccessMessage(
        `Request sent successfully! Status: ${
          pendingMockData?.requestStatus || "Unknown"
        }.`
      );
    }

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds

    // Refresh requests if callback provided
    if (onRefreshRequests) {
      await onRefreshRequests();
    }

    setPendingMockData(null);
    resetForm();
    // Don't close the modal - let user send more requests
  };

  const resetForm = () => {
    setFormData({
      method: "GET",
      url: "",
      headers: '{\n  "Content-Type": "application/json"\n}',
      body: "",
    });
  };

  const updateBodyForMethod = (method) => {
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      setFormData((prev) => ({ ...prev, method, body: "" }));
    } else {
      setFormData((prev) => ({
        ...prev,
        method,
        body: prev.body || '{\n  "example": "data"\n}',
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-auto border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              Send New Request
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          {/* Success Banner */}
          {showSuccess && (
            <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
              <div className="flex items-center">
                <span className="text-green-600 dark:text-green-400 mr-2">
                  ✅
                </span>
                <span className="text-green-800 dark:text-green-200 font-medium">
                  {successMessage}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>🔌</span>
                  Proxy
                </label>
                <select
                  value={selectedProxy}
                  onChange={(e) => setSelectedProxy(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                  disabled={isLoading}
                >
                  <option value="">Select Proxy</option>
                  {proxies.map((proxy) => (
                    <option key={proxy.port} value={proxy.port}>
                      {proxy.name} (Port: {proxy.port})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>🔧</span>
                  Method
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => updateBodyForMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  disabled={isLoading}
                >
                  {[
                    "GET",
                    "POST",
                    "PUT",
                    "DELETE",
                    "PATCH",
                    "HEAD",
                    "OPTIONS",
                  ].map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>🌐</span>
                URL Path
              </label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="/api/users"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>📋</span>
                Request Headers (JSON)
              </label>
              <textarea
                value={formData.headers}
                onChange={(e) =>
                  setFormData({ ...formData, headers: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer token"\n}'
                disabled={isLoading}
              />
            </div>

            {formData.method !== "GET" && formData.method !== "HEAD" && (
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>📄</span>
                  Request Body
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) =>
                    setFormData({ ...formData, body: e.target.value })
                  }
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                  placeholder="Request body content (JSON, text, etc.)"
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="createMockOnSuccess"
                checked={createMockOnSuccess}
                onChange={(e) => setCreateMockOnSuccess(e.target.checked)}
                className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                disabled={isLoading}
              />
              <label
                htmlFor="createMockOnSuccess"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Create mock automatically if request succeeds
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Send Request
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <span>✕</span>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Mock Creation Confirmation Modal */}
      <ConfirmationModal
        isOpen={showMockConfirmation}
        onClose={() => handleMockConfirmation(false)}
        onConfirm={() => handleMockConfirmation(true)}
        title="Create Mock"
        message={
          pendingMockData
            ? `Request sent successfully! Status: ${pendingMockData.requestStatus}\n\nWould you like to create a mock from this successful response?`
            : ""
        }
        confirmText="Create Mock"
        cancelText="Skip"
        type="default"
      />
    </div>
  );
}

export default CreateRequestModal;
