// React setup for JSX automatic runtime in tests
const React = require("react");

// Make React available globally for automatic JSX
global.React = React;

// Fix React version compatibility in tests
global.jest = jest;
