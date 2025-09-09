function HelpModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      data-modal
      role="dialog"
      aria-labelledby="help-modal-title"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
          <h2
            className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            id="help-modal-title"
          >
            <span className="text-2xl">🆘</span>
            Help & Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            data-action="close"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Navigation Shortcuts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🧭</span>
                Navigation
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Dashboard", key: "Ctrl+1" },
                  { label: "Proxies", key: "Ctrl+2" },
                  { label: "Requests", key: "Ctrl+3" },
                  { label: "Mocks", key: "Ctrl+4" },
                  { label: "Testing", key: "Ctrl+5" },
                  { label: "Database", key: "Ctrl+6" },
                  { label: "Export/Import", key: "Ctrl+7" },
                  { label: "Settings", key: "Ctrl+8" },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="text-gray-600 dark:text-gray-300 font-medium">
                      {item.label}
                    </span>
                    <kbd className="px-3 py-1 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg text-sm font-mono shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Shortcuts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                Actions
              </h3>
              <div className="space-y-3">
                {[
                  { label: "New Proxy", key: "Ctrl+N" },
                  { label: "Refresh Data", key: "Ctrl+R" },
                  { label: "Show Help", key: "Ctrl+?" },
                  { label: "Close Modal", key: "Esc" },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="text-gray-600 dark:text-gray-300 font-medium">
                      {item.label}
                    </span>
                    <kbd className="px-3 py-1 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg text-sm font-mono shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Features Overview */}
          <div className="mt-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="text-xl">🚀</span>
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-xl p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3">🔍</span>
                  <h4 className="font-bold text-blue-800 dark:text-blue-200">
                    Traffic Sniffing
                  </h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Intercept and analyze HTTP/HTTPS traffic with detailed
                  insights
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-xl p-6 border border-green-200 dark:border-green-700 shadow-sm">
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3">🎭</span>
                  <h4 className="font-bold text-green-800 dark:text-green-200">
                    API Mocking
                  </h4>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Create sophisticated mock responses for comprehensive testing
                </p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700 shadow-sm">
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3">🗃️</span>
                  <h4 className="font-bold text-yellow-800 dark:text-yellow-200">
                    Database Monitoring
                  </h4>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  PostgreSQL & MySQL query analysis and performance monitoring
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
