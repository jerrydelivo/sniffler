import { useState, useEffect, useRef } from "react";
import { ReliableInput, ReliableSelect } from "../common/ReliableInput";
import { MenuItem } from "@mui/material";
import { useModalFocusReliability } from "../../hooks/useInputReliability";

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
  const modalRef = useRef(null);

  // Enhanced modal focus management
  useModalFocusReliability(true, modalRef);

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
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-auto border border-gray-200 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2
              id="modal-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
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
                <ReliableSelect
                  value={selectedProxy}
                  onChange={(e) => setSelectedProxy(e.target.value)}
                  required
                  autoFocus
                  placeholder="Select Proxy"
                  name="proxy"
                >
                  {proxies.map((proxy) => (
                    <MenuItem key={proxy.port} value={proxy.port}>
                      {proxy.name} (Port: {proxy.port})
                    </MenuItem>
                  ))}
                </ReliableSelect>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>🔧</span>
                  Method
                </label>
                <ReliableSelect
                  value={formData.method}
                  onChange={(e) =>
                    setFormData({ ...formData, method: e.target.value })
                  }
                  name="method"
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
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </ReliableSelect>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>🌐</span>
                URL Path
              </label>
              <ReliableInput
                type="text"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="/api/users"
                required
                name="url"
                style={{ fontFamily: "monospace" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>📊</span>
                  Status Code
                </label>
                <ReliableInput
                  type="number"
                  value={formData.statusCode}
                  onChange={(e) =>
                    setFormData({ ...formData, statusCode: e.target.value })
                  }
                  min="100"
                  max="599"
                  required
                  name="statusCode"
                  style={{ fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <span>🏷️</span>
                  Mock Name (Optional)
                </label>
                <ReliableInput
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My Custom Mock"
                  name="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>📋</span>
                Response Headers (JSON)
              </label>
              <ReliableInput
                value={formData.headers}
                onChange={(e) =>
                  setFormData({ ...formData, headers: e.target.value })
                }
                rows={4}
                multiline
                required
                name="headers"
                style={{
                  fontFamily: "monospace",
                  fontSize: "14px",
                  backgroundColor: "#111827",
                  color: "#10b981",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <span>📄</span>
                Response Body
              </label>
              <ReliableInput
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                rows={6}
                multiline
                placeholder="Response body content"
                name="body"
                style={{
                  fontFamily: "monospace",
                  fontSize: "14px",
                  backgroundColor: "#111827",
                  color: "#10b981",
                }}
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
