import { useEffect, useRef } from "react";

function ContextMenu({ isOpen, position, onClose, children }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-2 min-w-48"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {children}
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  className = "",
  dangerous = false,
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 ${
        dangerous
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900"
          : "text-gray-700 dark:text-gray-300"
      } ${className}`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export { ContextMenu, ContextMenuItem };
export default ContextMenu;
