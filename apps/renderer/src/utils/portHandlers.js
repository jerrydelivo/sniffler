import { useState } from "react";
import { checkPortUsage } from "./portSuggestions";

/**
 * Creates a port blur handler function that validates port numbers and sets warnings
 * @param {string} portValue - The current port value from state
 * @param {function} setPortWarning - Function to set port warning state
 * @returns {function} Handler function for port input blur events
 */
export function createPortBlurHandler(portValue, setPortWarning) {
  return () => {
    if (portValue && portValue.trim() !== "") {
      const portStr = portValue.trim();
      const port = parseInt(portStr);
      // Only validate if it's a reasonable port number (at least 2 digits to avoid premature validation)
      if (!isNaN(port) && port >= 1 && port <= 65535 && portStr.length >= 2) {
        const portCheck = checkPortUsage(port);
        setPortWarning(portCheck.warning);
      } else {
        setPortWarning(null);
      }
    } else {
      setPortWarning(null);
    }
  };
}

/**
 * Creates a port change handler that clears warnings when user starts typing
 * @param {function} setPortValue - Function to set port value state
 * @param {function} setPortWarning - Function to set port warning state
 * @returns {function} Handler function for port input change events
 */
export function createPortChangeHandler(setPortValue, setPortWarning) {
  return (newPort) => {
    setPortValue(newPort);
    setPortWarning(null); // Clear warning when user starts typing
  };
}

/**
 * Hook to provide port handling functionality
 * @param {string} initialPort - Initial port value
 * @returns {object} Object containing port state and handlers
 */
export function usePortHandling(initialPort = "") {
  const [portValue, setPortValue] = useState(initialPort);
  const [portWarning, setPortWarning] = useState(null);

  const handlePortBlur = createPortBlurHandler(portValue, setPortWarning);
  const handlePortChange = createPortChangeHandler(
    setPortValue,
    setPortWarning
  );

  const clearPortWarning = () => setPortWarning(null);

  return {
    portValue,
    portWarning,
    handlePortBlur,
    handlePortChange,
    clearPortWarning,
    setPortValue,
    setPortWarning,
  };
}
