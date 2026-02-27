import { useState, useEffect, useRef } from "react";
import {
  MdBarChart,
  MdList,
  MdTheaters,
  MdScience,
  MdCheckCircle,
  MdError,
  MdFileUpload,
  MdPlayArrow,
  MdPause,
  MdDelete,
  MdMoreVert,
  MdEdit,
} from "react-icons/md";
import RequestsView from "./RequestsView";
import MocksView from "./MocksView";
import TestingView from "./TestingView";
import ConfirmationModal from "../modals/ConfirmationModal";
import { usePremiumFeature } from "../../hooks/usePremiumFeature.jsx";

function ProjectView({
  project,
  requests,
  mocks,
  recentMockDifferences = [],
  onClearRecentMockDifferences,
  onRefreshMocks,
  onStopProject,
  onExportProject,
  onEnableProject,
  onDisableProject,
  onDeleteProject,
  onClearMockDifferenceNotifications,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    port: "",
    targetHost: "",
    targetPort: "",
  });
  const actionMenuRef = useRef(null);
  const prevActiveTabRef = useRef(activeTab);

  // Check premium access for mocks and testing features
  const { canUseFeature: canUseMocks } = usePremiumFeature("mock-management");
  const { canUseFeature: canUseTesting } =
    usePremiumFeature("advanced-features");

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target)
      ) {
        setShowActionMenu(false);
      }
    };

    if (showActionMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showActionMenu]);

  // Clear recent mock differences when navigating away from requests tab
  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    if (
      prevTab === "requests" &&
      activeTab !== "requests" &&
      onClearRecentMockDifferences
    ) {
      onClearRecentMockDifferences();
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, onClearRecentMockDifferences]);

  const handleExportProject = async () => {
    if (onExportProject) {
      await onExportProject(project);
    }
  };

  const handleToggleProject = async () => {
    if (project.disabled) {
      if (onEnableProject) {
        await onEnableProject(project.port);
      }
    } else {
      if (onDisableProject) {
        await onDisableProject(project.port);
      }
    }
  };

  const handleDeleteProject = async () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteProject = async () => {
    if (onDeleteProject) {
      await onDeleteProject(project.port);
    }
    setShowDeleteConfirmation(false);
  };

  const handleEditProject = () => {
    setEditForm({
      name: project.name,
      port: project.port.toString(),
      targetHost: project.targetHost || "localhost",
      targetPort: (project.targetPort || 3000).toString(),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      // Validate inputs
      if (!editForm.name.trim()) {
        alert("Project name is required");
        return;
      }

      const newPort = parseInt(editForm.port);
      const newTargetPort = parseInt(editForm.targetPort);

      if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
        alert("Proxy port must be a number between 1 and 65535");
        return;
      }

      if (isNaN(newTargetPort) || newTargetPort < 1 || newTargetPort > 65535) {
        alert("Target port must be a number between 1 and 65535");
        return;
      }

      if (!editForm.targetHost.trim()) {
        alert("Target host is required");
        return;
      }

      if (window.electronAPI && window.electronAPI.updateProxyConfig) {
        const updates = {
          name: editForm.name.trim(),
          port: newPort,
          targetHost: editForm.targetHost.trim(),
          targetPort: newTargetPort,
        };

        const result = await window.electronAPI.updateProxyConfig(
          project.port,
          updates
        );

        if (result.success) {
          setShowEditModal(false);
          // Refresh the project data by calling the parent component's refresh function
          if (window.electronAPI && window.electronAPI.getProxies) {
            // This will trigger a reload in the parent App component
            window.location.reload();
          }
        } else {
          alert(`Failed to update proxy configuration: ${result.error}`);
        }
      }
    } catch (error) {
      alert(`Error updating proxy configuration: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Project Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {project.name}
            </h1>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="flex items-center gap-2">
                  <span className="font-medium">Listen:</span>
                  <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs sm:text-sm">
                    localhost:{project.port}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">Target:</span>
                  <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs sm:text-sm">
                    {project.targetHost || "localhost"}:
                    {project.targetPort || 3000}
                  </span>
                </span>
              </div>
              <div className="flex items-center mt-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    project.disabled ? "bg-gray-400" : "bg-green-400"
                  }`}
                ></span>
                <span
                  className={
                    project.disabled
                      ? "text-gray-500 dark:text-gray-400"
                      : "text-green-600 dark:text-green-400"
                  }
                >
                  {project.disabled ? "Disabled" : "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Project Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* Quick Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={handleExportProject}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Export Project"
              >
                <MdFileUpload size={16} />
                <span className="hidden lg:inline">Export</span>
              </button>

              {project.disabled && (
                <button
                  onClick={handleEditProject}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  title="Edit Project Configuration"
                >
                  <MdEdit size={16} />
                  <span className="hidden lg:inline">Edit</span>
                </button>
              )}

              <button
                onClick={handleToggleProject}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  project.disabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
                title={project.disabled ? "Enable Project" : "Disable Project"}
              >
                {project.disabled ? (
                  <MdPlayArrow size={16} />
                ) : (
                  <MdPause size={16} />
                )}
                <span className="hidden lg:inline">
                  {project.disabled ? "Enable" : "Disable"}
                </span>
              </button>

              <button
                onClick={handleDeleteProject}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete Project"
              >
                <MdDelete size={16} />
                <span className="hidden lg:inline">Delete</span>
              </button>
            </div>

            {/* Mobile Action Menu */}
            <div className="relative sm:hidden" ref={actionMenuRef}>
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="More Actions"
              >
                <MdMoreVert size={20} />
              </button>

              {showActionMenu && (
                <div className="absolute right-0 top-12 z-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-2">
                  <button
                    onClick={() => {
                      handleExportProject();
                      setShowActionMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <MdFileUpload />
                    Export Project
                  </button>
                  {project.disabled && (
                    <button
                      onClick={() => {
                        handleEditProject();
                        setShowActionMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                    >
                      <MdEdit />
                      Edit Configuration
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleToggleProject();
                      setShowActionMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    {project.disabled ? <MdPlayArrow /> : <MdPause />}
                    {project.disabled ? "Enable Project" : "Disable Project"}
                  </button>
                  <hr className="my-2 border-gray-200 dark:border-gray-600" />
                  <button
                    onClick={() => {
                      handleDeleteProject();
                      setShowActionMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 flex items-center gap-3 disabled:opacity-50"
                  >
                    <MdDelete />
                    Delete Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex overflow-x-auto" aria-label="Tabs">
            {[
              { id: "overview", label: "Overview", icon: <MdBarChart /> },
              {
                id: "requests",
                label: "Requests",
                icon: <MdList />,
                count: requests.length,
              },
              {
                id: "mocks",
                label: "Mocks",
                icon: <MdTheaters />,
                count: mocks.length,
                isPremium: !canUseMocks,
              },
              {
                id: "testing",
                label: "Testing",
                icon: <MdScience />,
                isPremium: !canUseTesting,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.isPremium) {
                    // Don't change tab, just show the premium message in content
                    return;
                  }
                  setActiveTab(tab.id);
                  // Clear mock difference notifications when switching to Requests tab
                  if (
                    tab.id === "requests" &&
                    onClearMockDifferenceNotifications
                  ) {
                    onClearMockDifferenceNotifications();
                  }
                }}
                className={`py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 flex-shrink-0 relative ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : tab.isPremium
                    ? "border-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-sm sm:text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                {tab.isPremium && <span className="text-xs">🔒</span>}
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 py-0.5 px-1.5 sm:px-2 rounded-full text-xs ${
                      activeTab === tab.id
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <ProjectOverview
              project={project}
              requests={requests}
              mocks={mocks}
            />
          )}
          {activeTab === "requests" && (
            <RequestsView
              requests={requests}
              mocks={mocks}
              recentMockDifferences={recentMockDifferences}
              onClearRecentMockDifferences={onClearRecentMockDifferences}
              onRefreshMocks={onRefreshMocks}
              hideHeader={true}
            />
          )}
          {activeTab === "mocks" &&
            (canUseMocks ? (
              <MocksView
                mocks={mocks}
                onRefreshMocks={onRefreshMocks}
                hideHeader={true}
              />
            ) : (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <MdTheaters className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Premium Feature: Mocks
                </h3>
                <p className="text-gray-600 mb-6">
                  Mock management requires a premium license. Upgrade to unlock
                  the ability to create, manage, and use mocks for your API
                  testing.
                </p>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Start your free 30-day trial or upgrade to premium
                  </p>
                </div>
              </div>
            ))}
          {activeTab === "testing" &&
            (canUseTesting ? (
              <TestingView hideHeader={true} />
            ) : (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <MdScience className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Premium Feature: Testing
                </h3>
                <p className="text-gray-600 mb-6">
                  Regression testing requires a premium license. Upgrade to
                  unlock automated testing and validation of your API mocks.
                </p>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Start your free 30-day trial or upgrade to premium
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"?\n\nThis action cannot be undone. All associated mocks and configuration will be permanently removed.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        type="danger"
      />

      {/* Edit Configuration Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Project Configuration
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Modify the target configuration for this proxy
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Proxy Port
                </label>
                <input
                  type="number"
                  value={editForm.port}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, port: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="3000"
                  min="1"
                  max="65535"
                />
              </div>

              <div className="bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-3">
                  Target Configuration
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">
                      Target Host
                    </label>
                    <input
                      type="text"
                      value={editForm.targetHost}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          targetHost: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="localhost"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">
                      Target Port
                    </label>
                    <input
                      type="number"
                      value={editForm.targetPort}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          targetPort: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="3000"
                      min="1"
                      max="65535"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg hover:bg-orange-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectOverview({ project, requests, mocks }) {
  const recentRequests = requests.slice(0, 5);
  const successfulRequests = requests.filter(
    (req) => req.status === "success"
  ).length;
  const failedRequests = requests.filter(
    (req) => req.status === "failed"
  ).length;
  const activeMocks = mocks.filter((mock) => mock.enabled).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MdList className="text-lg sm:text-2xl text-blue-600 dark:text-blue-200" />
            </div>
            <div className="ml-2 sm:ml-3 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-200 truncate">
                Total Requests
              </p>
              <p className="text-sm sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                {requests.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MdCheckCircle className="text-lg sm:text-2xl text-green-600 dark:text-green-200" />
            </div>
            <div className="ml-2 sm:ml-3 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-200 truncate">
                Successful
              </p>
              <p className="text-sm sm:text-lg font-semibold text-green-900 dark:text-green-100">
                {successfulRequests}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MdError className="text-lg sm:text-2xl text-red-600 dark:text-red-200" />
            </div>
            <div className="ml-2 sm:ml-3 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-200 truncate">
                Failed
              </p>
              <p className="text-sm sm:text-lg font-semibold text-red-900 dark:text-red-100">
                {failedRequests}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MdTheaters className="text-lg sm:text-2xl text-purple-600 dark:text-purple-200" />
            </div>
            <div className="ml-2 sm:ml-3 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-200 truncate">
                Active Mocks
              </p>
              <p className="text-sm sm:text-lg font-semibold text-purple-900 dark:text-purple-100">
                {activeMocks}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Requests */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Requests
          </h3>
          {recentRequests.length > 0 ? (
            <div className="space-y-2">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                        request.status === "success"
                          ? "bg-green-400"
                          : "bg-red-400"
                      }`}
                    ></span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {request.method}
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm truncate">
                        {request.path}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                    {new Date(request.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic text-sm">
              No requests yet. Start making API calls to see them here.
            </p>
          )}
        </div>

        {/* Project Info */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Project Configuration
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                Proxy Port
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {project.port}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                Target Host
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm truncate ml-2">
                {project.targetHost || "localhost"}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                Target Port
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {project.targetPort || 3000}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectView;
