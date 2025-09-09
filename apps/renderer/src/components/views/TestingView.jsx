import { useState, useEffect } from "react";
import { getStatusColor } from "../../utils/helpers";

function TestingView({ hideHeader = false }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [proxies, setProxies] = useState([]);
  const [selectedProxy, setSelectedProxy] = useState("");
  const [selectedTestResult, setSelectedTestResult] = useState(null);
  const [isTestingModeActive, setIsTestingModeActive] = useState(false);

  useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getProxies();
      setProxies(result);
      if (result.length > 0) {
        setSelectedProxy(result[0].port.toString());
      }
    }
  };

  const runRegressionTests = async () => {
    if (!selectedProxy) {
      alert("Please select a proxy to test");
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    try {
      // Enable testing mode - this will enable mocking for database and outgoing requests
      if (window.electronAPI) {
        const result = await window.electronAPI.setTestingMode(true);
        if (result.success) {
          setIsTestingModeActive(true);
        }
      }

      // Get mocks for the selected proxy
      if (window.electronAPI) {
        const mocksResult = await window.electronAPI.getMocks(
          parseInt(selectedProxy)
        );
        if (!mocksResult.success) {
          alert("Failed to load mocks for testing");
          setIsRunning(false);
          return;
        }

        const mocks = mocksResult.mocks;
        if (mocks.length === 0) {
          alert("No mocks found for this proxy. Create some mocks first.");
          setIsRunning(false);
          return;
        }

        const results = [];

        // Test each mock by making actual HTTP requests
        for (const mock of mocks) {
          try {
            const startTime = Date.now();

            // Make actual HTTP request to test the mock
            const proxyInfo = proxies.find(
              (p) => p.port === parseInt(selectedProxy)
            );
            const testUrl = `http://localhost:${selectedProxy}${mock.url}`;

            const response = await fetch(testUrl, {
              method: mock.method,
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "Sniffler-Test-Runner/1.0",
              },
              // Only add body for methods that support it
              ...(mock.method !== "GET" && mock.method !== "HEAD"
                ? {
                    body:
                      mock.method === "POST" ||
                      mock.method === "PUT" ||
                      mock.method === "PATCH"
                        ? JSON.stringify({ test: true })
                        : undefined,
                  }
                : {}),
            });

            const endTime = Date.now();
            const duration = endTime - startTime;
            const responseText = await response.text();

            // Detailed comparison of actual vs expected
            const statusMatch = response.status === mock.statusCode;
            const responseHeaders = Object.fromEntries(
              response.headers.entries()
            );

            // Compare bodies more intelligently
            let bodyMatch = false;
            let bodyDifferences = [];

            try {
              // Try JSON comparison first
              if (responseText && mock.body) {
                try {
                  const actualJson = JSON.parse(responseText);
                  const expectedJson = JSON.parse(mock.body);
                  bodyMatch =
                    JSON.stringify(actualJson) === JSON.stringify(expectedJson);

                  if (!bodyMatch) {
                    bodyDifferences.push("JSON structure or values differ");
                  }
                } catch (e) {
                  // Not JSON, compare as strings
                  bodyMatch = responseText === mock.body;
                  if (!bodyMatch) {
                    if (responseText.length !== mock.body.length) {
                      bodyDifferences.push(
                        `Length differs: expected ${mock.body.length} chars, got ${responseText.length} chars`
                      );
                    }
                    // Check for partial match to be more helpful
                    if (
                      responseText.includes(
                        mock.body.substring(0, Math.min(50, mock.body.length))
                      )
                    ) {
                      bodyDifferences.push(
                        "Response contains expected content but has additional data"
                      );
                    } else if (
                      mock.body.includes(
                        responseText.substring(
                          0,
                          Math.min(50, responseText.length)
                        )
                      )
                    ) {
                      bodyDifferences.push(
                        "Response is missing expected content"
                      );
                    } else {
                      bodyDifferences.push(
                        "Response content is completely different"
                      );
                    }
                  }
                }
              } else {
                bodyMatch =
                  (!responseText && !mock.body) || responseText === mock.body;
                if (!bodyMatch) {
                  if (!responseText && mock.body) {
                    bodyDifferences.push(
                      "Expected response body, but got empty response"
                    );
                  } else if (responseText && !mock.body) {
                    bodyDifferences.push(
                      "Got response body, but expected empty response"
                    );
                  }
                }
              }
            } catch (error) {
              bodyMatch = false;
              bodyDifferences.push(`Error comparing bodies: ${error.message}`);
            }

            // Compare headers (basic check for critical headers)
            const headerDifferences = [];
            const criticalHeaders = ["content-type", "content-length"];
            criticalHeaders.forEach((headerName) => {
              const expectedValue =
                mock.headers?.[headerName] ||
                mock.headers?.[headerName.toLowerCase()];
              const actualValue =
                responseHeaders[headerName] ||
                responseHeaders[headerName.toLowerCase()];

              if (expectedValue && actualValue !== expectedValue) {
                headerDifferences.push(
                  `${headerName}: expected "${expectedValue}", got "${actualValue}"`
                );
              }
            });

            const testStatus =
              statusMatch && bodyMatch && headerDifferences.length === 0
                ? "passed"
                : "failed";

            // Build comprehensive differences array
            const differences = [];
            if (!statusMatch) {
              differences.push({
                type: "status",
                message: `Status: expected ${mock.statusCode}, got ${response.status}`,
                expected: mock.statusCode,
                actual: response.status,
              });
            }
            if (bodyDifferences.length > 0) {
              differences.push({
                type: "body",
                message: `Body: ${bodyDifferences.join(", ")}`,
                expected:
                  mock.body?.substring(0, 100) +
                  (mock.body?.length > 100 ? "..." : ""),
                actual:
                  responseText?.substring(0, 100) +
                  (responseText?.length > 100 ? "..." : ""),
              });
            }
            if (headerDifferences.length > 0) {
              differences.push({
                type: "headers",
                message: `Headers: ${headerDifferences.join(", ")}`,
                details: headerDifferences,
              });
            }

            results.push({
              id: mock.id,
              method: mock.method,
              url: mock.url,
              expected: {
                statusCode: mock.statusCode,
                headers: mock.headers,
                body: mock.body,
              },
              actual: {
                statusCode: response.status,
                headers: responseHeaders,
                body: responseText,
              },
              status: testStatus,
              duration: duration,
              timestamp: new Date().toISOString(),
              differences: differences,
              failureReason:
                differences.length > 0
                  ? differences.map((d) => d.message).join("; ")
                  : null,
            });

            // Update UI progressively
            setTestResults([...results]);

            // Add small delay to avoid overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            results.push({
              id: mock.id,
              method: mock.method,
              url: mock.url,
              status: "error",
              error: error.message,
              duration: 0,
              timestamp: new Date().toISOString(),
            });
            setTestResults([...results]);
          }
        }

        setTestResults(results);
      }
    } catch (error) {
      alert("Test execution failed: " + error.message);
    } finally {
      // Disable testing mode when tests complete
      if (window.electronAPI) {
        const result = await window.electronAPI.setTestingMode(false);
        if (result.success) {
          setIsTestingModeActive(false);
        }
      }
      setIsRunning(false);
    }
  };

  const passedTests = testResults.filter((r) => r.status === "passed").length;
  const failedTests = testResults.filter((r) => r.status === "failed").length;
  const errorTests = testResults.filter((r) => r.status === "error").length;

  return (
    <div>
      {/* Testing Mode Indicator */}
      {isTestingModeActive && (
        <div className="mb-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400 text-lg">🧪</span>
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-200">
                Testing Mode Active
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Database and outgoing requests are being mocked during test
                execution
              </div>
            </div>
          </div>
        </div>
      )}

      {!hideHeader && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Regression Testing
          </h1>
          <div className="flex gap-2 items-center">
            <select
              value={selectedProxy}
              onChange={(e) => setSelectedProxy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isRunning}
            >
              <option value="">Select Proxy</option>
              {proxies.map((proxy) => (
                <option key={proxy.port} value={proxy.port}>
                  {proxy.name} (Port {proxy.port})
                </option>
              ))}
            </select>
            <button
              onClick={runRegressionTests}
              disabled={isRunning || !selectedProxy}
              className={`px-4 py-2 rounded-md font-medium ${
                isRunning || !selectedProxy
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isRunning ? "Running..." : "Run Tests"}
            </button>
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Regression Testing
          </span>
          <div className="flex gap-2 items-center">
            <select
              value={selectedProxy}
              onChange={(e) => setSelectedProxy(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isRunning}
            >
              <option value="">Select Proxy</option>
              {proxies.map((proxy) => (
                <option key={proxy.port} value={proxy.port}>
                  {proxy.name} (Port {proxy.port})
                </option>
              ))}
            </select>
            <button
              onClick={runRegressionTests}
              disabled={isRunning || !selectedProxy}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isRunning || !selectedProxy
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isRunning ? "Running..." : "Run Tests"}
            </button>
          </div>
        </div>
      )}

      {/* Test Summary */}
      {testResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {testResults.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Tests
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {passedTests}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Passed
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-600">{failedTests}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Failed
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-orange-600">
              {errorTests}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Errors
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Failure Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {testResults.map((result) => (
                  <tr
                    key={result.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          result.status
                        )}`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`font-medium px-2 py-1 rounded text-xs ${
                          result.method === "GET"
                            ? "bg-green-100 text-green-800"
                            : result.method === "POST"
                            ? "bg-blue-100 text-blue-800"
                            : result.method === "PUT"
                            ? "bg-orange-100 text-orange-800"
                            : result.method === "DELETE"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {result.method}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-md">
                      <span className="text-gray-600 dark:text-gray-300 truncate block">
                        {result.url}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-sm">
                      {result.status === "failed" && result.failureReason ? (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          <div
                            className="truncate"
                            title={result.failureReason}
                          >
                            {result.failureReason}
                          </div>
                          {result.differences &&
                            result.differences.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {result.differences.length} difference
                                {result.differences.length !== 1
                                  ? "s"
                                  : ""}{" "}
                                found
                              </div>
                            )}
                        </div>
                      ) : result.status === "error" && result.error ? (
                        <div
                          className="text-sm text-orange-600 dark:text-orange-400 truncate"
                          title={result.error}
                        >
                          {result.error}
                        </div>
                      ) : (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          All assertions passed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.duration ? `${result.duration}ms` : "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedTestResult(result)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Ready to Run Tests
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a proxy with mocks and click "Run Tests" to start
              regression testing.
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong>What happens during testing:</strong>
              </p>
              <p>
                • Tests validate that your backend server is working correctly
              </p>
              <p>
                • Each test makes real HTTP requests to your backend server
                through the proxy
              </p>
              <p>
                • Responses from the backend are compared against your saved
                mock expectations
              </p>
              <p>
                • Database and outgoing API requests are mocked to ensure
                consistent test results
              </p>
              <p>
                • Any differences between backend and mock responses are
                highlighted with detailed failure analysis
              </p>
              <p>
                • This helps ensure your mocks stay in sync with real API
                behavior
              </p>
              <p>
                • Auto-saved mocks are disabled by default to prevent
                interference
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Detail Modal */}
      {selectedTestResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Test Result Details: {selectedTestResult.method}{" "}
                {selectedTestResult.url}
              </h3>
              <button
                onClick={() => setSelectedTestResult(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              {/* Test Status Banner */}
              <div
                className={`rounded-lg p-4 mb-6 ${
                  selectedTestResult.status === "passed"
                    ? "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700"
                    : selectedTestResult.status === "failed"
                    ? "bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700"
                    : "bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-2xl ${
                      selectedTestResult.status === "passed"
                        ? "text-green-600"
                        : selectedTestResult.status === "failed"
                        ? "text-red-600"
                        : "text-orange-600"
                    }`}
                  >
                    {selectedTestResult.status === "passed"
                      ? "✅"
                      : selectedTestResult.status === "failed"
                      ? "❌"
                      : "⚠️"}
                  </span>
                  <div>
                    <div
                      className={`font-semibold ${
                        selectedTestResult.status === "passed"
                          ? "text-green-800 dark:text-green-200"
                          : selectedTestResult.status === "failed"
                          ? "text-red-800 dark:text-red-200"
                          : "text-orange-800 dark:text-orange-200"
                      }`}
                    >
                      Test{" "}
                      {selectedTestResult.status === "passed"
                        ? "Passed"
                        : selectedTestResult.status === "failed"
                        ? "Failed"
                        : "Error"}
                    </div>
                    {selectedTestResult.failureReason && (
                      <div
                        className={`text-sm ${
                          selectedTestResult.status === "failed"
                            ? "text-red-600 dark:text-red-300"
                            : "text-orange-600 dark:text-orange-300"
                        }`}
                      >
                        {selectedTestResult.failureReason}
                      </div>
                    )}
                    {selectedTestResult.error && (
                      <div className="text-sm text-orange-600 dark:text-orange-300">
                        {selectedTestResult.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Meta Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Duration
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedTestResult.duration
                      ? `${selectedTestResult.duration}ms`
                      : "N/A"}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Timestamp
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(selectedTestResult.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Differences
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedTestResult.differences?.length || 0}
                  </div>
                </div>
              </div>

              {/* Differences Detail */}
              {selectedTestResult.differences &&
                selectedTestResult.differences.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      🔍 Detailed Differences
                    </h4>
                    <div className="space-y-4">
                      {selectedTestResult.differences.map((diff, index) => (
                        <div
                          key={index}
                          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-red-500 text-xl mt-1">
                              {diff.type === "status"
                                ? "📊"
                                : diff.type === "body"
                                ? "📄"
                                : diff.type === "headers"
                                ? "📋"
                                : "⚠️"}
                            </span>
                            <div className="flex-1">
                              <div className="font-medium text-red-800 dark:text-red-200 mb-2">
                                {diff.type.charAt(0).toUpperCase() +
                                  diff.type.slice(1)}{" "}
                                Mismatch
                              </div>
                              <div className="text-sm text-red-700 dark:text-red-300 mb-3">
                                {diff.message}
                              </div>
                              {diff.expected !== undefined &&
                                diff.actual !== undefined && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Expected:
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-xs max-h-32 overflow-auto">
                                        {typeof diff.expected === "object"
                                          ? JSON.stringify(
                                              diff.expected,
                                              null,
                                              2
                                            )
                                          : String(diff.expected)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Actual:
                                      </div>
                                      <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-xs max-h-32 overflow-auto">
                                        {typeof diff.actual === "object"
                                          ? JSON.stringify(diff.actual, null, 2)
                                          : String(diff.actual)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              {diff.details && (
                                <div className="mt-3">
                                  <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Additional Details:
                                  </div>
                                  <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                                    {diff.details.map((detail, detailIndex) => (
                                      <li key={detailIndex}>{detail}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Expected vs Actual Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expected Response */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
                    🎯 Expected Response
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Status Code:
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-sm">
                        {selectedTestResult.expected?.statusCode}
                      </div>
                    </div>
                    {selectedTestResult.expected?.headers &&
                      Object.keys(selectedTestResult.expected.headers).length >
                        0 && (
                        <div>
                          <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Headers:
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-xs max-h-32 overflow-auto">
                            {JSON.stringify(
                              selectedTestResult.expected.headers,
                              null,
                              2
                            )}
                          </div>
                        </div>
                      )}
                    <div>
                      <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Body:
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-xs max-h-48 overflow-auto">
                        {selectedTestResult.expected?.body || "(empty)"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actual Response */}
                <div
                  className={`border rounded-lg p-4 ${
                    selectedTestResult.status === "passed"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                  }`}
                >
                  <h4
                    className={`text-lg font-semibold mb-4 ${
                      selectedTestResult.status === "passed"
                        ? "text-green-800 dark:text-green-200"
                        : "text-red-800 dark:text-red-200"
                    }`}
                  >
                    📡 Actual Response
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Status Code:
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-sm">
                        {selectedTestResult.actual?.statusCode}
                      </div>
                    </div>
                    {selectedTestResult.actual?.headers &&
                      Object.keys(selectedTestResult.actual.headers).length >
                        0 && (
                        <div>
                          <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Headers:
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-xs max-h-32 overflow-auto">
                            {JSON.stringify(
                              selectedTestResult.actual.headers,
                              null,
                              2
                            )}
                          </div>
                        </div>
                      )}
                    <div>
                      <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Body:
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded font-mono text-xs max-h-48 overflow-auto">
                        {selectedTestResult.actual?.body || "(empty)"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <button
                onClick={() => setSelectedTestResult(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestingView;
