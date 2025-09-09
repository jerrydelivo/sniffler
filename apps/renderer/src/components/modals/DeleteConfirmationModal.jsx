import { useState } from "react";
import {
  MdClose,
  MdWarning,
  MdDelete,
  MdStorage,
  MdCallMade,
  MdSearch,
} from "react-icons/md";

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType = "item", // 'project', 'database-proxy', 'outgoing-proxy', 'item', 'data'
  description,
  consequences = [],
  customIcon,
  isLoading = false,
  action = "delete", // 'delete' or 'clear'
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const getIcon = () => {
    if (customIcon) return customIcon;

    switch (itemType) {
      case "project":
        return <MdSearch className="w-12 h-12 text-blue-500" />;
      case "database-proxy":
        return <MdStorage className="w-12 h-12 text-purple-500" />;
      case "outgoing-proxy":
        return <MdCallMade className="w-12 h-12 text-green-500" />;
      default:
        return <MdDelete className="w-12 h-12 text-red-500" />;
    }
  };

  const getDefaultConsequences = () => {
    switch (itemType) {
      case "project":
        return [
          "The proxy configuration will be permanently removed",
          "All associated mocks will be deleted",
          "All request history will be cleared",
          "This action cannot be undone",
        ];
      case "database-proxy":
        return [
          "The database proxy configuration will be permanently removed",
          "All associated mocks will be deleted",
          "All query history will be cleared",
          "This action cannot be undone",
        ];
      case "outgoing-proxy":
        return [
          "The outgoing proxy configuration will be permanently removed",
          "All associated mocks will be deleted",
          "All request history will be cleared",
          "This action cannot be undone",
        ];
      case "data":
        return [
          "All data will be permanently cleared",
          "This action cannot be undone",
        ];
      default:
        return ["This action cannot be undone"];
    }
  };

  const getActionColor = () => {
    switch (action) {
      case "clear":
        return "bg-orange-600 hover:bg-orange-700";
      case "delete":
      default:
        return "bg-red-600 hover:bg-red-700";
    }
  };

  const getActionText = () => {
    switch (action) {
      case "clear":
        return "Clear";
      case "delete":
      default:
        return "Delete";
    }
  };

  const displayConsequences =
    consequences.length > 0 ? consequences : getDefaultConsequences();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title || "Delete Confirmation"}
          </h2>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <MdClose className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Icon and main message */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 rounded-full">
              <MdWarning className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>

            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Are you sure you want to {action} this{" "}
              {itemType === "item" ? "item" : itemType.replace("-", " ")}?
            </h3>

            {itemName && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {getIcon()}
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {itemName}
                  </p>
                  {description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Consequences */}
          {displayConsequences.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <MdWarning className="w-4 h-4 text-amber-500" />
                This will permanently remove:
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {displayConsequences.map((consequence, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{consequence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning box */}
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <MdWarning className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isLoading}
            className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${getActionColor()}`}
          >
            {isConfirming || isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {getActionText()}ing...
              </>
            ) : (
              <>
                <MdDelete className="w-4 h-4" />
                {getActionText()}{" "}
                {itemType === "item"
                  ? "Item"
                  : itemType
                      .split("-")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1)
                      )
                      .join(" ")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
