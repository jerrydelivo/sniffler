function StatCard({ title, value, icon, color, subtitle }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
    green: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200",
    purple:
      "bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
      <div className="flex items-center">
        <div
          className={`p-1.5 sm:p-2 rounded-md ${colorClasses[color]} flex items-center justify-center`}
        >
          <span className="text-sm sm:text-lg">{icon}</span>
        </div>
        <div className="ml-2 sm:ml-4 flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 truncate">
            {title}
          </p>
          <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
