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
} from "react-icons/md";
import RequestsView from "./RequestsView";
import MocksView from "./MocksView";
import TestingView from "./TestingView";
import ConfirmationModal from "../modals/ConfirmationModal";

function ProjectView({
  project,
  requests,
  mocks,
  onRefreshMocks,
  onStopProject,
  onExportProject,
  onEnableProject,
  onDisableProject,
  onDeleteProject,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const actionMenuRef = useRef(null);

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
              },
              { id: "testing", label: "Testing", icon: <MdScience /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 flex-shrink-0 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-sm sm:text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
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
              onRefreshMocks={onRefreshMocks}
              hideHeader={true}
            />
          )}
          {activeTab === "mocks" && (
            <MocksView
              mocks={mocks}
              onRefreshMocks={onRefreshMocks}
              hideHeader={true}
            />
          )}
          {activeTab === "testing" && <TestingView hideHeader={true} />}
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
