const http = require("http");
const https = require("https");
const url = require("url");
const { EventEmitter } = require("events");
const { shouldCreateMockForRequest } = require("./requestPatterns");

class SnifflerProxy extends EventEmitter {
  constructor(config = {}) {
    super();
    console.log(`🔧 SnifflerProxy constructor called with config:`, JSON.stringify(config, null, 2));
    this.port = config.port || 8080;
    this.targetHost = config.targetHost || "localhost";
    this.targetPort = config.targetPort || 3000;
    this.name = config.name || `Proxy ${this.port}`;
    this.server = null; // HTTP server instead of http-mitm-proxy
    this.isRunning = config.isRunning || false;
    this.requests = [];
    this.mocks = new Map(); // Store mocks by URL+method
    this.maxRequestHistory = config.maxRequestHistory || 100; // Changed default from 1000 to 100
    this.maxMockHistory = config.maxMockHistory || 1000; // Maximum number of mocks to keep
    this.stalePendingTimeout = 30000; // 30 seconds to mark pending requests as failed
    this.testingMode = false; // New property for testing mode
    this.autoSaveAsMocks = config.autoSaveAsMocks || false; // New property for auto-save setting
    this.autoReplaceMocksOnDifference =
      config.autoReplaceMocksOnDifference || false; // Auto-replace mocks when differences detected
    this.enablePatternMatching = config.enablePatternMatching || false; // Pattern matching setting
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      mocksServed: 0,
    };

