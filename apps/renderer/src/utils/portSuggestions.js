/**
 * Port suggestions utility
 * Provides suggestions for rarely used ports that are safe for development
 */

// Uncommon ports that are rarely used and safe for development
const UNCOMMON_PORTS = [
  // High-numbered ports (less likely to conflict)
  8701, 8702, 8703, 8704, 8705, 9001, 9002, 9003, 9004, 9005, 4001, 4002, 4003,
  4004, 4005, 7001, 7002, 7003, 7004, 7005,

  // Some specific ranges that are typically available
  3030, 3031, 3032, 3033, 3034, 5010, 5011, 5012, 5013, 5014, 6010, 6011, 6012,
  6013, 6014,

  // Even higher numbers for safety
  8890, 8891, 8892, 8893, 8894, 9090, 9091, 9092, 9093, 9094,

  // Some other rarely used ranges
  4040, 4041, 4042, 4043, 4044, 5050, 5051, 5052, 5053, 5054, 7070, 7071, 7072,
  7073, 7074,

  // More high-number ports
  8787, 8788, 8789, 8790, 8791, 9898, 9899, 9900, 9901, 9902,
];

// Common ports that should be avoided
const COMMON_PORTS = [
  21,
  22,
  23,
  25,
  53,
  80,
  110,
  143,
  443,
  993,
  995, // Standard services
  3000,
  3001,
  8000,
  8080,
  8443,
  8888, // Common development ports
  1433,
  3306,
  5432,
  6379,
  27017, // Database ports
  5000,
  5001,
  5002, // Flask/ASP.NET defaults
  4200,
  4300, // Angular defaults
  8081,
  8082,
  8083,
  8084,
  8085, // Jenkins, Tomcat, etc.
  9000, // SonarQube, etc.
  3030, // Some apps use this
];

/**
 * Get suggested ports for project setup
 * @param {Array} existingPorts - Array of ports already in use
 * @param {number} count - Number of suggestions to return (default: 5)
 * @returns {Array} Array of suggested port numbers
 */
export function getSuggestedPorts(existingPorts = [], count = 5) {
  const usedPorts = new Set([...existingPorts, ...COMMON_PORTS]);
  const suggestions = [];

  // Filter out already used ports and pick the first 'count' available
  for (const port of UNCOMMON_PORTS) {
    if (!usedPorts.has(port) && suggestions.length < count) {
      suggestions.push(port);
    }
  }

  // If we need more suggestions, generate some random high-number ports
  while (suggestions.length < count) {
    const randomPort = Math.floor(Math.random() * (9999 - 8000) + 8000);
    if (!usedPorts.has(randomPort) && !suggestions.includes(randomPort)) {
      suggestions.push(randomPort);
    }
  }

  return suggestions;
}

/**
 * Get port suggestions with descriptions
 * @param {Array} existingPorts - Array of ports already in use
 * @param {number} count - Number of suggestions to return (default: 3)
 * @returns {Array} Array of objects with port and description
 */
export function getSuggestedPortsWithDescriptions(
  existingPorts = [],
  count = 3
) {
  const ports = getSuggestedPorts(existingPorts, count);

  return ports.map((port) => ({
    port,
    description: getPortDescription(port),
  }));
}

/**
 * Get a friendly description for why a port is suggested
 * @param {number} port - The port number
 * @returns {string} Description of the port
 */
function getPortDescription(port) {
  if (port >= 9000) {
    return "High-number port, rarely used";
  } else if (port >= 8000) {
    return "Development-friendly range";
  } else if (port >= 7000) {
    return "Alternative development range";
  } else if (port >= 5000) {
    return "Mid-range port, good for testing";
  } else if (port >= 4000) {
    return "Custom application range";
  } else {
    return "Available development port";
  }
}

/**
 * Check if a port is commonly used and potentially problematic
 * @param {number} port - The port number to check
 * @returns {Object} Object with isCommon flag and warning message
 */
export function checkPortUsage(port) {
  const portNum = parseInt(port);

  if (COMMON_PORTS.includes(portNum)) {
    return {
      isCommon: true,
      warning: `Port ${portNum} is commonly used and may conflict with other services`,
    };
  }

  if (portNum < 1024) {
    return {
      isCommon: true,
      warning: `Port ${portNum} is a system port and may require administrator privileges`,
    };
  }

  return {
    isCommon: false,
    warning: null,
  };
}
