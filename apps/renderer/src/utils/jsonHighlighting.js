// Utility for highlighting differences in JSON and text content

/**
 * Compare two JSON objects and return an array with highlighted differences
 * @param {any} actual - The actual value
 * @param {any} expected - The expected value
 * @param {string} path - Current path in the object
 * @returns {Object} Difference information
 */
export const getJsonDifferences = (actual, expected, path = "") => {
  const differences = [];

  if (typeof actual !== typeof expected) {
    differences.push({
      path,
      type: "type_mismatch",
      actual,
      expected,
      actualType: typeof actual,
      expectedType: typeof expected,
    });
    return differences;
  }

  if (actual === null || expected === null) {
    if (actual !== expected) {
      differences.push({
        path,
        type: "value_mismatch",
        actual,
        expected,
      });
    }
    return differences;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      differences.push({
        path,
        type: "type_mismatch",
        actual,
        expected,
        actualType: typeof actual,
        expectedType: "array",
      });
      return differences;
    }

    const maxLength = Math.max(actual.length, expected.length);
    for (let i = 0; i < maxLength; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;

      if (i >= expected.length) {
        differences.push({
          path: itemPath,
          type: "extra_item",
          actual: actual[i],
          expected: undefined,
        });
      } else if (i >= actual.length) {
        differences.push({
          path: itemPath,
          type: "missing_item",
          actual: undefined,
          expected: expected[i],
        });
      } else {
        differences.push(
          ...getJsonDifferences(actual[i], expected[i], itemPath)
        );
      }
    }
  } else if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      differences.push({
        path,
        type: "type_mismatch",
        actual,
        expected,
        actualType: typeof actual,
        expectedType: "object",
      });
      return differences;
    }

    const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    allKeys.forEach((key) => {
      const keyPath = path ? `${path}.${key}` : key;

      if (!(key in expected)) {
        differences.push({
          path: keyPath,
          type: "extra_property",
          actual: actual[key],
          expected: undefined,
          key,
        });
      } else if (!(key in actual)) {
        differences.push({
          path: keyPath,
          type: "missing_property",
          actual: undefined,
          expected: expected[key],
          key,
        });
      } else {
        differences.push(
          ...getJsonDifferences(actual[key], expected[key], keyPath)
        );
      }
    });
  } else if (actual !== expected) {
    differences.push({
      path,
      type: "value_mismatch",
      actual,
      expected,
    });
  }

  return differences;
};

/**
 * Create a map of paths to difference information for quick lookup
 * @param {Array} differences - Array of difference objects
 * @returns {Map} Map of path to difference info
 */
export const createDifferenceMap = (differences) => {
  const map = new Map();
  differences.forEach((diff) => {
    map.set(diff.path, diff);
  });
  return map;
};

/**
 * Get CSS classes for highlighting a value based on difference type
 * @param {string} type - Type of difference
 * @param {boolean} isActual - Whether this is the actual or expected value
 * @returns {string} CSS classes
 */
export const getDifferenceStyles = (type, isActual = true) => {
  const baseStyles = "px-1 py-0.5 rounded font-semibold";

  switch (type) {
    case "value_mismatch":
      return isActual
        ? `${baseStyles} bg-red-200 text-red-900 border border-red-300`
        : `${baseStyles} bg-green-200 text-green-900 border border-green-300`;

    case "extra_property":
    case "extra_item":
      return isActual
        ? `${baseStyles} bg-orange-200 text-orange-900 border border-orange-300`
        : "";

    case "missing_property":
    case "missing_item":
      return isActual
        ? ""
        : `${baseStyles} bg-blue-200 text-blue-900 border border-blue-300`;

    case "type_mismatch":
      return isActual
        ? `${baseStyles} bg-purple-200 text-purple-900 border border-purple-300`
        : `${baseStyles} bg-indigo-200 text-indigo-900 border border-indigo-300`;

    default:
      return "";
  }
};

/**
 * Highlight differences in a string representation of JSON
 * @param {string} jsonString - The JSON string to highlight
 * @param {Array} differences - Array of differences
 * @param {boolean} isActual - Whether this is actual or expected content
 * @returns {string} HTML string with highlighted differences
 */
export const highlightJsonString = (
  jsonString,
  differences,
  isActual = true
) => {
  if (!differences || differences.length === 0) {
    return jsonString;
  }

  let result = jsonString;

  // Group differences by their actual/expected values to handle multiple occurrences
  const valueMap = new Map();
  differences.forEach((diff) => {
    const value = isActual ? diff.actual : diff.expected;
    if (value === undefined) return;

    const valueString = JSON.stringify(value);
    if (!valueMap.has(valueString)) {
      valueMap.set(valueString, []);
    }
    valueMap.get(valueString).push(diff);
  });

  // Sort by value length (longest first) to avoid conflicts in replacement
  const sortedValues = Array.from(valueMap.entries()).sort(
    (a, b) => b[0].length - a[0].length
  );

  sortedValues.forEach(([valueString, diffs]) => {
    // Get the most relevant difference (prefer value_mismatch over others)
    const relevantDiff =
      diffs.find((d) => d.type === "value_mismatch") || diffs[0];
    const styles = getDifferenceStyles(relevantDiff.type, isActual);

    if (styles && result.includes(valueString)) {
      const replacement = `<span class="${styles}" title="${relevantDiff.type}: ${relevantDiff.path}">${valueString}</span>`;

      // Replace ALL occurrences, not just the first one
      result = result.split(valueString).join(replacement);
    }
  });

  return result;
};

/**
 * Generate a legend for the difference highlighting
 * @returns {Array} Array of legend items
 */
export const getDifferenceLegend = () => [
  {
    type: "value_mismatch",
    actualLabel: "Changed Value",
    expectedLabel: "Original Value",
    actualColor: "bg-red-200 text-red-900",
    expectedColor: "bg-green-200 text-green-900",
  },
  {
    type: "extra_property",
    actualLabel: "Extra Property",
    expectedLabel: "",
    actualColor: "bg-orange-200 text-orange-900",
    expectedColor: "",
  },
  {
    type: "missing_property",
    actualLabel: "",
    expectedLabel: "Missing Property",
    actualColor: "",
    expectedColor: "bg-blue-200 text-blue-900",
  },
  {
    type: "type_mismatch",
    actualLabel: "Type Changed",
    expectedLabel: "Original Type",
    actualColor: "bg-purple-200 text-purple-900",
    expectedColor: "bg-indigo-200 text-indigo-900",
  },
];
