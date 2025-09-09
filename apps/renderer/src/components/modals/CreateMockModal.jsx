import { useState, useEffect } from "react";

function CreateMockModal({ onClose, onRefreshMocks }) {
  const [formData, setFormData] = useState({
    method: "GET",
    url: "",
    statusCode: 200,
    headers: '{\n  "Content-Type": "application/json"\n}',
    body: '{\n  "message": "Mock response"\n}',
    name: "",
  });
  const [selectedProxy, setSelectedProxy] = useState("");
  const [proxies, setProxies] = useState([]);

  useEffect(() => {
    loadProxies();
  }, []);

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

    try {
      const headers = JSON.parse(formData.headers);

      if (window.electronAPI) {
        const result = await window.electronAPI.addMock({
          port: parseInt(selectedProxy),
          method: formData.method,
          url: formData.url,
          response: {
            statusCode: parseInt(formData.statusCode),
            headers: headers,
            body: formData.body,
            name: formData.name || `${formData.method} ${formData.url}`,
            enabled: false, // New mocks should be disabled by default
          },
        });

        if (result.success) {
          onClose();
          if (onRefreshMocks) {
            onRefreshMocks();
          }
        } else {
          alert(`Failed to create mock: ${result.error}`);
        }
      }
    } catch (error) {
      alert("Invalid JSON in headers: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-auto border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">✨</span>
              Create New Mock
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

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
                  onChange={(e) =>
                    setFormData({ ...formData, method: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>📊</span>
                  Status Code
                </label>
                <input
                  type="number"
                  value={formData.statusCode}
                  onChange={(e) =>
                    setFormData({ ...formData, statusCode: e.target.value })
                  }
                  min="100"
                  max="599"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>🏷️</span>
                  Mock Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My Custom Mock"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>📋</span>
                Response Headers (JSON)
              </label>
              <textarea
                value={formData.headers}
                onChange={(e) =>
                  setFormData({ ...formData, headers: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>📄</span>
                Response Body
              </label>
              <textarea
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-900 dark:bg-gray-950 text-green-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                placeholder="Response body content"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <span>✨</span>
                Create Mock
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <span>✕</span>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateMockModal;
