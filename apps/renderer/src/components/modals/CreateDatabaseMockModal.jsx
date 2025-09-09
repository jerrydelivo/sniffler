import { useState, useEffect } from "react";
import { X, Database, AlertCircle, Code } from "lucide-react";

const CreateDatabaseMockModal = ({
  isOpen,
  onClose,
  onConfirm,
  proxies = [],
}) => {
  const [formData, setFormData] = useState({
    name: "",
    protocol: "postgresql",
    proxyPort: "",
    pattern: "",
    patternType: "exact", // exact, contains, regex
    responseType: "json",
    response: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const protocols = [
    { value: "postgresql", label: "PostgreSQL", icon: "🐘" },
    { value: "mysql", label: "MySQL", icon: "🐬" },
    { value: "mongodb", label: "MongoDB", icon: "🍃" },
    { value: "sqlserver", label: "SQL Server", icon: "🏢" },
  ];

  const patternTypes = [
    {
      value: "exact",
      label: "Exact Match",
      description: "Query must match exactly",
    },
    {
      value: "contains",
      label: "Contains",
      description: "Query must contain the pattern",
    },
    {
      value: "regex",
      label: "Regular Expression",
      description: "Pattern is a regex",
    },
  ];

  const responseTypes = [
    { value: "json", label: "JSON Response" },
    { value: "rows", label: "Table Rows" },
    { value: "error", label: "Error Response" },
    { value: "empty", label: "Empty Result" },
  ];

  useEffect(() => {
    if (formData.protocol && proxies.length > 0) {
      const availableProxies = proxies.filter(
        (p) => p.protocol === formData.protocol
      );
      if (availableProxies.length > 0 && !formData.proxyPort) {
        setFormData((prev) => ({
          ...prev,
          proxyPort: availableProxies[0].port.toString(),
        }));
      }
    }
  }, [formData.protocol, proxies]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Mock name is required";
    }

    if (!formData.pattern.trim()) {
      newErrors.pattern = "Query pattern is required";
    }

    if (formData.patternType === "regex") {
      try {
        new RegExp(formData.pattern);
      } catch (e) {
        newErrors.pattern = "Invalid regular expression";
      }
    }

    if (!formData.response.trim() && formData.responseType !== "empty") {
      newErrors.response = "Response data is required";
    }

    if (formData.responseType === "json") {
      try {
        JSON.parse(formData.response);
      } catch (e) {
        newErrors.response = "Invalid JSON format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const mockData = {
        ...formData,
        proxyPort: formData.proxyPort ? parseInt(formData.proxyPort) : null,
        response:
          formData.responseType === "empty"
            ? null
            : formData.responseType === "json"
            ? JSON.parse(formData.response)
            : formData.response,
      };

      await onConfirm(mockData);

      // Reset form
      setFormData({
        name: "",
        protocol: "postgresql",
        proxyPort: "",
        pattern: "",
        patternType: "exact",
        responseType: "json",
        response: "",
        description: "",
      });
      setErrors({});
    } catch (error) {
      // console.error("Failed to create database mock:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const generateSampleResponse = () => {
    switch (formData.responseType) {
      case "json":
        return JSON.stringify(
          {
            rows: [
              { id: 1, name: "Sample Record", status: "active" },
              { id: 2, name: "Another Record", status: "inactive" },
            ],
            rowCount: 2,
          },
          null,
          2
        );
      case "rows":
        return "id,name,status\n1,Sample Record,active\n2,Another Record,inactive";
      case "error":
        return "Query execution failed: Table does not exist";
      default:
        return "";
    }
  };

  const availableProxies = proxies.filter(
    (p) => p.protocol === formData.protocol
  );
  const selectedProtocol = protocols.find((p) => p.value === formData.protocol);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Database className="text-green-500" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Database Mock
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mock Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="User Query Mock"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.name
                    ? "border-red-300 dark:border-red-600"
                    : "border-gray-300 dark:border-gray-600"
                } dark:bg-gray-700 dark:text-white`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                  <AlertCircle size={16} />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Protocol
              </label>
              <div className="relative">
                <select
                  value={formData.protocol}
                  onChange={(e) =>
                    handleInputChange("protocol", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white appearance-none"
                >
                  {protocols.map((protocol) => (
                    <option key={protocol.value} value={protocol.value}>
                      {protocol.icon} {protocol.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Proxy Selection */}
          {availableProxies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Proxy (Optional)
              </label>
              <select
                value={formData.proxyPort}
                onChange={(e) => handleInputChange("proxyPort", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All proxies</option>
                {availableProxies.map((proxy) => (
                  <option key={proxy.port} value={proxy.port}>
                    {proxy.name} (Port {proxy.port})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty to apply to all {formData.protocol} proxies
              </p>
            </div>
          )}

          {/* Query Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Query Pattern
            </label>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {patternTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleInputChange("patternType", type.value)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      formData.patternType === type.value
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-gray-500">
                      {type.description}
                    </div>
                  </button>
                ))}
              </div>
              <textarea
                value={formData.pattern}
                onChange={(e) => handleInputChange("pattern", e.target.value)}
                placeholder={
                  formData.patternType === "exact"
                    ? "SELECT * FROM users WHERE id = ?"
                    : formData.patternType === "contains"
                    ? "SELECT * FROM users"
                    : "SELECT.*FROM\\s+users.*"
                }
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm ${
                  errors.pattern
                    ? "border-red-300 dark:border-red-600"
                    : "border-gray-300 dark:border-gray-600"
                } dark:bg-gray-700 dark:text-white`}
              />
              {errors.pattern && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                  <AlertCircle size={16} />
                  <span>{errors.pattern}</span>
                </p>
              )}
            </div>
          </div>

          {/* Response Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Response Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {responseTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    handleInputChange("responseType", type.value);
                    if (type.value !== "empty") {
                      handleInputChange("response", generateSampleResponse());
                    } else {
                      handleInputChange("response", "");
                    }
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    formData.responseType === type.value
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                </button>
              ))}
            </div>

            {formData.responseType !== "empty" && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Code size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Response Data
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleInputChange("response", generateSampleResponse())
                    }
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Generate Sample
                  </button>
                </div>
                <textarea
                  value={formData.response}
                  onChange={(e) =>
                    handleInputChange("response", e.target.value)
                  }
                  placeholder={generateSampleResponse()}
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm ${
                    errors.response
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  } dark:bg-gray-700 dark:text-white`}
                />
                {errors.response && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                    <AlertCircle size={16} />
                    <span>{errors.response}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe what this mock does..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Mock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDatabaseMockModal;