    // Start cleanup interval for stale pending requests
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePendingRequests();
    }, 10000); // Check every 10 seconds
  }

  // Test if target server is reachable
  async testTargetConnection() {
    return new Promise((resolve) => {
      const net = require("net");
      const socket = new net.Socket();

      const timeout = 5000; // 5 second timeout

      socket.setTimeout(timeout);

      socket.on("connect", () => {
        socket.destroy();
        resolve({
          success: true,
          message: `Target server ${this.targetHost}:${this.targetPort} is reachable`,
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          success: false,
          message: `Connection to ${this.targetHost}:${this.targetPort} timed out`,
          errorType: "TIMEOUT",
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        let message = `Cannot connect to ${this.targetHost}:${this.targetPort}`;
        let errorType = "CONNECTION_ERROR";

        if (err.code === "ECONNREFUSED") {
          message = `No service is running on ${this.targetHost}:${this.targetPort}. Please start your target application first.`;
          errorType = "SERVICE_NOT_RUNNING";
        } else if (err.code === "ENOTFOUND") {
          message = `Cannot resolve hostname ${this.targetHost}. Please check the target host configuration.`;
          errorType = "HOSTNAME_NOT_FOUND";
        }

        resolve({
          success: false,
          message,
          errorType,
          error: err.message,
        });
      });

      socket.connect(this.targetPort, this.targetHost);
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      // Validate configuration to prevent circular proxy loops
      if (this.targetHost === "localhost" && this.targetPort === this.port) {
        reject(
          new Error(
            `Cannot proxy port ${this.port} to itself (${this.targetHost}:${this.targetPort}). This would create an infinite loop.`
          )
        );
        return;
      }

      if (this.targetHost === "127.0.0.1" && this.targetPort === this.port) {
        reject(
          new Error(
            `Cannot proxy port ${this.port} to itself (${this.targetHost}:${this.targetPort}). This would create an infinite loop.`
          )
        );
        return;
      }

      // Create HTTP server for proxying
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Start listening
      this.server.listen(this.port, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.isRunning = true;
        console.log(`✅ Proxy server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error(`❌ Proxy server error:`, error);
        this.isRunning = false;
        reject(error);
      });
    });
  }

  handleRequest(req, res) {
    try {
      const startTime = Date.now();
      const request = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: { ...req.headers },
        body: null,
        startTime,
        proxyPort: this.port,
        status: "pending",
        response: null,
      };

          // Check if we have a mock for this request
          const mockKey = `${request.method}:${request.url}`;
          const mock = this.mocks.get(mockKey);

          // Serve mocks only if manually enabled
          if (mock && mock.enabled) {
            // Serve mock response
            const headers = { ...mock.headers };
            headers["X-Sniffler-Mock"] = "true";

            ctx.proxyToClientResponse.writeHead(mock.statusCode, headers);
            ctx.proxyToClientResponse.end(mock.body);

            // Update stats
            this.stats.mocksServed++;

            // Emit mock served event
            this.emit("mock-served", { request, mock });
            return; // Don't call callback to prevent forwarding
          }

          // Capture request body for real requests
          let body = "";
          ctx.clientToProxyRequest.on("data", (chunk) => {
            body += chunk.toString();
          });

          ctx.clientToProxyRequest.on("end", () => {
            request.body = body;
            this.addRequest(request);
            this.stats.totalRequests++;
            this.emit("request", request);
          });

          // Store request ID in context for later matching
          ctx.snifflerRequestId = request.id;

          callback();
        } catch (error) {
          this.emit("error", {
            error: error.message,
            url: ctx.clientToProxyRequest?.url,
            method: ctx.clientToProxyRequest?.method,
            timestamp: new Date().toISOString(),
            stage: "request-handling",
          });
          // Try to send error response to client
          try {
            if (!ctx.proxyToClientResponse.headersSent) {
              ctx.proxyToClientResponse.writeHead(500, {
                "Content-Type": "application/json",
              });
              ctx.proxyToClientResponse.end(
                JSON.stringify({
                  error: "Proxy error",
                  message: error.message,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          } catch (responseError) {
            // console.error(`Failed to send error response:`, responseError);
          }
        }
      });

      // Capture responses
      this.proxy.onResponse((ctx, callback) => {
        try {
          const endTime = Date.now();

          // Find the corresponding request using stored ID or fallback to URL/method matching
          let request = null;

          if (ctx.snifflerRequestId) {
            // First try to find by stored request ID
            request = this.requests.find((r) => r.id === ctx.snifflerRequestId);
          }

          if (!request) {
            // Fallback to URL/method matching for older requests
            const requestUrl = ctx.clientToProxyRequest.url;
            const requestMethod = ctx.clientToProxyRequest.method;

            request = this.requests
              .filter(
                (r) =>
                  r.url === requestUrl &&
                  r.method === requestMethod &&
                  !r.response
              )
              .sort((a, b) => b.startTime - a.startTime)[0];
          }

          if (request) {
            const response = {
              requestId: request.id,
              statusCode: ctx.serverToProxyResponse.statusCode,
              statusMessage: ctx.serverToProxyResponse.statusMessage,
              headers: { ...ctx.serverToProxyResponse.headers },
              body: null,
              duration: endTime - request.startTime,
              timestamp: new Date().toISOString(),
            };

            let body = "";
            let responseCompleted = false;

            const completeResponse = () => {
              if (responseCompleted) return;
              responseCompleted = true;

              response.body = body;

              // Update the request with response info and mark as completed
              request.response = response;
              request.status =
                response.statusCode >= 400 ? "failed" : "success";
              request.duration = response.duration;
              request.completedAt = new Date().toISOString();

              // Auto-save as mock if enabled and response is successful
              if (this.autoSaveAsMocks && request.status === "success") {
                try {
                  const mockKey = `${request.method}:${request.url}`;

                  // Only create mock if it doesn't already exist
                  if (!this.mocks.has(mockKey)) {
                    // Check pattern matching if enabled
                    if (this.enablePatternMatching) {
                      const existingMocks = Array.from(this.mocks.values());
                      const patternDecision = shouldCreateMockForRequest(
                        request.method,
                        request.url,
                        this.port,
                        this.requests,
                        existingMocks,
                        this.enablePatternMatching
                      );

                      if (!patternDecision.shouldMock) {
                        // Still update stats but don't create mock
                        request.patternBlocked = true;
                        request.patternReason = patternDecision.reason;
                        this.emit("mock-pattern-blocked", {
                          request,
                          reason: patternDecision.reason,
                        });
                        // Don't return here - continue with request completion
                      } else {
                        const mock = this.createMockFromRequest(request);
                        // Emit event for auto-saved mock
                        this.emit("mock-auto-created", { request, mock });
                      }
                    } else {
                      const mock = this.createMockFromRequest(request);
                      // Emit event for auto-saved mock
                      this.emit("mock-auto-created", { request, mock });
                    }
                  }
                } catch (error) {}
              }

              // Check for mock comparison if this request matches an existing mock
              if (request.status === "success") {
                const mockKey = `${request.method}:${request.url}`;
                const existingMock = this.mocks.get(mockKey);

                if (existingMock) {
                  // Compare the actual response with the mock
                  const mockComparison = this.compareRequestWithMock(
                    request,
                    existingMock
                  );
                  request.mockComparison = mockComparison;

                  if (mockComparison.hasDifferences) {
                    // Auto-replace mock if setting is enabled
                    if (this.autoReplaceMocksOnDifference) {
                      // Mark the old request(s) as replaced before updating the mock
                      this.markRequestsAsReplaced(request.method, request.url);

                      // Update the existing mock with the new response
                      const updatedMock = this.updateMock(
                        request.method,
                        request.url,
                        {
                          statusCode: request.response.statusCode,
                          headers: request.response.headers,
                          body: request.response.body,
                        }
                      );

                      if (updatedMock) {
                        // Add tag to the current request indicating it's the new mock version
                        request.tags = request.tags || [];
                        if (!request.tags.includes("mock-replaced")) {
                          request.tags.push("mock-replaced");
                        }

                        // Emit event for auto-replacement notification
                        this.emit("mock-auto-replaced", {
                          request,
                          oldMock: existingMock,
                          newMock: updatedMock,
                          comparison: mockComparison,
                        });

                        // Emit save-mocks event to trigger auto-save
                        this.emit("save-mocks");
                      }
                    } else {
                      // Emit special event for mock differences (only if not auto-replacing)
                      this.emit("mock-difference-detected", {
                        request,
                        mock: existingMock,
                        comparison: mockComparison,
                      });
                    }
                  }
                }
              }

              // Update stats
              if (request.status === "success") {
                this.stats.successfulRequests++;
              } else {
                this.stats.failedRequests++;
              }

              this.emit("response", { request, response });
            };

            // Listen for client response completion to ensure request is marked as resolved
            ctx.proxyToClientResponse.on("finish", () => {
              // Ensure the request is marked as completed when sent to client
              if (!responseCompleted) {
                completeResponse();
              }
            });

            ctx.serverToProxyResponse.on("data", (chunk) => {
              body += chunk.toString();
            });

            ctx.serverToProxyResponse.on("end", () => {
              completeResponse();
            });

            ctx.serverToProxyResponse.on("error", (error) => {
              // Mark request as failed even with incomplete response
              request.response = {
                ...response,
                body: body || null,
                error: error.message,
              };
              request.status = "failed";
              request.duration = response.duration;
              request.completedAt = new Date().toISOString();

              this.stats.failedRequests++;

              this.emit("error", {
                error: error.message,
                url: ctx.clientToProxyRequest.url,
                method: ctx.clientToProxyRequest.method,
                timestamp: new Date().toISOString(),
                stage: "response-stream",
              });

              this.emit("response", { request, response: request.response });
              completeResponse();
            });

            // Set a timeout to prevent hanging responses
            const timeout = setTimeout(() => {
              if (!responseCompleted) {
                response.body = body;
                response.timeout = true;
                request.response = response;
                request.status = "timeout";
                request.duration = response.duration;
                request.completedAt = new Date().toISOString();
                this.stats.failedRequests++;
                this.emit("response", { request, response });
                completeResponse();
              }
            }, 10000); // 10 second timeout

            // Clear timeout when response completes
            ctx.serverToProxyResponse.on("end", () => {
              clearTimeout(timeout);
            });

            ctx.serverToProxyResponse.on("error", () => {
              clearTimeout(timeout);
            });
          }

          // IMPORTANT: Call callback immediately to allow proxy to pipe response to client
          // Don't wait for our body collection to complete
          callback();
        } catch (error) {
          this.emit("error", {
            error: error.message,
            url: ctx.clientToProxyRequest?.url,
            method: ctx.clientToProxyRequest?.method,
            timestamp: new Date().toISOString(),
            stage: "response-handling",
          });
          callback();
        }
      });

      // Handle proxy errors
      this.proxy.onError((ctx, err) => {
        // console.error(`Proxy error on port ${this.port}:`, err.message);

        let userFriendlyMessage = err.message;
        let errorType = "PROXY_ERROR";

        // Check for connection refused errors
        if (
          err.code === "ECONNREFUSED" ||
          err.message.includes("ECONNREFUSED")
        ) {
          userFriendlyMessage = `Cannot connect to target server ${this.targetHost}:${this.targetPort}. Please ensure a service is running on that port.`;
          errorType = "TARGET_SERVER_UNAVAILABLE";
        } else if (err.code === "ENOTFOUND") {
          userFriendlyMessage = `Cannot resolve hostname ${this.targetHost}. Please check the target host configuration.`;
          errorType = "HOSTNAME_NOT_FOUND";
        } else if (err.code === "ETIMEDOUT") {
          userFriendlyMessage = `Connection to ${this.targetHost}:${this.targetPort} timed out. The target server may be too slow to respond.`;
          errorType = "CONNECTION_TIMEOUT";
        }

        // Try to find and update the corresponding request
        if (ctx.clientToProxyRequest) {
          const requestUrl = ctx.clientToProxyRequest.url;
          const requestMethod = ctx.clientToProxyRequest.method;
          const request = this.requests
            .filter(
              (r) =>
                r.url === requestUrl &&
                r.method === requestMethod &&
                !r.response
            )
            .sort((a, b) => b.startTime - a.startTime)[0];

          if (request) {
            request.response = {
              requestId: request.id,
              statusCode: 0,
              statusMessage: "Proxy Error",
              headers: {},
              body: JSON.stringify({
                error: "Proxy Error",
                message: userFriendlyMessage,
                code: err.code,
                timestamp: new Date().toISOString(),
              }),
              duration: Date.now() - request.startTime,
              timestamp: new Date().toISOString(),
              error: err.message,
            };
            request.status = "failed";
            request.duration = request.response.duration;
            request.completedAt = new Date().toISOString();
            this.stats.failedRequests++;

            this.emit("response", { request, response: request.response });
          }
        }

        this.emit("error", {
          error: err.message,
          userFriendlyMessage,
          errorType,
          targetHost: this.targetHost,
          targetPort: this.targetPort,
          url: ctx.clientToProxyRequest?.url,
          method: ctx.clientToProxyRequest?.method,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      try {
        if (this.proxy && typeof this.proxy.close === "function") {
          this.proxy.close(() => {
            this.isRunning = false;
            resolve();
          });
        } else {
          this.isRunning = false;
          resolve();
        }
      } catch (error) {
        // console.error(`Error stopping proxy on port ${this.port}:`, error);
        this.isRunning = false;
        resolve(); // Resolve anyway to prevent hanging
      }
    });
  }

  addRequest(request) {
    this.requests.unshift(request); // Add to beginning for chronological order

    // Limit request history to prevent memory issues
    if (this.requests.length > this.maxRequestHistory) {
      this.requests = this.requests.slice(0, this.maxRequestHistory);
    }
  }

  cleanupStalePendingRequests() {
    const now = Date.now();
    let cleanedUp = 0;

    this.requests.forEach((request) => {
      // If request is still pending and older than stalePendingTimeout
      if (
        (!request.status || request.status === "pending") &&
        !request.response &&
        now - request.startTime > this.stalePendingTimeout
      ) {
        request.status = "failed";
        request.response = {
          requestId: request.id,
          statusCode: 0,
          statusMessage: "Request Timeout",
          headers: {},
          body: JSON.stringify({
            error: "Request Timeout",
            message: "Request was pending for too long and marked as failed",
            timestamp: new Date().toISOString(),
          }),
          duration: now - request.startTime,
          timestamp: new Date().toISOString(),
          timeout: true,
        };
        request.duration = request.response.duration;
        request.completedAt = new Date().toISOString();
        this.stats.failedRequests++;
        cleanedUp++;

        this.emit("response", { request, response: request.response });
      }
    });

    if (cleanedUp > 0) {
    }
  }

  addMock(method, url, response) {
    const mockKey = `${method}:${url}`;
    const mock = {
      id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method,
      url,
      statusCode: response.statusCode || 200,
      headers: response.headers || { "Content-Type": "application/json" },
      body: response.body || "{}",
      enabled: response.enabled !== undefined ? response.enabled : true, // Allow override of enabled status
      createdAt: new Date().toISOString(),
      name: response.name || `${method} ${url}`,
      tags: response.tags || [],
    };

    this.mocks.set(mockKey, mock);

    // Limit mocks to prevent memory issues
    this.limitMockHistory();

    return mock;
  }

  limitMockHistory() {
    if (this.mocks.size > this.maxMockHistory) {
      // Convert to array, sort by creation date, and keep only the most recent ones
      const mockArray = Array.from(this.mocks.entries());
      const sortedMocks = mockArray.sort(
        (a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt)
      );

      // Keep only the most recent maxMockHistory mocks
      const mocksToKeep = sortedMocks.slice(0, this.maxMockHistory);

      // Clear and repopulate the map
      this.mocks.clear();
      mocksToKeep.forEach(([key, mock]) => {
        this.mocks.set(key, mock);
      });
    }
  }

  // Update proxy settings
  updateSettings(settings) {
    if (settings.maxRequestHistory !== undefined) {
      this.maxRequestHistory = settings.maxRequestHistory;
      // Apply limit to current requests
      if (this.requests.length > this.maxRequestHistory) {
        this.requests = this.requests.slice(0, this.maxRequestHistory);
      }
    }
    if (settings.maxMockHistory !== undefined) {
      this.maxMockHistory = settings.maxMockHistory;
      // Apply limit to current mocks
      this.limitMockHistory();
    }
  }

  removeMock(method, url) {
    const mockKey = `${method}:${url}`;
    const deleted = this.mocks.delete(mockKey);
    return deleted;
  }

  toggleMock(method, url) {
    const mockKey = `${method}:${url}`;
    const mock = this.mocks.get(mockKey);
    if (mock) {
      mock.enabled = !mock.enabled;
      return mock;
    }
    return null;
  }

  updateMock(method, url, updates) {
    const mockKey = `${method}:${url}`;
    const mock = this.mocks.get(mockKey);
    if (mock) {
      Object.assign(mock, updates, { updatedAt: new Date().toISOString() });
      return mock;
    }
    return null;
  }

  getMocks() {
    return Array.from(this.mocks.values());
  }

  getMockByKey(method, url) {
    const mockKey = `${method}:${url}`;
    return this.mocks.get(mockKey);
  }

  getRequests() {
    return this.requests;
  }

  clearRequests() {
    this.requests = [];
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      mocksServed: this.stats.mocksServed, // Keep mock stats
    };
    this.emit("requests-cleared");
  }

  getStats() {
    return {
      ...this.stats,
      requestCount: this.requests.length,
      mockCount: this.mocks.size,
      isRunning: this.isRunning,
      port: this.port,
    };
  }

  // Export/Import functionality
  exportMocks() {
    return {
      mocks: this.getMocks(),
      exportDate: new Date().toISOString(),
      proxyPort: this.port,
    };
  }

  importMocks(mockData) {
    if (!mockData.mocks || !Array.isArray(mockData.mocks)) {
      throw new Error("Invalid mock data format");
    }

    let importedCount = 0;
    mockData.mocks.forEach((mock) => {
      const mockKey = `${mock.method}:${mock.url}`;
      mock.importedAt = new Date().toISOString();
      this.mocks.set(mockKey, mock);
      importedCount++;
    });

    return importedCount;
  }

  // Helper method to create mock from request
  createMockFromRequest(request) {
    if (!request.response) {
      throw new Error("Cannot create mock from request without response");
    }

    const mock = {
      method: request.method,
      url: request.url,
      statusCode: request.response.statusCode,
      headers: request.response.headers,
      body: request.response.body,
      name: `${request.method} ${request.url}`,
      tags: ["auto-generated"],
      enabled: false, // Auto-saved mocks are disabled by default
    };

    return this.addMock(mock.method, mock.url, mock);
  }

  // Set testing mode
  setTestingMode(enabled) {
    this.testingMode = enabled;
  }

  // Update auto-save setting
  setAutoSaveAsMocks(enabled) {
    this.autoSaveAsMocks = enabled;
  }

  // Update pattern matching setting
  setEnablePatternMatching(enabled) {
    this.enablePatternMatching = enabled;
  }

  // Mark previous requests as replaced when a mock is updated
  markRequestsAsReplaced(method, url) {
    this.requests.forEach((request) => {
      if (
        request.method === method &&
        request.url === url &&
        request.status === "success"
      ) {
        request.tags = request.tags || [];
        // Remove any existing mock diff tags and add replaced tag
        request.tags = request.tags.filter((tag) => tag !== "mock-diff");
        if (!request.tags.includes("replaced")) {
          request.tags.push("replaced");
        }
      }
    });
  }

  // Compare a request response with a mock to detect differences
  compareRequestWithMock(request, mock) {
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

    // Compare response headers (simplified for backend)
    const requestHeaders = request.response.headers || {};
    const mockHeaders = mock.headers || {};

    const headerDifferences = this.compareHeaders(requestHeaders, mockHeaders);
    if (headerDifferences.length > 0) {
      comparison.headersMatch = false;
      differences.push(...headerDifferences);
    }

    // Compare response body
    const bodyDifference = this.compareResponseBodies(
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
  }

  // Compare response headers
  compareHeaders(requestHeaders, mockHeaders) {
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
      if (this.shouldIgnoreHeader(headerName)) return;

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

    return differences;
  }

  // Check if a header should be ignored in comparison
  shouldIgnoreHeader(headerName) {
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
  }

  // Compare response bodies
  compareResponseBodies(requestBody, mockBody) {
    // Handle null/undefined cases
    const normalizedRequestBody = requestBody || "";
    const normalizedMockBody = mockBody || "";

    if (normalizedRequestBody === normalizedMockBody) {
      return null;
    }

    // Try to parse as JSON and compare
    try {
      const requestJson = JSON.parse(normalizedRequestBody);
      const mockJson = JSON.parse(normalizedMockBody);

      if (JSON.stringify(requestJson) !== JSON.stringify(mockJson)) {
        return {
          type: "body",
          field: "Response Body (JSON)",
          expected: normalizedMockBody,
          actual: normalizedRequestBody,
          message: "JSON body differs from mock",
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
  }
}

module.exports = SnifflerProxy;
