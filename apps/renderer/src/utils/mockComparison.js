// Utility functions for comparing requests with mocks and detecting differences

/**
 * Compare a request response with a mock to detect differences
 * @param {Object} request - The request object with response
 * @param {Object} mock - The mock object to compare against
 * @returns {Object} Comparison result with differences
 */
export const compareRequestWithMock = (request, mock) => {
  const differences = [];
  const comparison = {
    hasDifferences: false,
    differences: [],
    summary: null,
    statusCodeMatches: true,
    headersMatch: true,
    bodyMatches: true,
  };

  if (!request.response || !mock) {
    return {
      ...comparison,
      hasDifferences: false,
      summary: "Cannot compare - missing request response or mock",
    };
  }

  // Compare status codes
  const requestStatusCode = request.response.statusCode;
  const mockStatusCode = mock.statusCode;

  if (requestStatusCode !== mockStatusCode) {
    comparison.statusCodeMatches = false;
    differences.push({
      type: "statusCode",
      field: "Status Code",
      expected: mockStatusCode,
      actual: requestStatusCode,
      message: `Status code differs: expected ${mockStatusCode}, got ${requestStatusCode}`,
    });
  }

  // Compare response headers
  const requestHeaders = request.response.headers || {};
  const mockHeaders = mock.headers || {};

  const headerDifferences = compareHeaders(requestHeaders, mockHeaders);
  if (headerDifferences.length > 0) {
    comparison.headersMatch = false;
    differences.push(...headerDifferences);
  }

  // Compare response body
  const bodyDifference = compareResponseBodies(
    request.response.body,
    mock.body
  );
  if (bodyDifference) {
    comparison.bodyMatches = false;
    differences.push(bodyDifference);
  }

  comparison.differences = differences;
  comparison.hasDifferences = differences.length > 0;

  if (comparison.hasDifferences) {
    const diffTypes = [];
    if (!comparison.statusCodeMatches) diffTypes.push("status code");
    if (!comparison.headersMatch) diffTypes.push("headers");
    if (!comparison.bodyMatches) diffTypes.push("body");

    comparison.summary = `Response differs from mock in: ${diffTypes.join(
      ", "
    )}`;
  } else {
    comparison.summary = "Response matches mock exactly";
  }

  return comparison;
};

/**
 * Compare response headers
 * @param {Object} requestHeaders - Headers from the actual response
 * @param {Object} mockHeaders - Headers from the mock
 * @returns {Array} Array of header differences
 */
const compareHeaders = (requestHeaders, mockHeaders) => {
  const differences = [];

  // Normalize header names (case-insensitive)
  const normalizeHeaders = (headers) => {
    const normalized = {};
    Object.keys(headers || {}).forEach((key) => {
      normalized[key.toLowerCase()] = headers[key];
    });
    return normalized;
  };

  const normalizedRequestHeaders = normalizeHeaders(requestHeaders);
  const normalizedMockHeaders = normalizeHeaders(mockHeaders);

  // Check for headers present in mock but different/missing in request
  Object.keys(normalizedMockHeaders).forEach((headerName) => {
    if (shouldIgnoreHeader(headerName)) return;

    const mockValue = normalizedMockHeaders[headerName];
    const requestValue = normalizedRequestHeaders[headerName];

    if (requestValue === undefined) {
      differences.push({
        type: "header",
        field: `Header: ${headerName}`,
        expected: mockValue,
        actual: "(missing)",
        message: `Header '${headerName}' is missing in response`,
      });
    } else if (requestValue !== mockValue) {
      differences.push({
        type: "header",
        field: `Header: ${headerName}`,
        expected: mockValue,
        actual: requestValue,
        message: `Header '${headerName}' differs: expected '${mockValue}', got '${requestValue}'`,
      });
    }
  });

  // Check for extra headers in request not in mock
  Object.keys(normalizedRequestHeaders).forEach((headerName) => {
    if (shouldIgnoreHeader(headerName)) return;

    if (normalizedMockHeaders[headerName] === undefined) {
      differences.push({
        type: "header",
        field: `Header: ${headerName}`,
        expected: "(not present)",
        actual: normalizedRequestHeaders[headerName],
        message: `Extra header '${headerName}' found in response: '${normalizedRequestHeaders[headerName]}'`,
      });
    }
  });

  return differences;
};

/**
 * Check if a header should be ignored in comparison
 * @param {string} headerName - The header name to check
 * @returns {boolean} True if header should be ignored
 */
const shouldIgnoreHeader = (headerName) => {
  const ignoredHeaders = [
    "date",
    "x-request-id",
    "x-correlation-id",
    "x-trace-id",
    "server",
    "x-powered-by",
    "connection",
    "transfer-encoding",
    "x-sniffler-mock", // Our own mock header
  ];

  return (
    ignoredHeaders.includes(headerName.toLowerCase()) ||
    headerName.toLowerCase().startsWith("x-runtime") ||
    headerName.toLowerCase().startsWith("x-request-start")
  );
};

/**
 * Compare response bodies
 * @param {string} requestBody - Body from the actual response
 * @param {string} mockBody - Body from the mock
 * @returns {Object|null} Body difference object or null if bodies match
 */
