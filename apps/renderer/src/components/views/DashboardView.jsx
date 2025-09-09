import StatCard from "../common/StatCard";
import { MdSearch, MdBarChart, MdError, MdTheaters } from "react-icons/md";

function DashboardView({
  projects,
  requests,
  mocks,
  onSelectProject,
  onCreateProject,
}) {
  const activeProjects = projects ? projects.length : 0;
  const totalRequests = requests ? requests.length : 0;
  const successfulRequests = requests
    ? requests.filter((r) => r.status === "success").length
    : 0;
  const failedRequests = requests
    ? requests.filter((r) => r.status === "failed").length
    : 0;
  const totalMocks = mocks ? mocks.length : 0;

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={<MdSearch />}
          color="blue"
        />
        <StatCard
          title="Total Requests"
          value={totalRequests}
          icon={<MdBarChart />}
          color="green"
        />
        <StatCard
          title="Failed Requests"
          value={failedRequests}
          icon={<MdError />}
          color="red"
        />
        <StatCard
          title="Saved Mocks"
          value={totalMocks}
          icon={<MdTheaters />}
          color="purple"
        />
      </div>

      {/* Projects Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Projects
          </h2>
          {projects && projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((project, index) => {
                const projectRequests = requests
                  ? requests.filter((r) => r.proxyPort === project.port)
                  : [];
                const projectMocks = mocks
                  ? mocks.filter((m) => m.proxyPort === project.port)
                  : [];

                return (
                  <div
                    key={`${project.port}-${project.name}-${index}`}
                    className={`flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors ${
                      project.disabled
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                    }`}
                    onClick={() =>
                      !project.disabled && onSelectProject(project)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {project.name}
                        </h3>
                        <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
                          <span>{projectRequests.length} req</span>
                          <span>{projectMocks.length} mocks</span>
                        </div>
                      </div>
                      <div className="flex items-center mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {project.disabled ? (
                          <>
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                            <span className="text-gray-500 dark:text-gray-400">
                              Disabled
                            </span>
                            <span className="mx-2">•</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            <span className="text-green-600 dark:text-green-400">
                              Active
                            </span>
                            <span className="mx-2">•</span>
                          </>
                        )}
                        <span className="truncate">
                          Port {project.port} →{" "}
                          {project.targetHost || "localhost"}:
                          {project.targetPort || 3000}
                        </span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-4 flex-shrink-0">
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">
                No projects yet
              </p>
              <button
                onClick={onCreateProject}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm sm:text-base"
              >
                Create Your First Project
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {requests &&
              requests.slice(0, 5).map((request, index) => {
                const project = projects
                  ? projects.find((p) => p.port === request.proxyPort)
                  : null;
                return (
                  <div
                    key={request.id || index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-3 flex-shrink-0 ${
                          request.status === "success"
                            ? "bg-green-400"
                            : "bg-red-400"
                        }`}
                      ></span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {request.method}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 ml-2 truncate text-sm">
                            {request.path}
                          </span>
                        </div>
                        {project && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {project.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            {(!requests || requests.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
                No requests captured yet. Create a project to begin monitoring
                traffic.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
