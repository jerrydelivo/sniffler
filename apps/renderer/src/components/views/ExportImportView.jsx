import { useState, useEffect } from "react";
import { MdFileUpload, MdFolder, MdFileDownload } from "react-icons/md";

function ExportImportView({ onImportComplete }) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [importMode, setImportMode] = useState("full"); // "full" or "selective"
  const [importData, setImportData] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [currentProjects, setCurrentProjects] = useState([]);

  // Load current projects for conflict detection
  useEffect(() => {
    const loadCurrentProjects = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.getProxies();
        setCurrentProjects(result || []);
      }
    };
    loadCurrentProjects();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage("");

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.exportAllData();

        if (result.success) {
          setMessage(`✅ Data exported successfully to: ${result.filePath}`);
        } else {
          setMessage(`❌ Export failed: ${result.error}`);
        }
      } else {
        setMessage("❌ Export not available - Electron API not found");
      }
    } catch (error) {
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setMessage("");

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.chooseImportFile();

        if (result.success) {
          const data = result.data;

          if (importMode === "selective") {
            // Show selective import interface
            setImportData(data);
            setSelectedProjects([]);
            setMessage("");
            setIsImporting(false);
            return;
          }

          // Full import
          const importResult = await window.electronAPI.importAllData(data);

          if (importResult.success) {
            const importedData = data;
            const proxyCount = importedData.proxies
              ? importedData.proxies.length
              : 0;
            const mockCount = importedData.mocks
              ? Object.values(importedData.mocks).flat().length
              : 0;
            const requestCount = importedData.requests
              ? Object.values(importedData.requests).flat().length
              : 0;

            setMessage(
              `✅ Import successful! Imported ${proxyCount} projects, ${mockCount} mocks, and ${requestCount} requests.`
            );

            // Trigger refresh in parent component
            if (onImportComplete) {
              onImportComplete();
            }
          } else {
            setMessage(`❌ Import failed: ${importResult.error}`);
          }
        } else if (result.cancelled) {
          setMessage("Import cancelled");
        } else {
          setMessage(`❌ Import failed: ${result.error}`);
        }
      } else {
        setMessage("❌ Import not available - Electron API not found");
      }
    } catch (error) {
      setMessage(`❌ Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectiveImport = async () => {
    if (selectedProjects.length === 0) {
      setMessage("❌ Please select at least one project to import");
      return;
    }

    setIsImporting(true);
    setMessage("");

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.importSelectedProjects({
          importData,
          selectedProjectPorts: selectedProjects,
        });

        if (result.success) {
          const stats = result.stats;
          setMessage(
            `✅ Selective import successful! Imported ${stats.projects} projects, ${stats.mocks} mocks, and ${stats.requests} requests.`
          );

          // Reset selective import state
          setImportData(null);
          setSelectedProjects([]);
          setImportMode("full");

          // Trigger refresh in parent component
          if (onImportComplete) {
            onImportComplete();
          }
        } else {
          setMessage(`❌ Selective import failed: ${result.error}`);
        }
      }
    } catch (error) {
      setMessage(`❌ Selective import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const cancelSelectiveImport = () => {
    setImportData(null);
    setSelectedProjects([]);
    setImportMode("full");
    setMessage("");
  };

  const getProjectConflicts = (projects) => {
    if (!projects) return [];
    return projects.filter((importProject) =>
      currentProjects.some(
        (currentProject) => currentProject.port === importProject.port
      )
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Export & Import
        </h1>
      </div>

      {/* Status Message */}
      {message && (
        <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <MdFileUpload className="mr-2" />
            Export Data
          </h2>

          <div className="text-center py-8">
            <div className="text-4xl mb-4 flex justify-center">
              <MdFolder className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Export Configuration
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Export your projects, mocks, requests, and settings to share with
              your team or backup your configuration
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              <MdFileDownload />
              {isExporting ? "Exporting..." : "Export to File"}
            </button>
          </div>
        </div>

        {/* Import Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">📥</span>
            Import Data
          </h2>

          {!importData ? (
            <div className="space-y-4">
              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Import Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="importMode"
                      value="full"
                      checked={importMode === "full"}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Full Import (Replace all data)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="importMode"
                      value="selective"
                      checked={importMode === "selective"}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Selective Import (Choose specific projects)
                    </span>
                  </label>
                </div>
              </div>

              <div className="text-center py-4">
                <div className="text-4xl mb-4">📂</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {importMode === "full"
                    ? "Import Configuration"
                    : "Selective Import"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {importMode === "full"
                    ? "Import previously exported configuration files. This will replace your current configuration."
                    : "Choose an export file, then select which projects you want to import."}
                </p>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {isImporting ? "Loading..." : "Choose File & Import"}
                </button>
              </div>
            </div>
          ) : (
            /* Selective Import Interface */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Select Projects to Import
                </h3>
                <button
                  onClick={cancelSelectiveImport}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {importData.proxies && importData.proxies.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {importData.proxies.map((project) => {
                    const hasConflict = currentProjects.some(
                      (p) => p.port === project.port
                    );
                    const mockCount =
                      importData.mocks && importData.mocks[project.port]
                        ? importData.mocks[project.port].length
                        : 0;
                    const requestCount =
                      importData.requests && importData.requests[project.port]
                        ? importData.requests[project.port].length
                        : 0;

                    return (
                      <div
                        key={project.port}
                        className={`border rounded-lg p-3 ${
                          hasConflict
                            ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900 dark:border-yellow-600"
                            : "border-gray-200 dark:border-gray-600"
                        }`}
                      >
                        <label className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(project.port)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjects([
                                  ...selectedProjects,
                                  project.port,
                                ]);
                              } else {
                                setSelectedProjects(
                                  selectedProjects.filter(
                                    (p) => p !== project.port
                                  )
                                );
                              }
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {project.name}
                              </span>
                              {hasConflict && (
                                <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                  Port Conflict
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Port {project.port} →{" "}
                              {project.targetHost || "localhost"}:
                              {project.targetPort || 3000}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {mockCount} mocks, {requestCount} requests
                            </div>
                            {hasConflict && (
                              <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                ⚠️ Will replace existing project on port{" "}
                                {project.port}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No projects found in the import file.
                </p>
              )}

              {importData.proxies && importData.proxies.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                  <button
                    onClick={() =>
                      setSelectedProjects(importData.proxies.map((p) => p.port))
                    }
                    className="text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedProjects([])}
                    className="text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Select None
                  </button>
                  <button
                    onClick={handleSelectiveImport}
                    disabled={isImporting || selectedProjects.length === 0}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isImporting
                      ? "Importing..."
                      : `Import ${selectedProjects.length} Selected`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          💡 What gets exported/imported?
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <li>
            • <strong>Project configurations:</strong> Proxy settings, target
            hosts, and ports
          </li>
          <li>
            • <strong>Mock definitions:</strong> All your saved API mocks with
            responses
          </li>
          <li>
            • <strong>Request history:</strong> Recent captured requests (if
            enabled in settings)
          </li>
          <li>
            • <strong>Application settings:</strong> Your preferences and
            configuration
          </li>
        </ul>
        <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded border-l-4 border-yellow-400">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            <strong>⚠️ Warning:</strong> Full import will replace your current
            configuration. Use selective import to import only specific
            projects. Make sure to export your current setup first if you want
            to keep it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExportImportView;
