import { useState, useEffect } from "react";

function DatabaseView({ hideHeader = false }) {
  const [proxies, setProxies] = useState([]);
  const [connections, setConnections] = useState([]);
  const [queries, setQueries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProxy, setNewProxy] = useState({
    port: 4445,
    protocol: "postgresql",
    targetHost: "localhost",
    targetPort: 5432,
    name: "PostgreSQL Proxy",
  });
  // UI-only protocol variant for versioned options
  const [protocolVariant, setProtocolVariant] = useState("postgresql");

  const variantDefaults = {
    // PostgreSQL
    postgresql: {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL Proxy",
    },
    "postgresql@15": {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL 15 Proxy",
    },
    "postgresql@13": {
      base: "postgresql",
      port: 15432,
      targetPort: 5432,
      name: "PostgreSQL 13 Proxy",
    },
    // MySQL
    mysql: {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL Proxy",
    },
    "mysql@8.0": {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL 8.0 Proxy",
    },
    "mysql@5.7": {
      base: "mysql",
      port: 13306,
      targetPort: 3306,
      name: "MySQL 5.7 Proxy",
    },
    // MongoDB
    mongodb: {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB Proxy",
    },
    "mongodb@7.0": {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB 7.0 Proxy",
    },
    "mongodb@5.0": {
      base: "mongodb",
      port: 37017,
      targetPort: 27017,
      name: "MongoDB 5.0 Proxy",
    },
    // SQL Server
    sqlserver: {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server Proxy",
    },
    "sqlserver@2022": {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server 2022 Proxy",
    },
    "sqlserver@2019": {
      base: "sqlserver",
      port: 11433,
      targetPort: 1433,
      name: "SQL Server 2019 Proxy",
    },
    // Redis
    redis: {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis Proxy",
    },
    "redis@7": {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis 7 Proxy",
    },
    "redis@6": {
      base: "redis",
      port: 16379,
      targetPort: 6379,
      name: "Redis 6 Proxy",
    },
  };

  useEffect(() => {
    loadProxies();
    loadExistingQueries();

    // Listen for database events
    if (window.electronAPI) {
      window.electronAPI.onDatabaseConnectionEstablished((data) => {
        setConnections((prev) => [...prev, data]);
      });

      window.electronAPI.onDatabaseConnectionClosed((data) => {
        setConnections((prev) =>
          prev.filter((conn) => conn.connectionId !== data.connectionId)
        );
      });

      window.electronAPI.onDatabaseQuery((data) => {
        console.log("🔥 DatabaseView: Received database query event:", data);
        setQueries((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 queries
      });

      window.electronAPI.onDatabaseResponse((data) => {
        console.log("🔥 DatabaseView: Received database response event:", data);
        setQueries((prev) => [data, ...prev].slice(0, 100));
      });
    }
  }, []);

  const loadProxies = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.getDatabaseProxies();
        console.log("🔥 DatabaseView: Loaded database proxies:", result);
        if (result.success) {
          setProxies(result.proxies || []);
        }
      }
    } catch (error) {
      console.error("Failed to load database proxies:", error);
    }
  };

  const loadExistingQueries = async () => {
    try {
      if (window.electronAPI) {
        // Load queries for known database proxy port 4445
        const result = await window.electronAPI.getDatabaseProxyQueries(4445);
        console.log(
          "🔥 DatabaseView: Loaded existing queries for port 4445:",
          result
        );
        if (result.success && result.queries) {
          setQueries(result.queries);
        }
      }
    } catch (error) {
      console.error("Failed to load existing database queries:", error);
    }
  };

  const createProxy = async () => {
    try {
      setIsLoading(true);
      if (window.electronAPI) {
        const result = await window.electronAPI.createDatabaseProxy(newProxy);
        console.log("🔥 DatabaseView: Create proxy result:", result);
        if (result.success) {
          setProxies((prev) => [
            ...prev,
            { ...newProxy, id: result.id, isRunning: true },
          ]);
          setShowCreateForm(false);
          setNewProxy({
            port: 4445,
            protocol: "postgresql",
            targetHost: "localhost",
            targetPort: 5432,
            name: "PostgreSQL Proxy",
          });
        } else {
          alert("Failed to create proxy: " + (result.error || "Unknown error"));
        }
      }
    } catch (error) {
      alert("Failed to create proxy: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const stopProxy = async (port) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.stopDatabaseProxy(port);
        console.log("🔥 DatabaseView: Stop proxy result:", result);
        if (result.success) {
          setProxies((prev) =>
            prev.map((p) => (p.port === port ? { ...p, isRunning: false } : p))
          );
        }
      }
    } catch (error) {
      alert("Failed to stop proxy: " + error.message);
    }
  };

  const clearQueries = () => {
    setQueries([]);
  };

  return (
    <div>
      {!hideHeader && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Database Proxy Monitoring
          </h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + New Database Proxy
          </button>
        </div>
      )}

      {/* Create Proxy Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create Database Proxy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proxy Name
              </label>
              <input
                type="text"
                value={newProxy.name}
                onChange={(e) =>
                  setNewProxy((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Protocol
              </label>
              <select
                value={protocolVariant}
                onChange={(e) => {
                  const variant = e.target.value;
                  setProtocolVariant(variant);
                  const def =
                    variantDefaults[variant] || variantDefaults["postgresql"];
                  setNewProxy((prev) => ({
                    ...prev,
                    protocol: def.base,
                    port: def.port,
                    targetPort: def.targetPort,
                    name: def.name,
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                <optgroup label="PostgreSQL">
                  <option value="postgresql@15">PostgreSQL › 15</option>
                  <option value="postgresql@13">PostgreSQL › 13</option>
                  <option value="postgresql">PostgreSQL (Any)</option>
                </optgroup>
                <optgroup label="MySQL">
                  <option value="mysql@8.0">MySQL › 8.0</option>
                  <option value="mysql@5.7">MySQL › 5.7</option>
                  <option value="mysql">MySQL (Any)</option>
                </optgroup>
                <optgroup label="SQL Server">
                  <option value="sqlserver@2022">SQL Server › 2022</option>
                  <option value="sqlserver@2019">SQL Server › 2019</option>
                  <option value="sqlserver">SQL Server (Any)</option>
                </optgroup>
                <optgroup label="MongoDB">
                  <option value="mongodb@7.0">MongoDB › 7.0</option>
                  <option value="mongodb@5.0">MongoDB › 5.0</option>
                  <option value="mongodb">MongoDB (Any)</option>
                </optgroup>
                <optgroup label="Redis">
                  <option value="redis@7">Redis › 7</option>
                  <option value="redis@6">Redis › 6</option>
                  <option value="redis">Redis (Any)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Listen Port
              </label>
              <input
                type="number"
                value={newProxy.port}
                onChange={(e) =>
                  setNewProxy((prev) => ({
                    ...prev,
                    port: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="1"
                max="65535"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Host
              </label>
              <input
                type="text"
                value={newProxy.targetHost}
                onChange={(e) =>
                  setNewProxy((prev) => ({
                    ...prev,
                    targetHost: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Port
              </label>
              <input
                type="number"
                value={newProxy.targetPort}
                onChange={(e) =>
                  setNewProxy((prev) => ({
                    ...prev,
                    targetPort: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="1"
                max="65535"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={createProxy}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Proxy"}
            </button>
          </div>
        </div>
      )}

      {/* Active Database Proxies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Database Proxies
          </h3>
          {proxies.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No database proxies configured
            </p>
          ) : (
            <div className="space-y-3">
              {proxies.map((proxy, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {proxy.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {proxy.protocol} • Port {proxy.port} → {proxy.targetHost}:
                      {proxy.targetPort}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        proxy.isRunning
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {proxy.isRunning ? "Running" : "Stopped"}
                    </span>
                    {proxy.isRunning && (
                      <button
                        onClick={() => stopProxy(proxy.port)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Connections
          </h3>
          {connections.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No active connections
            </p>
          ) : (
            <div className="space-y-2">
              {connections.slice(0, 5).map((connection) => (
                <div
                  key={connection.connectionId}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {connection.protocol.toUpperCase()} Connection
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {connection.clientAddress} → {connection.targetHost}:
                    {connection.targetPort}
                  </div>
                  <div className="text-xs text-gray-400">
                    Started:{" "}
                    {new Date(connection.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {connections.length > 5 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ...and {connections.length - 5} more connections
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Query Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Query Log
          </h3>
          <button
            onClick={clearQueries}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Log
          </button>
        </div>

        {queries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No queries captured yet
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queries.map((entry, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      entry.direction === "client-to-server"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {entry.direction === "client-to-server"
                      ? "QUERY"
                      : "RESPONSE"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {entry.query && (
                  <div className="mb-2">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {entry.query.type} {entry.protocol.toUpperCase()}
                    </div>
                    {entry.query.content && (
                      <div className="text-gray-600 dark:text-gray-300 font-mono text-xs bg-gray-100 dark:bg-gray-600 p-2 rounded">
                        {entry.query.content}
                      </div>
                    )}
                  </div>
                )}

                {entry.response && (
                  <div className="mb-2">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {entry.response.type} {entry.protocol.toUpperCase()}
                    </div>
                    {entry.response.isError && (
                      <div className="text-red-600 dark:text-red-400 text-xs">
                        Error Response
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Connection: {entry.connectionId} • Size: {entry.size} bytes
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DatabaseView;
