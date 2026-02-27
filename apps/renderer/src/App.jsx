import { useState, useEffect, useCallback } from "react";
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
import appIcon from "../../../build/icon.png";
import DashboardView from "./components/views/DashboardView";
import ProxiesView from "./components/views/ProxiesView";
import ProjectView from "./components/views/ProjectView";
import OutgoingRequestView from "./components/views/OutgoingRequestView";
import DatabaseProxyView from "./components/views/DatabaseProxyView";
import ExportImportView from "./components/views/ExportImportView";
import SettingsView from "./components/views/SettingsView";
import LicenseView from "./components/views/LicenseView";
import HelpModal from "./components/modals/HelpModal";
import DeleteConfirmationModal from "./components/modals/DeleteConfirmationModal";
import UpdateModal from "./components/modals/UpdateModal";
import Toast from "./components/common/Toast";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useElectronInputReliability } from "./hooks/useInputReliability";

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [currentProject, setCurrentProject] = useState(null); // Selected project/proxy
  const [projects, setProjects] = useState([]); // Renamed from proxies
  const [requests, setRequests] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [outgoingMocks, setOutgoingMocks] = useState([]);
  const [databaseMocks, setDatabaseMocks] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    project: null,
  });

  // License state
  const [licenseInfo, setLicenseInfo] = useState({
    isPremium: false,
    status: "free",
    message: "Loading license status...",
    isValid: true,
  });

  // Auto-updater state
  const [updateModal, setUpdateModal] = useState({
    show: false,
    type: "available", // "available", "downloading", "ready"
    updateInfo: null,
  });

  // Notification tracking state for different proxy types
  const [regularProxyNotifications, setRegularProxyNotifications] = useState(
    new Map()
  );
  const [outgoingProxyNotifications, setOutgoingProxyNotifications] = useState(
    new Map()
  );
  const [databaseProxyNotifications, setDatabaseProxyNotifications] = useState(
    new Map()
  );

  // Project-level notification tracking (for sidebar badges)
  const [projectNotifications, setProjectNotifications] = useState(new Map());

  // Track projects that have had their mock difference notifications viewed
  const [viewedMockDifferences, setViewedMockDifferences] = useState(new Set());

  // Recent mock differences for all projects
  const [recentMockDifferences, setRecentMockDifferences] = useState([]);

  // Global toast state for notifications
  const [appToast, setAppToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const loadProjects = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getProxies();
        setProjects(result);

        // Update currentProject if it exists and we're viewing a specific project
        setCurrentProject((prev) => {
          if (prev) {
            const updatedProject = result.find((p) => p.port === prev.port);
            return updatedProject || prev;
          }
          return prev;
        });

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
  }, []);

  const loadAllMocks = useCallback(async (projectList) => {
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
  }, []);

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

  // Load all outgoing mocks once at startup
  const loadAllOutgoingMocks = useCallback(async () => {
    if (window.electronAPI?.getOutgoingMocks) {
      try {
        const result = await window.electronAPI.getOutgoingMocks();
        if (result?.success && Array.isArray(result.mocks)) {
          setOutgoingMocks(result.mocks);
        } else if (Array.isArray(result)) {
          setOutgoingMocks(result);
        } else {
          setOutgoingMocks([]);
        }
      } catch (e) {
        console.error("Failed to load outgoing mocks:", e);
        setOutgoingMocks([]);
      }
    }
  }, []);

  const refreshMocks = useCallback(async () => {
    if (projects.length > 0) {
      await loadAllMocks(projects);
    }
  }, [projects, loadAllMocks]);

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

  // Load license info
  const loadLicenseInfo = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getLicenseInfo();
        setLicenseInfo(result);
      } catch (error) {
        console.error("Failed to load license info:", error);
        setLicenseInfo({
          isPremium: false,
          status: "free",
          message: "Failed to load license status",
          isValid: true,
        });
      }
    }
  }, []);

  // Start free trial (temporary functionality while auto-activation is disabled)
  const startFreeTrial = async () => {
    if (window.electronAPI) {
      try {
        setIsStartingTrial(true);
        const result = await window.electronAPI.startFreeTrial();

        if (result.success) {
          showAppToast(
            "🎉 Free trial started successfully! Premium features are now unlocked.",
            "success"
          );
          // License status will be updated via the onLicenseStatusChanged listener
        } else {
          showAppToast(`❌ Failed to start trial: ${result.error}`, "error");
        }
      } catch (error) {
        console.error("Failed to start trial:", error);
        showAppToast("❌ Failed to start trial. Please try again.", "error");
      } finally {
        setIsStartingTrial(false);
      }
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
    loadAllOutgoingMocks();
    // Force a fresh license check first so renderer gets the latest status
    (async () => {
      try {
        await window.electronAPI?.checkLicenseStatus?.();
      } catch {}
      await loadLicenseInfo();
    })();

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

        // Check if this is a mock difference and show toast notification
        if (data.mockDifference && data.request && data.response) {
          console.log("🚨 Mock difference detected in proxy response:", data);
          showAppToast(
            `⚠️ Response differs from mock for ${data.request.method} ${data.request.url}`,
            "warning"
          );

          // Add to recent mock differences for the RequestsView
          const differenceEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            method: data.request.method,
            url: data.request.url,
            proxyPort: data.request.proxyPort,
            summary: "Response differs from existing mock",
          };

          setRecentMockDifferences((prev) => {
            const updated = [differenceEntry, ...prev.slice(0, 9)]; // Keep last 10
            return updated;
          });

          // Update notification counts
          setRegularProxyNotifications((prev) => {
            const newNotifications = new Map(prev);
            const currentCount =
              newNotifications.get(data.request.proxyPort) || 0;
            newNotifications.set(data.request.proxyPort, currentCount + 1);
            return newNotifications;
          });

          // Update project-level notifications
          setProjectNotifications((prev) => {
            const newNotifications = new Map(prev);
            // Use the proxyPort directly since that's the project identifier
            const currentCount =
              newNotifications.get(data.request.proxyPort) || 0;
            newNotifications.set(data.request.proxyPort, currentCount + 1);
            return newNotifications;
          });
        }
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

      // Note: mock-auto-created is handled further below with toast + dedup

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

          // Increment database proxy notification badges
          const port = data?.proxyPort || data?.mock?.proxyPort || data?.port;
          if (port) {
            setDatabaseProxyNotifications((prev) => {
              const next = new Map(prev);
              const current = next.get(port) || 0;
              next.set(port, current + 1);
              return next;
            });
          }
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

          // Check if this is a mock difference and show toast notification
          if (data.mockDifference && data.query) {
            console.log("🚨 Database mock difference detected:", data);
            showAppToast(
              `⚠️ Database response differs from mock for query: ${data.query}`,
              "warning"
            );

            // Add to recent mock differences
            const differenceEntry = {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              method: "DB_QUERY",
              url: data.query,
              proxyPort: data.proxyPort || data.port,
              summary: "Database response differs from existing mock",
            };

            setRecentMockDifferences((prev) => {
              const updated = [differenceEntry, ...prev.slice(0, 9)];
              return updated;
            });

            // Update notification counts
            setDatabaseProxyNotifications((prev) => {
              const newNotifications = new Map(prev);
              const currentCount =
                newNotifications.get(data.proxyPort || data.port) || 0;
              newNotifications.set(
                data.proxyPort || data.port,
                currentCount + 1
              );
              return newNotifications;
            });
          }
        });
      } else {
        console.error(
          "❌ App: window.electronAPI.onDatabaseResponse is not available"
        );
      }

      // Listen for mock difference events for all proxy types
      if (window.electronAPI.onMockDifferenceDetected) {
        console.log("🔧 App: Setting up onMockDifferenceDetected listener");
        window.electronAPI.onMockDifferenceDetected((data) => {
          console.log("🚨 App: MOCK DIFFERENCE EVENT RECEIVED!", data);
          const { proxyId, request, mock, comparison } = data;

          // Show toast notification
          console.log(
            "📢 App: About to show toast notification for mock difference"
          );
          showAppToast(
            `⚠️ Response differs from mock for ${request.method} ${request.url}`,
            "warning"
          );

          // Add to recent mock differences for the RequestsView
          const differenceEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url,
            proxyPort: proxyId,
            summary: comparison?.summary || "Response differs from mock",
          };

          setRecentMockDifferences((prev) => {
            const updated = [differenceEntry, ...prev.slice(0, 9)]; // Keep last 10
            console.log("📢 App: Updated recent mock differences:", updated);
            return updated;
          });

          setRegularProxyNotifications((prev) => {
            const newNotifications = new Map(prev);
            const currentCount = newNotifications.get(proxyId) || 0;
            newNotifications.set(proxyId, currentCount + 1);
            console.log(
              "📢 App: Updated regular proxy notifications:",
              newNotifications
            );
            return newNotifications;
          });

          // Also track at project level for sidebar notifications
          setProjectNotifications((prev) => {
            const newNotifications = new Map(prev);
            // Use proxyId directly since it represents the project port
            const currentCount = newNotifications.get(proxyId) || 0;
            newNotifications.set(proxyId, currentCount + 1);
            console.log(
              "📢 App: Updated project notifications:",
              newNotifications
            );
            return newNotifications;
          });
        });
      } else {
        console.log(
          "❌ App: window.electronAPI.onMockDifferenceDetected not available"
        );
      }

      if (window.electronAPI.onOutgoingMockDifferenceDetected) {
        window.electronAPI.onOutgoingMockDifferenceDetected((data) => {
          console.log("Event: outgoing proxy mock difference detected", data);
          const { proxyPort, request, mock, comparison } = data;

          // Show toast notification
          showAppToast(
            `⚠️ Outgoing request response differs from mock for ${request.method} ${request.url}`,
            "warning"
          );

          setOutgoingProxyNotifications((prev) => {
            const newNotifications = new Map(prev);
            const currentCount = newNotifications.get(proxyPort) || 0;
            newNotifications.set(proxyPort, currentCount + 1);
            return newNotifications;
          });

          // Outgoing mock differences do not affect individual project badges
        });
      }

      if (window.electronAPI.onDatabaseMockDifferenceDetected) {
        window.electronAPI.onDatabaseMockDifferenceDetected((data) => {
          console.log("Event: database proxy mock difference detected", data);
          const { proxyPort, request, mock, comparison } = data;

          // Show toast notification
          showAppToast(
            `⚠️ Database response differs from mock for query: ${
              request.query || request.pattern
            }`,
            "warning"
          );

          setDatabaseProxyNotifications((prev) => {
            const newNotifications = new Map(prev);
            const currentCount = newNotifications.get(proxyPort) || 0;
            newNotifications.set(proxyPort, currentCount + 1);
            return newNotifications;
          });

          // Database mock differences do not affect individual project badges
        });
      }

      // Listen for mock auto-replaced events
      if (window.electronAPI.onMockAutoReplaced) {
        window.electronAPI.onMockAutoReplaced((data) => {
          console.log("Event: mock auto-replaced", data);
          const { proxyId, request, oldMock, newMock } = data;

          // Show toast notification for auto-replaced mock
          showAppToast(
            `🔄 Mock automatically updated for ${request.method} ${request.url}`,
            "success"
          );

          // Update mocks state directly instead of refreshing
          setMocks((prev) =>
            prev.map((mock) =>
              mock.id === oldMock.id ? { ...newMock, proxyPort: proxyId } : mock
            )
          );
        });
      }

      // Listen for mock auto-created events
      if (window.electronAPI.onMockAutoCreated) {
        window.electronAPI.onMockAutoCreated((data) => {
          console.log("Event: mock auto-created", data);
          const { mock, request } = data;

          // Show toast notification for auto-created mock
          const method = request?.method || mock?.method || "";
          const url = request?.url || mock?.url || "";
          showAppToast(
            `🎭 New mock auto-created for ${method} ${url}`.trim(),
            "info"
          );

          // Deduplicate by mock id (most robust) and method+url fallback
          setMocks((prev) => {
            const exists = prev.some(
              (m) =>
                m.id === mock.id ||
                (m.method === mock.method &&
                  m.url === mock.url &&
                  m.proxyPort === data.proxyId)
            );
            if (exists) return prev;
            return [{ ...mock, proxyPort: data.proxyId }, ...prev];
          });

          // Increment badges for this project proxy
          if (data.proxyId) {
            setRegularProxyNotifications((prev) => {
              const newNotifications = new Map(prev);
              const current = newNotifications.get(data.proxyId) || 0;
              newNotifications.set(data.proxyId, current + 1);
              return newNotifications;
            });

            setProjectNotifications((prev) => {
              const newNotifications = new Map(prev);
              const current = newNotifications.get(data.proxyId) || 0;
              newNotifications.set(data.proxyId, current + 1);
              return newNotifications;
            });
          }
        });
      }

      // Listen for outgoing mock auto-created events (outgoing proxies)
      if (window.electronAPI.onOutgoingMockAutoCreated) {
        window.electronAPI.onOutgoingMockAutoCreated((data) => {
          console.log("Event: outgoing mock auto-created", data);
          const { mock, request } = data;
          showAppToast(
            `🎭 Outgoing mock auto-created for ${
              request?.method || mock?.method
            } ${request?.url || mock?.url}`,
            "info"
          );
          setOutgoingMocks((prev) => [mock, ...prev]);

          if (data.proxyPort) {
            setOutgoingProxyNotifications((prev) => {
              const newNotifications = new Map(prev);
              const current = newNotifications.get(data.proxyPort) || 0;
              newNotifications.set(data.proxyPort, current + 1);
              return newNotifications;
            });
          }
        });
      }

      // Listen for license status changes
      if (window.electronAPI.onLicenseStatusChanged) {
        window.electronAPI.onLicenseStatusChanged((newLicenseInfo) => {
          console.log("License status changed:", newLicenseInfo);

          // Store previous license state to detect changes
          setLicenseInfo((prevLicenseInfo) => {
            const wasNotPremium = !prevLicenseInfo?.isPremium;
            const isNowPremium = newLicenseInfo.isPremium;

            // Show appropriate toast notifications based on license changes
            if (wasNotPremium && isNowPremium) {
              // Just became premium - show success message
              showAppToast(
                "🎉 Premium license activated successfully!",
                "success"
              );

              // Trigger a refresh of all premium feature checks by dispatching a custom event
              window.dispatchEvent(
                new CustomEvent("licenseStatusChanged", {
                  detail: newLicenseInfo,
                })
              );
            } else if (newLicenseInfo.status === "trial_started") {
              showAppToast(
                "🎉 Free trial started - 30 days of premium features!",
                "info"
              );

              // Trigger refresh for trial start as well
              window.dispatchEvent(
                new CustomEvent("licenseStatusChanged", {
                  detail: newLicenseInfo,
                })
              );
            } else if (
              newLicenseInfo.status === "trial_active" &&
              newLicenseInfo.isTrial &&
              prevLicenseInfo?.status !== "trial_active"
            ) {
              // Trial is still active (don't show on every update)
              showAppToast(
                "✅ Free trial is active - premium features unlocked!",
                "info"
              );
            } else if (
              newLicenseInfo.status === "free" &&
              newLicenseInfo.trialUsed &&
              !isNowPremium &&
              prevLicenseInfo?.isTrial
            ) {
              // Trial just expired (only show when transitioning from trial to free)
              showAppToast(
                "⏰ Trial expired - upgrade to continue using premium features",
                "warning"
              );

              // Trigger refresh for trial expiry
              window.dispatchEvent(
                new CustomEvent("licenseStatusChanged", {
                  detail: newLicenseInfo,
                })
              );
            } else if (
              prevLicenseInfo &&
              (wasNotPremium !== isNowPremium ||
                prevLicenseInfo.isTrial !== newLicenseInfo.isTrial)
            ) {
              // Any other significant license change - trigger refresh
              window.dispatchEvent(
                new CustomEvent("licenseStatusChanged", {
                  detail: newLicenseInfo,
                })
              );
            }

            return newLicenseInfo;
          });
        });
      }

      // Listen for auto-updater events
      if (window.electronAPI.onAutoUpdater) {
        window.electronAPI.onAutoUpdater((data) => {
          console.log("🔄 Auto-updater event received:", data);
          console.log("🔄 Current updateModal state:", updateModal);
          console.log("🔄 Event timestamp:", new Date().toISOString());

          switch (data.event) {
            case "update-notification-needed":
              console.log("🎯 Handling update-notification-needed");
              console.log(
                "🎯 Update info received:",
                JSON.stringify(data, null, 2)
              );
              console.log("🎯 Setting modal to show (available type)");
              setUpdateModal({
                show: true,
                type: "available",
                updateInfo: data,
              });
              console.log("🎯 Modal state updated for update available");
              break;

            case "update-download-started":
              console.log("🎯 Handling update-download-started");
              console.log("🎯 Previous modal state:", updateModal);
              setUpdateModal((prev) => {
                const newState = {
                  ...prev,
                  show: true,
                  type: "downloading",
                };
                console.log(
                  "🎯 Modal state updated for downloading:",
                  newState
                );
                return newState;
              });
              break;

            case "update-install-ready":
              console.log("🎯 Handling update-install-ready");
              console.log(
                "🎯 Update info for ready state:",
                JSON.stringify(data, null, 2)
              );
              setUpdateModal({
                show: true,
                type: "ready",
                updateInfo: data,
              });
              console.log("🎯 Modal state updated for ready to install");
              break;

            case "update-error":
              showAppToast(`❌ Update error: ${data.message}`, "error");
              setUpdateModal((prev) => ({ ...prev, show: false }));
              break;

            case "update-not-available":
              // Only show toast if modal is open (user manually checked)
              if (updateModal.show) {
                showAppToast(
                  "✅ You're using the latest version of Sniffler",
                  "success"
                );
                setUpdateModal((prev) => ({ ...prev, show: false }));
              }
              break;

            default:
              console.log("Unhandled auto-updater event:", data.event);
          }
        });
      }
    }
  }, []);

  // Clear notifications when navigating away from views
  useEffect(() => {
    // Hide global toast when view changes
    if (appToast.show) {
      hideAppToast();
    }
  }, [currentView, currentProject]);

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

  // Toast helper functions
  const showAppToast = (message, type = "success") => {
    console.log("📢 App: showAppToast called:", { message, type });
    console.log("📢 App: Current toast state before update:", appToast);
    setAppToast({ show: true, message, type });
    console.log("📢 App: Toast state updated to:", {
      show: true,
      message,
      type,
    });
  };

  const hideAppToast = () => {
    setAppToast({ show: false, message: "", type: "success" });
  };

  // Functions to clear notifications
  const clearRegularProxyNotifications = useCallback((proxyPort) => {
    setRegularProxyNotifications((prev) => {
      const newNotifications = new Map(prev);
      newNotifications.delete(proxyPort);
      return newNotifications;
    });
  }, []);

  const clearOutgoingProxyNotifications = useCallback((proxyPort) => {
    setOutgoingProxyNotifications((prev) => {
      const newNotifications = new Map(prev);
      newNotifications.delete(proxyPort);
      return newNotifications;
    });
  }, []);

  const clearDatabaseProxyNotifications = useCallback((proxyPort) => {
    setDatabaseProxyNotifications((prev) => {
      const newNotifications = new Map(prev);
      newNotifications.delete(proxyPort);
      return newNotifications;
    });
  }, []);

  // Auto-updater handlers
  const handleUpdateDownloadNow = async () => {
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      try {
        setUpdateModal((prev) => ({ ...prev, type: "downloading" }));
        const result = await window.electronAPI.downloadUpdate();
        if (!result.success) {
          showAppToast(`❌ Failed to start download: ${result.error}`, "error");
          setUpdateModal((prev) => ({ ...prev, show: false }));
        }
      } catch (error) {
        showAppToast("❌ Failed to start download", "error");
        setUpdateModal((prev) => ({ ...prev, show: false }));
      }
    }
  };

  const handleUpdateDownloadBackground = async () => {
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      try {
        await window.electronAPI.downloadUpdate();
        setUpdateModal((prev) => ({ ...prev, show: false }));
        showAppToast("📥 Update downloading in background", "info");
      } catch (error) {
        showAppToast("❌ Failed to start background download", "error");
      }
    }
  };

  const handleUpdateLater = () => {
    setUpdateModal((prev) => ({ ...prev, show: false }));
    showAppToast("⏰ Update reminder set for later", "info");
  };

  const handleUpdateClose = () => {
    setUpdateModal((prev) => ({ ...prev, show: false }));
  };

  const clearProjectNotifications = useCallback((projectPort) => {
    setProjectNotifications((prev) => {
      const newNotifications = new Map(prev);
      newNotifications.delete(projectPort);
      return newNotifications;
    });
  }, []);

  const clearMockDifferenceNotifications = useCallback(() => {
    setCurrentProject((currentProj) => {
      if (currentProj) {
        setViewedMockDifferences((prev) => {
          const newViewed = new Set(prev);
          newViewed.add(currentProj.port);
          return newViewed;
        });

        // Also clear recent mock differences for this project
        setRecentMockDifferences((prev) =>
          prev.filter((diff) => diff.proxyPort !== currentProj.port)
        );
      }
      return currentProj; // Return unchanged
    });
  }, []);

  // Memoized callback for clearing recent mock differences for a specific project
  const createClearRecentMockDifferences = useCallback((projectPort) => {
    return () => {
      setRecentMockDifferences((prev) =>
        prev.filter((diff) => diff.proxyPort !== projectPort)
      );
    };
  }, []);

  const clearRecentMockDifferences = useCallback((proxyPort = null) => {
    if (proxyPort) {
      // Clear differences for specific project
      setRecentMockDifferences((prev) =>
        prev.filter((diff) => diff.proxyPort !== proxyPort)
      );
    } else {
      // Clear differences for current project
      setCurrentProject((currentProj) => {
        if (currentProj) {
          setRecentMockDifferences((prev) =>
            prev.filter((diff) => diff.proxyPort !== currentProj.port)
          );
        }
        return currentProj; // Return unchanged
      });
    }
  }, []);

  // Memoized callback functions to prevent unnecessary rerenders
  const handleSelectProject = useCallback((project) => {
    setCurrentProject(project);
    setCurrentView("project");
  }, []);

  const handleCreateProject = useCallback(() => {
    setCurrentView("new-project");
    setCurrentProject(null);
  }, []);

  // Ensure 100% input reliability in Electron
  useElectronInputReliability();

  // Navigate to License view helper (used for clickable premium card)
  const openLicenseView = useCallback(() => {
    setCurrentView("license");
    setCurrentProject(null);
    setSidebarOpen(false);
  }, []);

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
        data-testid="sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full lg:h-screen">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <img
                src={appIcon}
                alt="Sniffler logo"
                className="w-8 h-8 mr-3 rounded"
                draggable={false}
              />
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

                        // Clear project notifications when user views the project
                        setProjectNotifications((prev) => {
                          const newNotifications = new Map(prev);
                          newNotifications.delete(project.port);
                          return newNotifications;
                        });

                        // Clear all proxy-type specific notifications for this project
                        clearRegularProxyNotifications(project.port);
                        clearOutgoingProxyNotifications(project.port);
                        clearDatabaseProxyNotifications(project.port);

                        // Clear recent mock differences for this project
                        clearRecentMockDifferences(project.port);
                      }}
                      subtitle={`Port ${project.port}`}
                      notificationCount={
                        projectNotifications.get(project.port) || 0
                      }
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
                notificationCount={Array.from(
                  outgoingProxyNotifications.values()
                ).reduce((sum, count) => sum + count, 0)}
                onClick={() => {
                  setCurrentView("outgoing");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                  // Clear outgoing proxy notifications when viewing
                  setOutgoingProxyNotifications(new Map());
                }}
              />
              <NavItem
                icon={<MdStorage />}
                label="Database Proxies"
                active={currentView === "database"}
                notificationCount={Array.from(
                  databaseProxyNotifications.values()
                ).reduce((sum, count) => sum + count, 0)}
                onClick={() => {
                  setCurrentView("database");
                  setCurrentProject(null);
                  setSidebarOpen(false);
                  // Clear database proxy notifications when viewing
                  setDatabaseProxyNotifications(new Map());
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

          {/* License Info */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div
              className={`rounded-lg p-3 ${
                licenseInfo.isPremium
                  ? "bg-green-50 cursor-pointer hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
                  : licenseInfo.isTrial
                  ? "bg-blue-50"
                  : "bg-gray-50"
              }`}
              onClick={licenseInfo.isPremium ? openLicenseView : undefined}
              role={licenseInfo.isPremium ? "button" : undefined}
              tabIndex={licenseInfo.isPremium ? 0 : undefined}
              onKeyDown={
                licenseInfo.isPremium
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        openLicenseView();
                      }
                    }
                  : undefined
              }
              title={licenseInfo.isPremium ? "View license details" : undefined}
            >
              <div
                className={`text-sm font-medium ${
                  licenseInfo.isPremium
                    ? "text-green-800"
                    : licenseInfo.isTrial
                    ? "text-blue-800"
                    : "text-gray-800"
                }`}
              >
                {licenseInfo.isPremium
                  ? "Premium License"
                  : licenseInfo.isTrial
                  ? "Free Trial"
                  : "Free Version"}
              </div>
              <div
                className={`text-xs ${
                  licenseInfo.isPremium
                    ? "text-green-600"
                    : licenseInfo.isTrial
                    ? "text-blue-600"
                    : "text-gray-600"
                }`}
              >
                {licenseInfo.expiresAt && licenseInfo.isTrial
                  ? `${Math.ceil(
                      (new Date(licenseInfo.expiresAt) - new Date()) /
                        (1000 * 60 * 60 * 24)
                    )} days remaining`
                  : licenseInfo.message}
              </div>
              {!licenseInfo.isPremium && (
                <div className="flex flex-col space-y-2 mt-2">
                  {/* Buy License Button - Always visible when not premium */}
                  <button
                    onClick={() => {
                      setCurrentView("license");
                      setCurrentProject(null);
                      setSidebarOpen(false);
                    }}
                    className="text-xs px-3 py-1 rounded font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                    Buy License
                  </button>

                  {/* Trial/Upgrade Button */}
                  <button
                    onClick={() => {
                      if (licenseInfo.isTrial) {
                        // If already on trial, navigate to upgrade page
                        setCurrentView("license");
                        setCurrentProject(null);
                        setSidebarOpen(false);
                      } else if (licenseInfo.trialUsed) {
                        // If trial was already used, navigate to upgrade page
                        setCurrentView("license");
                        setCurrentProject(null);
                        setSidebarOpen(false);
                      } else {
                        // If trial not used yet, start the trial
                        startFreeTrial();
                        setSidebarOpen(false);
                      }
                    }}
                    disabled={isStartingTrial}
                    className={`text-xs px-3 py-1 rounded font-medium ${
                      isStartingTrial
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : licenseInfo.isTrial
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-600 text-white hover:bg-gray-700"
                    }`}
                  >
                    {isStartingTrial
                      ? "Starting..."
                      : licenseInfo.isTrial
                      ? "Upgrade Now"
                      : licenseInfo.trialUsed
                      ? "Upgrade"
                      : "Start Trial"}
                  </button>
                </div>
              )}
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
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
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
              proxyNotifications={regularProxyNotifications}
              onClearNotifications={clearRegularProxyNotifications}
              onRefresh={loadProjects}
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
              recentMockDifferences={recentMockDifferences.filter(
                (diff) => diff.proxyPort === currentProject.port
              )}
              onClearRecentMockDifferences={createClearRecentMockDifferences(
                currentProject.port
              )}
              onRefreshMocks={refreshMocks}
              onStopProject={stopProject}
              onExportProject={exportSingleProject}
              onEnableProject={enableProject}
              onDisableProject={disableProject}
              onDeleteProject={deleteProject}
              onClearMockDifferenceNotifications={() =>
                clearMockDifferenceNotifications()
              }
            />
          )}
          {currentView === "outgoing" && (
            <OutgoingRequestView
              proxyNotifications={outgoingProxyNotifications}
              onClearNotifications={clearOutgoingProxyNotifications}
            />
          )}
          {currentView === "database" && (
            <DatabaseProxyView
              databaseMocks={databaseMocks}
              onRefreshDatabaseMocks={refreshDatabaseMocks}
              proxyNotifications={databaseProxyNotifications}
              onClearNotifications={clearDatabaseProxyNotifications}
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
          {currentView === "license" && <LicenseView />}
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

      {/* Update Modal */}
      {console.log("🏗️ App: Rendering UpdateModal with props:", {
        show: updateModal.show,
        updateInfo: updateModal.updateInfo,
        type: updateModal.type,
        timestamp: new Date().toISOString(),
      })}
      <UpdateModal
        show={updateModal.show}
        updateInfo={updateModal.updateInfo}
        type={updateModal.type}
        onDownloadNow={handleUpdateDownloadNow}
        onDownloadBackground={handleUpdateDownloadBackground}
        onLater={handleUpdateLater}
        onClose={handleUpdateClose}
      />

      {/* Global Toast Notifications */}
      <Toast
        message={appToast.message}
        type={appToast.type}
        show={appToast.show}
        onClose={hideAppToast}
      />
    </div>
  );
}

export default App;
