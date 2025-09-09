import { useEffect } from "react";

export function useKeyboardShortcuts({
  currentView,
  setCurrentView,
  showHelp,
  setShowHelp,
  loadProjects,
  projects,
  currentProject,
  setCurrentProject,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Global shortcuts (Ctrl/Cmd + key)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            setCurrentView("dashboard");
            setCurrentProject(null);
            break;
          case "2":
            e.preventDefault();
            setCurrentView("new-project");
            setCurrentProject(null);
            break;
          case "7":
            e.preventDefault();
            setCurrentView("export");
            setCurrentProject(null);
            break;
          case "8":
          case "s":
            e.preventDefault();
            setCurrentView("settings");
            setCurrentProject(null);
            break;
          case "n":
            e.preventDefault();
            if (currentView === "new-project" || currentView === "dashboard") {
              // Trigger new project creation
              document.querySelector('[data-action="add-proxy"]')?.click();
            }
            break;
          case "r":
            if (!e.shiftKey) {
              e.preventDefault();
              // Refresh current view data
              loadProjects();
            }
            break;
          case "?":
          case "/":
            e.preventDefault();
            setShowHelp(true);
            break;
        }
      }

      // Function keys
      if (e.key === "F1") {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Escape key handling
      if (e.key === "Escape") {
        // Close help if open
        if (showHelp) {
          setShowHelp(false);
          return;
        }

        // Go back to dashboard if in project view
        if (currentView === "project" && currentProject) {
          setCurrentView("dashboard");
          setCurrentProject(null);
          return;
        }

        // Close any open modals or forms
        const modals = document.querySelectorAll("[data-modal]");
        modals.forEach((modal) => {
          if (modal.style.display !== "none") {
            modal.querySelector('[data-action="close"]')?.click();
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentView,
    projects,
    currentProject,
    showHelp,
    setCurrentView,
    setCurrentProject,
    setShowHelp,
    loadProjects,
  ]);
}
