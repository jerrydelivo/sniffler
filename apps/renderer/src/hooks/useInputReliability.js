import { useEffect, useRef } from "react";

/**
 * Hook to ensure all inputs in Electron are 100% clickable and focusable
 * This addresses the common Electron issue where inputs become unresponsive
 */
export function useElectronInputReliability() {
  const isElectron = typeof window !== "undefined" && window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;

    // Enhanced input fixing function
    const makeInputReliable = (element) => {
      if (!element) return;

      // Ensure element is focusable
      if (!element.hasAttribute("tabindex") && element.tabIndex < 0) {
        element.setAttribute("tabindex", "0");
      }

      // Force pointer cursor for inputs
      element.style.cursor = element.disabled ? "not-allowed" : "text";

      // Add enhanced event listeners for reliability
      const handleMouseDown = (e) => {
        // Prevent any interference with the default behavior
        e.stopPropagation();

        // Ensure the input gets focus
        setTimeout(() => {
          try {
            if (!element.disabled && element !== document.activeElement) {
              element.focus();

              // For text inputs, position cursor at click location
              if (element.setSelectionRange && e.offsetX !== undefined) {
                const textWidth = element.scrollWidth;
                const clickPosition = Math.round(
                  (e.offsetX / element.offsetWidth) * element.value.length
                );
                element.setSelectionRange(clickPosition, clickPosition);
              }
            }
          } catch (error) {
            console.warn("Failed to focus input on mousedown:", error);
          }
        }, 0);
      };

      const handleClick = (e) => {
        e.stopPropagation();

        // Double-check focus
        setTimeout(() => {
          try {
            if (!element.disabled && element !== document.activeElement) {
              element.focus();
            }
          } catch (error) {
            console.warn("Failed to focus input on click:", error);
          }
        }, 0);
      };

      const handleFocus = (e) => {
        // Do not modify outline here; allow component/library (e.g., MUI) to control focus visuals
      };

      const handleBlur = (e) => {
        // No-op: avoid overriding component focus visuals
      };

      // Add event listeners
      element.addEventListener("mousedown", handleMouseDown, true);
      element.addEventListener("click", handleClick, true);
      element.addEventListener("focus", handleFocus);
      element.addEventListener("blur", handleBlur);

      // Return cleanup function
      return () => {
        element.removeEventListener("mousedown", handleMouseDown, true);
        element.removeEventListener("click", handleClick, true);
        element.removeEventListener("focus", handleFocus);
        element.removeEventListener("blur", handleBlur);
      };
    };

    // Apply to existing inputs
    const existingInputs = document.querySelectorAll("input, textarea, select");
    const cleanupFunctions = Array.from(existingInputs)
      .map(makeInputReliable)
      .filter(Boolean);

    // Set up mutation observer for new inputs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is an input
            if (node.matches && node.matches("input, textarea, select")) {
              makeInputReliable(node);
            }

            // Check for inputs within the added node
            if (node.querySelectorAll) {
              const newInputs = node.querySelectorAll(
                "input, textarea, select"
              );
              Array.from(newInputs).forEach(makeInputReliable);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Enhanced keyboard navigation
    const handleGlobalKeydown = (e) => {
      // Tab navigation enhancement
      if (e.key === "Tab") {
        // Find all focusable elements
        const focusableElements = Array.from(
          document.querySelectorAll(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusableElements.length === 0) return;

        const currentIndex = focusableElements.indexOf(document.activeElement);

        if (e.shiftKey) {
          // Shift + Tab (backwards)
          const nextIndex =
            currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
          const nextElement = focusableElements[nextIndex];
          if (nextElement) {
            e.preventDefault();
            nextElement.focus();
          }
        } else {
          // Tab (forwards)
          const nextIndex =
            currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
          const nextElement = focusableElements[nextIndex];
          if (nextElement) {
            e.preventDefault();
            nextElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeydown);

    // Cleanup function
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup && cleanup());
      observer.disconnect();
      document.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, [isElectron]);
}

/**
 * Hook for modal focus management with enhanced reliability
 */
export function useModalFocusReliability(isOpen = false, containerRef = null) {
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isOpen || !containerRef?.current) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement;

    // Focus the first input in the modal
    const focusFirstInput = () => {
      const container = containerRef.current;
      if (!container) return;

      // Find the first focusable element (preferring inputs)
      const inputs = container.querySelectorAll(
        "input:not([disabled]), textarea:not([disabled])"
      );
      const allFocusable = container.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const elementToFocus = inputs[0] || allFocusable[0];

      if (elementToFocus) {
        // Multiple attempts to ensure focus
        setTimeout(() => {
          try {
            elementToFocus.focus();

            // For input elements, select all text if present
            if (
              (elementToFocus.tagName === "INPUT" ||
                elementToFocus.tagName === "TEXTAREA") &&
              elementToFocus.value
            ) {
              elementToFocus.select();
            }
          } catch (error) {
            console.warn("Failed to focus modal element:", error);
          }
        }, 50);

        // Backup attempt
        setTimeout(() => {
          try {
            if (document.activeElement !== elementToFocus) {
              elementToFocus.focus();
            }
          } catch (error) {
            console.warn("Backup focus attempt failed:", error);
          }
        }, 150);
      }
    };

    // Set up focus trap
    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = container.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Apply focus and trap
    focusFirstInput();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, containerRef]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousActiveElement.current) {
      setTimeout(() => {
        try {
          if (
            previousActiveElement.current &&
            document.contains(previousActiveElement.current)
          ) {
            previousActiveElement.current.focus();
          }
        } catch (error) {
          console.warn("Failed to restore focus:", error);
        }
        previousActiveElement.current = null;
      }, 100);
    }
  }, [isOpen]);
}
