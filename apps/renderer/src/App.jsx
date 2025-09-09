import { useState, useEffect } from "react";
import {
  MdDashboard,
  MdSettings,
  MdAdd,
  MdClose,
  MdMenu,
  MdSearch,
  MdImportExport,
  MdCallMade,
  MdStorage,
} from "react-icons/md";
import NavItem from "./components/common/NavItem";
import DashboardView from "./components/views/DashboardView";
import ProxiesView from "./components/views/ProxiesView";
import ProjectView from "./components/views/ProjectView";
import OutgoingRequestView from "./components/views/OutgoingRequestView";
import DatabaseProxyView from "./components/views/DatabaseProxyView";
import ExportImportView from "./components/views/ExportImportView";
import SettingsView from "./components/views/SettingsView";
import HelpModal from "./components/modals/HelpModal";
import DeleteConfirmationModal from "./components/modals/DeleteConfirmationModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [currentProject, setCurrentProject] = useState(null); // Selected project/proxy
  const [projects, setProjects] = useState([]); // Renamed from proxies
  const [requests, setRequests] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [databaseMocks, setDatabaseMocks] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    project: null,
  });

  const loadProjects = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getProxies();
        setProjects(result);

        // Update currentProject if it exists and we're viewing a specific project
        if (currentProject) {
          const updatedProject = result.find(
            (p) => p.port === currentProject.port
          );
          if (updatedProject) {
            setCurrentProject(updatedProject);
          }
        }

        // Load mocks and requests for all active projects
        await loadAllMocks(result);
        await loadAllRequests(result);
        await loadAllDatabaseMocks();
      } catch (error) {
        console.error("Failed to load projects:", error);
        // Set empty arrays to prevent errors
        setProjects([]);
        setMocks([]);
        setRequests([]);
      }
    }
  };

  const loadAllMocks = async (projectList) => {
    if (window.electronAPI && projectList && projectList.length > 0) {
      try {
        const allMocks = [];
        for (const project of projectList) {
          const result = await window.electronAPI.getMocks(project.port);
          if (result.success) {
            allMocks.push(
              ...result.mocks.map((mock) => ({
                ...mock,
                proxyPort: project.port,
              }))
            );
          }
        }
        setMocks(allMocks);
      } catch (error) {
        console.error("Failed to load mocks:", error);
        setMocks([]);
      }
    }
  };

  const loadAllRequests = async (projectList) => {
    if (window.electronAPI && projectList && projectList.length > 0) {
      try {
        const allRequests = [];
        for (const project of projectList) {
          const result = await window.electronAPI.getRequests(project.port);
          if (result.success) {
            allRequests.push(...result.requests);
          }
        }
        setRequests(allRequests);
      } catch (error) {
        console.error("Failed to load requests:", error);
        setRequests([]);
      }
    }
  };

  const loadAllDatabaseMocks = async () => {
    if (window.electronAPI && window.electronAPI.getDatabaseMocks) {
      try {
        const result = await window.electronAPI.getDatabaseMocks();
        if (result.success && Array.isArray(result.mocks)) {
          setDatabaseMocks(result.mocks);
        } else if (Array.isArray(result)) {
          setDatabaseMocks(result);
        } else {
          setDatabaseMocks([]);
        }
      } catch (error) {
        console.error("Failed to load database mocks:", error);
        setDatabaseMocks([]);
      }
    }
  };

  const refreshMocks = async () => {
    if (projects.length > 0) {
      await loadAllMocks(projects);
    }
  };

  const refreshDatabaseMocks = async () => {
    await loadAllDatabaseMocks();
  };

  const startProject = async (
    port,
    name,
    targetHost = "localhost",
    targetPort = 3000
  ) => {
    if (window.electronAPI) {
      const result = await window.electronAPI.startProxy({
        port,
        name,
        targetHost,
        targetPort,
      });
      if (result.success) {
        loadProjects();
        // Auto-select the newly created project
        setCurrentProject({ port, name, targetHost, targetPort });
        setCurrentView("project");
      }
      return result;
    }
  };

  const stopProject = async (port) => {
    if (window.electronAPI) {
      const result = await window.electronAPI.stopProxy(port);
      if (result.success) {
        loadProjects();
        setRequests((prev) => prev.filter((req) => req.proxyPort !== port));
        // If we're currently viewing this project, go back to dashboard
        if (currentProject && currentProject.port === port) {
          setCurrentProject(null);
          setCurrentView("dashboard");
        }
      }
      return result;
    }
  };

  const restartAllProxies = async () => {
    if (window.electronAPI && window.electronAPI.restartAllProxies) {
      const result = await window.electronAPI.restartAllProxies();
      if (result.success) {
        loadProjects(); // Reload to get updated states
        // Show notification about results
        const message = `Successfully restarted ${result.restarted} proxies${
          result.failed > 0 ? `, ${result.failed} failed` : ""
        }`;
        console.log(message);
      }
      return result;
    }
  };

  const disableProject = async (port) => {
    if (window.electronAPI && window.electronAPI.disableProxy) {
      const result = await window.electronAPI.disableProxy(port);
      if (result.success) {
        loadProjects();
      }
      return result;
    }
  };

  const enableProject = async (port) => {
    if (window.electronAPI && window.electronAPI.enableProxy) {
      const result = await window.electronAPI.enableProxy(port);
      if (result.success) {
        loadProjects();
      }
      return result;
    }
  };

  const deleteProject = async (port) => {
    const project = projects.find((p) => p.port === port);
    if (!project) return;

    setDeleteModal({ isOpen: true, project });
  };

  const handleConfirmDelete = async () => {
    const project = deleteModal.project;
    if (!project) return;

    try {
      // Stop the proxy first
      await stopProject(project.port);

      // Delete the project data
      if (window.electronAPI && window.electronAPI.deleteProxy) {
        const result = await window.electronAPI.deleteProxy(project.port);
        console.log(result);
      }

      // Refresh the project list to ensure UI is up to date
      await loadProjects();

      // Close modal
      setDeleteModal({ isOpen: false, project: null });
    } catch (error) {
      alert(`Failed to delete project: ${error.message}`);
      // Keep modal open on error
    }
  };

  const exportSingleProject = async (project) => {
    try {
      if (window.electronAPI && window.electronAPI.exportSingleProject) {
        const result = await window.electronAPI.exportSingleProject(
          project.port
        );
        if (result.success) {
          alert(
            `Project "${project.name}" exported successfully to: ${result.filePath}`
          );
        } else {
          alert(`Failed to export project: ${result.error}`);
        }
      }
    } catch (error) {
      alert(`Failed to export project: ${error.message}`);
    }
  };

  useEffect(() => {
    // Debug electronAPI availability
    console.log("🔧 App: useEffect running, checking electronAPI...");
    console.log("🔧 App: window.electronAPI:", !!window.electronAPI);
    console.log(
      "🔧 App: onDatabaseQuery available:",
      !!window.electronAPI?.onDatabaseQuery
    );
    console.log(
      "🔧 App: onDatabaseResponse available:",
      !!window.electronAPI?.onDatabaseResponse
    );

    // Load initial data
    loadProjects();

    // Set up IPC listeners for real-time updates
    if (window.electronAPI) {
      window.electronAPI.onProxyRequest((data) => {
        // Use functional state update to avoid stale closure issues
        setRequests((prev) => [data.request, ...prev]);
      });

      window.electronAPI.onProxyResponse((data) => {
        // Use functional state update to avoid stale closure issues
        setRequests((prev) =>
          prev.map((req) =>
            req.id === data.request.id
              ? {
                  ...req,
                  response: data.response,
                  status: data.request.status, // Use the status from the request object
                  duration: data.request.duration, // Use duration from request object
                  completedAt: data.request.timestamp,
                }
              : req
          )
        );
      });

      window.electronAPI.onProxyError((data) => {
        // console.error(`Proxy error on port ${data.proxyId}:`, data);
        // Show a user-friendly error message
        const errorMessage = `Proxy Error (Port ${data.proxyId}): ${data.error}`;

        // You could also show a toast notification or add to a notification system
        alert(errorMessage);

        // Optionally, you could add error tracking to state
        // setProxyErrors(prev => [...prev, data]);
      });

      window.electronAPI.onMockAutoCreated((data) => {
        // When a mock is auto-created, add it to the mocks list
        setMocks((prev) => [
          ...prev,
          {
            ...data.mock,
            proxyPort: data.proxyId,
          },
        ]);
      });

      // Listen for database mock events for real-time UI updates
      if (window.electronAPI.onDatabaseMockAdded) {
        window.electronAPI.onDatabaseMockAdded((mockData) => {
          console.log("🔍 App: Database mock added:", mockData);
          setDatabaseMocks((prev) => [mockData, ...prev]);
        });
      }

      if (window.electronAPI.onDatabaseMockUpdated) {
        window.electronAPI.onDatabaseMockUpdated((mockData) => {
          console.log("🔍 App: Database mock updated:", mockData);
          setDatabaseMocks((prev) =>
            prev.map((mock) => (mock.id === mockData.id ? mockData : mock))
          );
        });
      }

      if (window.electronAPI.onDatabaseMockRemoved) {
        window.electronAPI.onDatabaseMockRemoved((data) => {
          console.log("🔍 App: Database mock removed:", data);
          setDatabaseMocks((prev) =>
            prev.filter(
              (mock) =>
                !(
                  mock.proxyPort === data.proxyPort && mock.query === data.query
                )
            )
          );
        });
      }

      if (window.electronAPI.onDatabaseMockToggled) {
        window.electronAPI.onDatabaseMockToggled((mockData) => {
          console.log("🔍 App: Database mock toggled:", mockData);
          setDatabaseMocks((prev) =>
            prev.map((mock) => (mock.id === mockData.id ? mockData : mock))
          );
        });
      }

      if (window.electronAPI.onDatabaseMockAutoCreated) {
        window.electronAPI.onDatabaseMockAutoCreated((data) => {
          console.log("🔍 App: Database mock auto-created:", data);
          setDatabaseMocks((prev) => [data.mock, ...prev]);
        });
      }

      // Listen for database proxy events and add them to requests
      if (window.electronAPI.onDatabaseQuery) {
        console.log("🔧 App: Setting up onDatabaseQuery listener");
        window.electronAPI.onDatabaseQuery((data) => {
          console.log("🔍 App: Received database query event:", data);

          // Transform database query to request format
          const request = {
            id: data.id || `db-${Date.now()}-${Math.random()}`,
            timestamp: data.timestamp || new Date().toISOString(),
            method: "DB_QUERY",
            url: data.query || data.rawQuery?.sql || "Database Query",
            headers: {},
            body: data.query || data.rawQuery?.sql || "",
            proxyPort: data.proxyPort || data.port,
            status: data.status || "pending",
            type: "database",
            protocol: data.protocol,
            duration: data.duration,
          };

          // Add to requests list
          setRequests((prev) => [request, ...prev]);
        });
      } else {
        console.error(
          "❌ App: window.electronAPI.onDatabaseQuery is not available"
        );
      }

      if (window.electronAPI.onDatabaseResponse) {
        console.log("🔧 App: Setting up onDatabaseResponse listener");
        window.electronAPI.onDatabaseResponse((data) => {
          console.log("📋 App: Received database response event:", data);

          // Update the request with response data
          setRequests((prev) =>
            prev.map((req) =>
              req.id === data.id
                ? {
                    ...req,
                    response: data.response,
                    status: data.status || "success",
                    duration: data.duration,
                    completedAt: data.timestamp,
                  }
                : req
            )
          );
        });
      } else {
        console.error(
          "❌ App: window.electronAPI.onDatabaseResponse is not available"
        );
      }
    }
  }, []);

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    currentView,
    setCurrentView,
    showHelp,
    setShowHelp,
    loadProjects,
    projects,
    currentProject,
    setCurrentProject,
  });

  useEffect(() => {
    setTimeout(refreshMocks(), 0);
  }, [mocks]);

  return (
    <div
      className="min-h-screen bg-gray-100 lg:flex"
      data-testid="app-container"
    >
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full lg:h-screen">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👃</span>
              <h1 className="text-xl font-bold text-gray-900">Sniffler</h1>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
            >
              <MdClose className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            <NavItem
              icon={<MdDashboard />}
              label="Dashboard"
              active={currentView === "dashboard"}
              onClick={() => {
                setCurrentView("dashboard");
                setCurrentProject(null);
                setSidebarOpen(false); // Close mobile sidebar on navigation
              }}
            />

            {/* Projects Section */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Projects
                </h3>
                <button
                  onClick={() => {
                    setCurrentView("new-project");
                    setSidebarOpen(false);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                  title="Create New Project"
                >
                  <MdAdd className="w-5 h-5" />
                </button>
              </div>

              {(projects || []).length === 0 ? (
                <div className="text-sm text-gray-500 italic p-2">
                  No projects yet
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.map((project, index) => (
                    <NavItem
                      key={`${project.port}-${project.name}-${index}`}
                      icon={<MdSearch />}
                      label={project.name}
                      active={
                        currentProject && currentProject.port === project.port
                      }
                      onClick={() => {
                        setCurrentProject(project);
                        setCurrentView("project");
                        setSidebarOpen(false); // Close mobile sidebar on navigation
                      }}
                      subtitle={`Port ${project.port}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Global Features */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Global
              </h3>
              <NavItem
                icon={<MdCallMade />}
                label="Outgoing Requests"
                active={currentView === "outgoing"}
                onClick={() => {
                  setCurrentView("outgoing");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={<MdStorage />}
                label="Database Proxies"
                active={currentView === "database"}
                onClick={() => {
                  setCurrentView("database");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={<MdImportExport />}
                label="Export/Import"
                active={currentView === "export"}
                onClick={() => {
                  setCurrentView("export");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={<MdSettings />}
                label="Settings"
                active={currentView === "settings"}
                data-testid="nav-settings"
                onClick={() => {
                  setCurrentView("settings");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                }}
              />
            </div>
          </nav>

          {/* Trial Info */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800">
                Trial Version
              </div>
              <div className="text-xs text-blue-600">27 days remaining</div>
              <button className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                Upgrade
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen flex flex-col">
        {/* Mobile header with hamburger menu */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600"
            aria-label="Open navigation menu"
          >
            <MdMenu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 capitalize">
            {currentView === "new-project"
              ? "New Project"
              : currentView === "outgoing"
              ? "Outgoing Requests"
              : currentView}
          </h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        <main className="flex-1 p-4 sm:p-6">
          {currentView === "dashboard" && (
            <DashboardView
              projects={projects}
              requests={requests}
              mocks={mocks}
              onSelectProject={(project) => {
                setCurrentProject(project);
                setCurrentView("project");
              }}
              onCreateProject={() => {
                setCurrentView("new-project");
                setCurrentProject(null);
              }}
            />
          )}
          {currentView === "new-project" && (
            <ProxiesView
              proxies={projects}
              onStartProxy={startProject}
              onStopProxy={stopProject}
              onDisableProxy={disableProject}
              onEnableProxy={enableProject}
              onRestartAll={restartAllProxies}
              isCreationMode={true}
            />
          )}
          {currentView === "project" && currentProject && (
            <ProjectView
              project={currentProject}
              requests={requests.filter(
                (req) => req.proxyPort === currentProject.port
              )}
              mocks={mocks.filter(
                (mock) => mock.proxyPort === currentProject.port
              )}
              onRefreshMocks={refreshMocks}
              onStopProject={stopProject}
              onExportProject={exportSingleProject}
              onEnableProject={enableProject}
              onDisableProject={disableProject}
              onDeleteProject={deleteProject}
            />
          )}
          {currentView === "outgoing" && <OutgoingRequestView />}
          {currentView === "database" && (
            <DatabaseProxyView
              databaseMocks={databaseMocks}
              onRefreshDatabaseMocks={refreshDatabaseMocks}
            />
          )}
          {currentView === "export" && (
            <ExportImportView
              onImportComplete={() => {
                // Refresh all data after import
                loadProjects();
              }}
            />
          )}
          {currentView === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, project: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        itemName={deleteModal.project?.name}
        itemType="project"
        description={
          deleteModal.project
            ? `Port ${deleteModal.project.port} → ${deleteModal.project.targetHost}:${deleteModal.project.targetPort}`
            : ""
        }
      />
    </div>
  );
}

export default App;
