// Utility functions for detecting and grouping similar request patterns
// Main process version (Node.js)

/**
 * Checks if a string looks like a UUID (v4 format)
 * @param {string} str - The string to check
 * @returns {boolean} - True if it looks like a UUID
 */
const isUuid = (str) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Checks if a string is a numeric ID
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a number
 */
const isNumericId = (str) => {
  return /^\d+$/.test(str);
};

/**
 * Extracts path segments from a URL
 * @param {string} url - The URL to parse
 * @returns {Array} - Array of path segments
 */
const getPathSegments = (url) => {
  try {
    // Remove query parameters and fragments
    const cleanUrl = url.split("?")[0].split("#")[0];
    // Remove leading slash if present
    const path = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
    // Split by slashes and filter empty segments
    return path.split("/").filter((segment) => segment.length > 0);
  } catch (error) {
    return [];
  }
};

/**
 * Creates a pattern template from a URL by replacing numeric IDs and UUIDs with placeholders
 * @param {string} url - The URL to create a pattern from
 * @returns {string} - The pattern template
 */
const createUrlPattern = (url) => {
  const segments = getPathSegments(url);

  const patternSegments = segments.map((segment) => {
    if (isNumericId(segment)) {
      return "{id}";
    } else if (isUuid(segment)) {
      return "{uuid}";
    } else {
      return segment;
    }
  });

  return "/" + patternSegments.join("/");
};

/**
 * Checks if two URLs follow the same pattern
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} - True if they follow the same pattern
 */
const haveSamePattern = (url1, url2) => {
  const pattern1 = createUrlPattern(url1);
  const pattern2 = createUrlPattern(url2);
  return pattern1 === pattern2;
};

/**
 * Checks if a mock should be created based on pattern matching rules
 * @param {string} method - HTTP method
 * @param {string} url - URL path
 * @param {number} port - Proxy port
 * @param {Array} existingRequests - Array of existing requests
 * @param {Array} existingMocks - Array of existing mocks
 * @param {boolean} enablePatternMatching - Whether pattern matching is enabled
 * @returns {Object} - Decision object with shouldMock boolean and reason
 */
const shouldCreateMockForRequest = (
  method,
  url,
  port,
  existingRequests,
  existingMocks,
  enablePatternMatching = false
) => {
  // If pattern matching is disabled, allow all mocks
  if (!enablePatternMatching) {
    return { shouldMock: true, reason: "Pattern matching disabled" };
  }

  // Check if a mock already exists for this exact URL and method
  const exactMockExists = existingMocks.some(
    (mock) => mock.url === url && mock.method === method
  );

  if (exactMockExists) {
    return { shouldMock: false, reason: "Exact mock already exists" };
  }

  // Get the pattern for this request
  const requestPattern = createUrlPattern(url);

  // Find existing mocks with the same pattern on the same proxy
  const samePatternMocks = existingMocks.filter(
    (existingMock) =>
      existingMock.method === method &&
      createUrlPattern(existingMock.url) === requestPattern
  );

  // If there's already a mock with the same pattern, don't create another one
  if (samePatternMocks.length > 0) {
    const firstMock = samePatternMocks[0];
    return {
      shouldMock: false,
      reason: `Mock already exists for pattern ${requestPattern}: ${firstMock.method} ${firstMock.url}`,
      existingMockUrl: firstMock.url,
    };
  }

  // If no mocks exist with this pattern, allow creation
  return { shouldMock: true, reason: "First mock for this pattern" };
};

/**
 * Gets a human-readable description of a URL pattern
 * @param {string} url - The URL to describe
 * @returns {string} - Human-readable pattern description
 */
const getPatternDescription = (url) => {
  const pattern = createUrlPattern(url);
  const segments = getPathSegments(pattern);

  if (segments.length === 0) {
    return "Root path";
  }

  const hasId = segments.includes("{id}");
  const hasUuid = segments.includes("{uuid}");

  if (hasId && hasUuid) {
    return `${segments[0]} with ID and UUID parameters`;
  } else if (hasId) {
    return `${segments[0]} with ID parameter`;
  } else if (hasUuid) {
    return `${segments[0]} with UUID parameter`;
  } else {
    return `${segments[0]} endpoint`;
  }
};

module.exports = {
  isUuid,
  isNumericId,
  getPathSegments,
  createUrlPattern,
  haveSamePattern,
  shouldCreateMockForRequest,
  getPatternDescription,
};