const compareResponseBodies = (requestBody, mockBody) => {
  // Handle null/undefined cases
  const normalizedRequestBody = requestBody || "";
  const normalizedMockBody = mockBody || "";

  if (normalizedRequestBody === normalizedMockBody) {
    return null;
  }

  // Try to parse as JSON and compare structured data
  try {
    const requestJson = JSON.parse(normalizedRequestBody);
    const mockJson = JSON.parse(normalizedMockBody);

    const jsonDifferences = compareJsonObjects(requestJson, mockJson);
    if (jsonDifferences.length > 0) {
      return {
        type: "body",
        field: "Response Body (JSON)",
        expected: normalizedMockBody,
        actual: normalizedRequestBody,
        message: "JSON body differs from mock",
        jsonDifferences: jsonDifferences,
        isJson: true,
      };
    }
    return null;
  } catch (e) {
    // Not valid JSON, compare as strings
    return {
      type: "body",
      field: "Response Body",
      expected: normalizedMockBody,
      actual: normalizedRequestBody,
      message: "Response body differs from mock",
      isJson: false,
    };
  }
};

/**
 * Compare JSON objects and return detailed differences
 * @param {*} actual - The actual JSON object
 * @param {*} expected - The expected JSON object
 * @param {string} path - Current path in the object (for nested comparison)
 * @returns {Array} Array of detailed differences
 */
const compareJsonObjects = (actual, expected, path = "") => {
  const differences = [];

  // Handle type mismatches
  if (typeof actual !== typeof expected) {
    differences.push({
      path: path || "root",
      expected: expected,
      actual: actual,
      message: `Type mismatch at ${
        path || "root"
      }: expected ${typeof expected}, got ${typeof actual}`,
    });
    return differences;
  }

  // Handle null values
  if (actual === null || expected === null) {
    if (actual !== expected) {
      differences.push({
        path: path || "root",
        expected: expected,
        actual: actual,
        message: `Value mismatch at ${path || "root"}`,
      });
    }
    return differences;
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      differences.push({
        path: path || "root",
        expected: expected,
        actual: actual,
        message: `Expected array at ${path || "root"}, got ${typeof actual}`,
      });
      return differences;
    }

    if (actual.length !== expected.length) {
      differences.push({
        path: `${path}[length]`,
        expected: expected.length,
        actual: actual.length,
        message: `Array length mismatch at ${path}: expected ${expected.length}, got ${actual.length}`,
      });
    }

    const maxLength = Math.max(actual.length, expected.length);
    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;
      if (i >= expected.length) {
        differences.push({
          path: itemPath,
          expected: "(not present)",
          actual: actual[i],
          message: `Extra item at ${itemPath}`,
        });
      } else if (i >= actual.length) {
        differences.push({
          path: itemPath,
          expected: expected[i],
          actual: "(missing)",
          message: `Missing item at ${itemPath}`,
        });
      } else {
        differences.push(
          ...compareJsonObjects(actual[i], expected[i], itemPath)
        );
      }
    }
    return differences;
  }

  // Handle objects
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      differences.push({
        path: path || "root",
        expected: expected,
        actual: actual,
        message: `Expected object at ${path || "root"}, got ${typeof actual}`,
      });
      return differences;
    }

    // Check all keys in expected object
    Object.keys(expected).forEach((key) => {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        differences.push({
          path: keyPath,
          expected: expected[key],
          actual: "(missing)",
          message: `Missing property ${keyPath}`,
        });
      } else {
        differences.push(
          ...compareJsonObjects(actual[key], expected[key], keyPath)
        );
      }
    });

    // Check for extra keys in actual object
    Object.keys(actual).forEach((key) => {
      if (!(key in expected)) {
        const keyPath = path ? `${path}.${key}` : key;
        differences.push({
          path: keyPath,
          expected: "(not present)",
          actual: actual[key],
          message: `Extra property ${keyPath}`,
        });
      }
    });

    return differences;
  }

  // Handle primitive values
  if (actual !== expected) {
    differences.push({
      path: path || "root",
      expected: expected,
      actual: actual,
      message: `Value mismatch at ${path || "root"}`,
    });
  }

  return differences;
};

/**
 * Find matching mock for a request
 * @param {Object} request - The request object
 * @param {Array} mocks - Array of available mocks
 * @returns {Object|null} Matching mock or null if no match found
 */
export const findMatchingMock = (request, mocks) => {
  if (!request || !mocks || !Array.isArray(mocks)) {
    return null;
  }

  return mocks.find((mock) => {
    // Match method and URL
    if (mock.method !== request.method) return false;

    // Normalize URLs for comparison
    const normalizeUrl = (url) => {
      try {
        const urlObj = new URL(url, "http://localhost");
        let pathname = urlObj.pathname.replace(/\/$/, "") || "/";
        const searchParams = new URLSearchParams(urlObj.search);
        searchParams.sort();
        const search = searchParams.toString();
        return pathname + (search ? "?" + search : "");
      } catch {
        return url.trim().replace(/\/$/, "") || "/";
      }
    };

    return normalizeUrl(mock.url) === normalizeUrl(request.url);
  });
};

/**
 * Get a summary of differences for display
 * @param {Object} comparison - Comparison result from compareRequestWithMock
 * @returns {string} Human-readable summary
 */
export const getDifferenceSummary = (comparison) => {
  if (!comparison.hasDifferences) {
    return "✅ Response matches mock";
  }

  const diffCount = comparison.differences.length;
  const types = [];

  if (!comparison.statusCodeMatches) types.push("status code");
  if (!comparison.headersMatch) types.push("headers");
  if (!comparison.bodyMatches) types.push("body");

  return `⚠️ ${diffCount} difference${
    diffCount > 1 ? "s" : ""
  } found in ${types.join(", ")}`;
};
