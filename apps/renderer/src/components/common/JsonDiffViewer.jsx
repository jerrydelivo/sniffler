import {
  getJsonDifferences,
  highlightJsonString,
} from "../../utils/jsonHighlighting";

const JsonDiffViewer = ({
  actualContent,
  expectedContent,
  title = "JSON Comparison",
  showLegend = true,
  maxHeight = "max-h-64",
}) => {
  // Parse content to get JSON objects
  const parseContent = (content) => {
    if (typeof content === "string") {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return content;
  };

  const actualObj = parseContent(actualContent);
  const expectedObj = parseContent(expectedContent);

  // Get differences
  const differences = getJsonDifferences(actualObj, expectedObj);

  // Format as JSON strings
  const actualJsonString =
    typeof actualObj === "object"
      ? JSON.stringify(actualObj, null, 2)
      : String(actualObj);
  const expectedJsonString =
    typeof expectedObj === "object"
      ? JSON.stringify(expectedObj, null, 2)
      : String(expectedObj);

  // Highlight differences
  const highlightedActual = highlightJsonString(
    actualJsonString,
    differences,
    true
  );
  const highlightedExpected = highlightJsonString(
    expectedJsonString,
    differences,
    false
  );

  const hasDifferences = differences.length > 0;

  return (
    <div className="space-y-4">
      {/* Legend */}
      {showLegend && hasDifferences && (
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Difference Legend:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="inline-block w-4 h-4 bg-red-200 border border-red-300 rounded mr-2"></span>
              Changed values
            </div>
            <div>
              <span className="inline-block w-4 h-4 bg-orange-200 border border-orange-300 rounded mr-2"></span>
              Extra properties
            </div>
            <div>
              <span className="inline-block w-4 h-4 bg-blue-200 border border-blue-300 rounded mr-2"></span>
              Missing properties
            </div>
            <div>
              <span className="inline-block w-4 h-4 bg-purple-200 border border-purple-300 rounded mr-2"></span>
              Type changes
            </div>
          </div>
        </div>
      )}

      {/* Comparison Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Actual Content */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Actual Response
            {hasDifferences && (
              <span className="ml-2 text-xs text-red-600 font-semibold">
                ({differences.length} difference
                {differences.length !== 1 ? "s" : ""})
              </span>
            )}
          </p>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-auto">
            <div className={`${maxHeight} overflow-auto`}>
              <pre
                className="text-xs text-green-400 whitespace-pre-wrap font-mono"
                dangerouslySetInnerHTML={{ __html: highlightedActual }}
              />
            </div>
          </div>
        </div>

        {/* Expected Content */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Expected (Mock)
          </p>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-auto">
            <div className={`${maxHeight} overflow-auto`}>
              <pre
                className="text-xs text-green-400 whitespace-pre-wrap font-mono"
                dangerouslySetInnerHTML={{ __html: highlightedExpected }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Differences Summary */}
      {hasDifferences && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-orange-800 mb-2">
            Summary of Differences:
          </h4>
          <ul className="space-y-1">
            {differences.slice(0, 5).map((diff, index) => (
              <li key={index} className="text-xs text-orange-700">
                <strong>{diff.path || "root"}:</strong>{" "}
                {diff.type.replace("_", " ")}
                {diff.type === "value_mismatch" && (
                  <span>
                    {" "}
                    (expected: {JSON.stringify(diff.expected)}, got:{" "}
                    {JSON.stringify(diff.actual)})
                  </span>
                )}
                {diff.type === "extra_property" && (
                  <span>
                    {" "}
                    (unexpected property: {JSON.stringify(diff.actual)})
                  </span>
                )}
                {diff.type === "missing_property" && (
                  <span>
                    {" "}
                    (missing expected property: {JSON.stringify(diff.expected)})
                  </span>
                )}
              </li>
            ))}
            {differences.length > 5 && (
              <li className="text-xs text-orange-600 italic">
                ... and {differences.length - 5} more differences
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default JsonDiffViewer;
