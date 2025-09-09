// Test wrapper for the App component to resolve React context issues
import React from "react";

// Import the actual App component from the renderer
import ActualApp from "../../../apps/renderer/src/App";

// Create a wrapper that ensures proper React context
function TestAppWrapper(props) {
  return React.createElement(ActualApp, props);
}

export default TestAppWrapper;
