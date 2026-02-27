function NavItem({
  icon,
  label,
  active,
  onClick,
  subtitle,
  onContextMenu,
  notificationCount = 0,
  ...props
}) {
  const handleContextMenu = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  };

  return (
    <button
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`w-full flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
      }`}
      {...props}
    >
      <span className="mr-3 text-lg flex-shrink-0">{icon}</span>
      <div className="flex flex-col items-start flex-1">
        <span>{label}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      {notificationCount > 0 && (
        <div className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex-shrink-0">
          {notificationCount > 99 ? "99+" : notificationCount}
        </div>
      )}
    </button>
  );
}

export default NavItem;
