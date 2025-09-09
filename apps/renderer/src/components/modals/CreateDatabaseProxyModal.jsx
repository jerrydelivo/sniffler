import { useState } from "react";
import { X, Database, AlertCircle } from "lucide-react";
import { createPortBlurHandler } from "../../utils/portHandlers";

const CreateDatabaseProxyModal = ({ isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    name: "",
    protocol: "postgresql",
    port: "",
    targetHost: "localhost",
    targetPort: "",
  });
  const [errors, setErrors] = useState({});
  const [portWarning, setPortWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const protocols = [
    { value: "postgresql", label: "PostgreSQL", icon: "🐘", defaultPort: 5432 },
    { value: "mysql", label: "MySQL", icon: "🐬", defaultPort: 3306 },
    { value: "mongodb", label: "MongoDB", icon: "🍃", defaultPort: 27017 },
    { value: "sqlserver", label: "SQL Server", icon: "🏢", defaultPort: 1433 },
  ];

  const handleProtocolChange = (protocol) => {
    const selectedProtocol = protocols.find((p) => p.value === protocol);
    setFormData((prev) => ({
      ...prev,
      protocol,
      targetPort: selectedProtocol
        ? selectedProtocol.defaultPort.toString()
        : prev.targetPort,
      name: prev.name || `${selectedProtocol?.label || protocol} Proxy`,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Proxy name is required";
    }

    if (!formData.port) {
      newErrors.port = "Proxy port is required";
    } else {
      const port = parseInt(formData.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        newErrors.port = "Port must be between 1 and 65535";
      } else if (port < 1024) {
        newErrors.port = "Avoid using system ports (< 1024)";
      }
    }

    if (!formData.targetHost.trim()) {
      newErrors.targetHost = "Target host is required";
    }

    if (!formData.targetPort) {
      newErrors.targetPort = "Target port is required";
    } else {
      const targetPort = parseInt(formData.targetPort);
      if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
        newErrors.targetPort = "Target port must be between 1 and 65535";
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
      await onConfirm({
        name: formData.name.trim(),
        protocol: formData.protocol,
        port: parseInt(formData.port),
        targetHost: formData.targetHost.trim(),
        targetPort: parseInt(formData.targetPort),
      });

      // Reset form
      setFormData({
        name: "",
        protocol: "postgresql",
        port: "",
        targetHost: "localhost",
        targetPort: "",
      });
      setErrors({});
    } catch (error) {
      // console.error("Failed to create database proxy:", error);
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

    // Clear port warning when user starts typing in port field
    if (field === "port") {
      setPortWarning(null);
    }
  };

  const handlePortBlur = createPortBlurHandler(formData.port, setPortWarning);

  const handleClose = () => {
    setPortWarning(null);
    onClose();
  };

  const selectedProtocol = protocols.find((p) => p.value === formData.protocol);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Database className="text-green-500" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Database Proxy
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Protocol Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Database Protocol
            </label>
            <div className="grid grid-cols-2 gap-2">
              {protocols.map((protocol) => (
                <button
                  key={protocol.value}
                  type="button"
                  onClick={() => handleProtocolChange(protocol.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    formData.protocol === protocol.value
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{protocol.icon}</span>
                    <div>
                      <div className="font-medium">{protocol.label}</div>
                      <div className="text-xs text-gray-500">
                        Port {protocol.defaultPort}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Proxy Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Proxy Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder={`${selectedProtocol?.label || "Database"} Proxy`}
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

          {/* Proxy Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Proxy Port
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => handleInputChange("port", e.target.value)}
              onBlur={handlePortBlur}
              placeholder="8080"
              min="1"
              max="65535"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.port
                  ? "border-red-300 dark:border-red-600"
                  : "border-gray-300 dark:border-gray-600"
              } dark:bg-gray-700 dark:text-white`}
            />
            {errors.port && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                <AlertCircle size={16} />
                <span>{errors.port}</span>
              </p>
            )}
            {portWarning && (
              <p className="mt-1 text-sm text-orange-500 dark:text-orange-400 flex items-center space-x-1">
                <AlertCircle size={16} />
                <span>{portWarning}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The port where the proxy will listen for connections
            </p>
          </div>

          {/* Target Configuration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Host
              </label>
              <input
                type="text"
                value={formData.targetHost}
                onChange={(e) =>
                  handleInputChange("targetHost", e.target.value)
                }
                placeholder="localhost"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.targetHost
                    ? "border-red-300 dark:border-red-600"
                    : "border-gray-300 dark:border-gray-600"
                } dark:bg-gray-700 dark:text-white`}
              />
              {errors.targetHost && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                  <AlertCircle size={16} />
                  <span>{errors.targetHost}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Port
              </label>
              <input
                type="number"
                value={formData.targetPort}
                onChange={(e) =>
                  handleInputChange("targetPort", e.target.value)
                }
                placeholder={selectedProtocol?.defaultPort.toString() || "5432"}
                min="1"
                max="65535"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.targetPort
                    ? "border-red-300 dark:border-red-600"
                    : "border-gray-300 dark:border-gray-600"
                } dark:bg-gray-700 dark:text-white`}
              />
              {errors.targetPort && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                  <AlertCircle size={16} />
                  <span>{errors.targetPort}</span>
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            The actual database server that the proxy will forward connections
            to
          </p>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Proxy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDatabaseProxyModal;
