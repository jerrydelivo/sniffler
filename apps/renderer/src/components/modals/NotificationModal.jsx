import { useState, useEffect } from "react";

function NotificationModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  actions = [],
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 150);
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "✅",
          headerBg:
            "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900",
          iconBg: "bg-green-100 dark:bg-green-800",
          titleColor: "text-green-800 dark:text-green-200",
        };
      case "error":
        return {
          icon: "❌",
          headerBg:
            "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900 dark:to-rose-900",
          iconBg: "bg-red-100 dark:bg-red-800",
          titleColor: "text-red-800 dark:text-red-200",
        };
      case "warning":
        return {
          icon: "⚠️",
          headerBg:
            "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900",
          iconBg: "bg-yellow-100 dark:bg-yellow-800",
          titleColor: "text-yellow-800 dark:text-yellow-200",
        };
      default:
        return {
          icon: "ℹ️",
          headerBg:
            "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900",
          iconBg: "bg-blue-100 dark:bg-blue-800",
          titleColor: "text-blue-800 dark:text-blue-200",
        };
    }
  };

  if (!isOpen) return null;

  const styles = getTypeStyles();

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity duration-150 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-150 ${
          isVisible ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 ${styles.headerBg}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${styles.iconBg}`}>
              <span className="text-2xl">{styles.icon}</span>
            </div>
            <div>
              <h3 className={`text-lg font-bold ${styles.titleColor}`}>
                {title}
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900">
          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3 justify-end">
            {actions.length > 0 ? (
              actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    handleClose();
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm ${
                    action.className ||
                    "bg-blue-500 hover:bg-blue-600 text-white"
                  }`}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 shadow-sm"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationModal;
