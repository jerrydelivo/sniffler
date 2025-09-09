function NavItem({
  icon,
  label,
  active,
  onClick,
  subtitle,
  onContextMenu,
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
    </button>
  );
}

export default NavItem;
