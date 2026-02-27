const http = require("http");
const https = require("https");
const url = require("url");
const { EventEmitter } = require("events");
const { shouldCreateMockForRequest } = require("./requestPatterns");

// Import mock comparison utilities
const {
  compareRequestWithMock,
  findMatchingMock,
} = require("./utils/mockComparison");

class SnifflerProxy extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.port || 8080;
    this.targetHost = config.targetHost || "localhost";
    this.targetPort = config.targetPort || 3000;
    this.name = config.name || `Proxy ${this.port}`;
    this.server = null;
    this.isRunning = config.isRunning || false;
    this.requests = [];
    this.mocks = new Map(); // Store mocks by URL+method
    this.maxRequestHistory = config.maxRequestHistory || 100;
    this.maxMockHistory = config.maxMockHistory || 1000;
    this.stalePendingTimeout = 30000; // 30 seconds to mark pending requests as failed
    this.testingMode = false;
    this.autoSaveAsMocks = config.autoSaveAsMocks || false;
    this.autoReplaceMocksOnDifference =
      config.autoReplaceMocksOnDifference || false;
    this.enablePatternMatching = config.enablePatternMatching || false;
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

      socket.on("error", (error) => {
        socket.destroy();
        let message = `Cannot connect to ${this.targetHost}:${this.targetPort}`;
        let errorType = "CONNECTION_FAILED";

        if (error.code === "ECONNREFUSED") {
          message = `No service is running on ${this.targetHost}:${this.targetPort}. Please start your target application first.`;
          errorType = "SERVICE_NOT_RUNNING";
        } else if (error.code === "ENOTFOUND") {
          message = `Host ${this.targetHost} not found`;
          errorType = "HOST_NOT_FOUND";
        }

        resolve({
          success: false,
          message,
          errorType,
          error: error.code || error.message,
        });
      });

      socket.connect(this.targetPort, this.targetHost);
    });
  }

  start() {
    return new Promise(async (resolve, reject) => {
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

      this.server.on("error", (error) => {
        console.error(`❌ Proxy server error:`, error);
        this.isRunning = false;
        reject(error);
      });
    });
  }

  handleRequest(req, res) {
    console.log(
      `🌟🌟🌟 PROXY HANDLING REQUEST: ${req.method} ${req.url} ON PORT ${this.port} 🌟🌟🌟`
    );
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

      // Add to request history (push to end for chronological order)
      this.requests.push(request);
      this.trimRequestHistory();

      // Emit request immediately when it starts
      this.emit("request", request);

      // Check if we have a mock for this request
      const mock = this.findMatchingMock(request.method, request.url);

      // Serve mocks only if manually enabled
      if (mock && mock.enabled) {
        // Handle delayed responses
        const delay = mock.delay || 0;

        const serveMock = () => {
          try {
            // Serve mock response
            const headers = { ...mock.headers };
            headers["X-Sniffler-Mock"] = "true";

            res.writeHead(mock.statusCode, headers);
            res.end(mock.body);

            // Update stats
            this.stats.mocksServed++;

            // Update request with mock response
            // Normalize final request lifecycle status to 'completed' (tests expect this)
            request.status = "completed";
            request.response = {
              statusCode: mock.statusCode,
              headers: headers,
              body: mock.body,
              responseTime: Date.now() - startTime,
            };

            // Emit mock served event and response event
            this.emit("mock-served", { request, mock });
            this.emit("response", { request, response: request.response });
          } catch (mockError) {
            console.error(`❌ Mock serve error:`, mockError);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("Internal Server Error - Mock");
            }
            request.status = "failed";
            request.error = mockError.message;
            this.stats.failedRequests++;
          }
        };

        if (delay > 0) {
          setTimeout(serveMock, delay);
        } else {
          serveMock();
        }
        return;
      }

      // Capture request body
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          request.body = body;

          // Forward request to target server
          const targetOptions = {
            hostname: this.targetHost,
            port: this.targetPort,
            path: req.url,
            method: req.method,
            headers: { ...req.headers },
          };

          // Remove host header to avoid conflicts
          delete targetOptions.headers.host;

          const targetReq = http.request(targetOptions, (targetRes) => {
            try {
              // Forward response headers
              res.writeHead(targetRes.statusCode, targetRes.headers);

              let responseBody = "";
              targetRes.on("data", (chunk) => {
                responseBody += chunk.toString();
                res.write(chunk);
              });

              targetRes.on("end", () => {
                try {
                  res.end();

                  // Update request with response
                  request.status = "completed";
                  request.response = {
                    statusCode: targetRes.statusCode,
                    statusMessage: targetRes.statusMessage,
                    headers: { ...targetRes.headers },
                    body: responseBody,
                    responseTime: Date.now() - startTime,
                  };

                  this.stats.totalRequests++;
                  if (
                    targetRes.statusCode >= 200 &&
                    targetRes.statusCode < 300
                  ) {
                    this.stats.successfulRequests++;
                  } else {
                    this.stats.failedRequests++;
                  }

                  // Check for mock differences if we have a successful response
                  if (
                    (request.status === "completed" ||
                      request.status === "success") &&
                    request.response
                  ) {
                    try {
                      const availableMocks = this.getMocks();
                      const matchingMock = findMatchingMock(
                        request,
                        availableMocks
                      );

                      console.log(
                        `🔍🔍🔍 PROXY MOCK COMPARISON CHECK for ${request.method} ${request.url} 🔍🔍🔍`
                      );
                      console.log(
                        `   Available mocks: ${availableMocks?.length || 0}`
                      );
                      console.log(`   Matching mock found: ${!!matchingMock}`);
                      console.log(`   Mock enabled: ${matchingMock?.enabled}`);
                      console.log(
                        `   Request was served from backend: ${!request.servedFromMock}`
                      );

                      // Check for differences if:
                      // 1. We have a matching mock (regardless of enabled state)
                      // 2. The request actually hit the backend (not served from mock)
                      if (matchingMock && !request.servedFromMock) {
                        console.log(
                          `🔍 Found matching mock and request hit backend, comparing for API drift...`
                        );
                        const mockComparison = compareRequestWithMock(
                          request,
                          matchingMock
                        );
                        request.mockComparison = mockComparison;

                        console.log(
                          `   Has differences: ${mockComparison.hasDifferences}`
                        );
                        console.log(
                          `   Comparison summary: ${mockComparison.summary}`
                        );

                        // Emit mock difference event if differences are detected
                        if (mockComparison.hasDifferences) {
                          console.log(
                            `⚠️ Proxy API drift detected! Response differs from existing mock for ${request.method} ${request.url}`
                          );
                          console.log(
                            `   Mock enabled: ${matchingMock.enabled}`
                          );
                          console.log(
                            `   Differences:`,
                            mockComparison.differences
                          );
                          console.log(
                            `🚨🚨🚨 ABOUT TO EMIT MOCK-DIFFERENCE-DETECTED EVENT from proxy on port ${this.port} 🚨🚨🚨`
                          );
                          console.log(
                            `🚨 Event listeners count:`,
                            this.listenerCount("mock-difference-detected")
                          );
                          console.log(
                            `🎯 Event emitter instance:`,
                            this.constructor.name
                          );
                          console.log(
                            `📍 Emitter memory location:`,
                            Object.prototype.toString.call(this)
                          );
                          this.emit("mock-difference-detected", {
                            request,
                            mock: matchingMock,
                            comparison: mockComparison,
                            proxyPort: this.port,
                            isDrift: true, // Flag to indicate this is API drift detection
                          });
                          console.log(
                            `🚨🚨🚨 EVENT EMITTED SUCCESSFULLY 🚨🚨🚨`
                          );
                        } else {
                          console.log(
                            `✅ No differences found - current response matches existing mock`
                          );
                        }
                      } else if (!matchingMock) {
                        console.log(
                          `🔍 No existing mock found - this is a new request pattern`
                        );
                      } else if (request.servedFromMock) {
                        console.log(
                          `🔍 Request was served from mock - no backend comparison needed`
                        );
                      }
                    } catch (comparisonError) {
                      console.error(
                        "❌ Error during proxy mock comparison:",
                        comparisonError
                      );
                    }
                  }

                  // Emit response event with updated request and response data
                  this.emit("response", {
                    request,
                    response: request.response,
                  });

                  // Auto-save as mock if enabled
                  if (
                    this.autoSaveAsMocks &&
                    targetRes.statusCode >= 200 &&
                    targetRes.statusCode < 400
                  ) {
                    // Create auto-mock from successful responses
                    const mockKey = `${request.method}:${request.url}`;
                    if (!this.mocks.has(mockKey)) {
                      let parsedBody;
                      try {
                        parsedBody = JSON.parse(responseBody);
                      } catch {
                        parsedBody = responseBody;
                      }

                      const autoMock = {
                        id: `auto-${Date.now()}-${Math.random()
                          .toString(36)
                          .substr(2, 9)}`,
                        url: request.url,
                        method: request.method,
                        statusCode: targetRes.statusCode,
                        headers: { ...targetRes.headers },
                        body: responseBody,
                        enabled: false, // Auto-saved mocks are disabled by default
                        autoGenerated: true,
                        response: parsedBody, // Store parsed response for test expectations
                        createdAt: new Date().toISOString(),
                      };

                      this.mocks.set(mockKey, autoMock);
                      // Maintain legacy event for any existing listeners
                      this.emit("mock-created", autoMock);
                      // New standardized auto-created event payload aligns with main process expectations
                      this.emit("mock-auto-created", {
                        mock: autoMock,
                        request,
                      });
                    }
                  }
                } catch (endError) {
                  console.error(`❌ Target response end error:`, endError);
                  request.status = "failed";
                  request.error = endError.message;
                  this.stats.totalRequests++;
                  this.stats.failedRequests++;
                  this.emit("response", { request, response: null });
                }
              });

              targetRes.on("error", (error) => {
                console.error(`❌ Target response error:`, error);
                if (!res.headersSent) {
                  res.writeHead(502, { "Content-Type": "text/plain" });
                  res.end("Bad Gateway: Target server error");
                }

                request.status = "failed";
                request.error = error.message;
                this.stats.totalRequests++;
                this.stats.failedRequests++;
                this.emit("response", { request, response: null });
              });
            } catch (responseError) {
              console.error(`❌ Response handling error:`, responseError);
              if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error - Response");
              }
              request.status = "failed";
              request.error = responseError.message;
              this.stats.totalRequests++;
              this.stats.failedRequests++;
              this.emit("response", { request, response: null });
            }
          });

          targetReq.on("error", (error) => {
            console.error(`❌ Target request error:`, error);
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/plain" });
              res.end("Bad Gateway: Cannot connect to target server");
            }

            request.status = "failed";
            request.error = error.message;
            this.stats.totalRequests++;
            this.stats.failedRequests++;
            this.emit("response", { request, response: null });
          });

          // Send request body to target
          if (body) {
            targetReq.write(body);
          }
          targetReq.end();
        } catch (requestError) {
          console.error(`❌ Request processing error:`, requestError);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error - Request");
          }
          request.status = "failed";
          request.error = requestError.message;
          this.stats.totalRequests++;
          this.stats.failedRequests++;
          this.emit("response", { request, response: null });
        }
      });

      req.on("error", (error) => {
        console.error(`❌ Client request error:`, error);
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request");
        }

        request.status = "failed";
        request.error = error.message;
        this.stats.totalRequests++;
        this.stats.failedRequests++;
        this.emit("response", { request, response: null });
      });
    } catch (error) {
      console.error(`❌ Proxy error:`, error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log(`🛑 Proxy server stopped on port ${this.port}`);
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }

      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    });
  }

  // Helper methods that were in the original file
  trimRequestHistory() {
    if (this.requests.length > this.maxRequestHistory) {
      // Keep the most recent requests by removing from the beginning
      this.requests = this.requests.slice(-this.maxRequestHistory);
    }
  }

  cleanupStalePendingRequests() {
    const now = Date.now();
    const staleBefore = now - this.stalePendingTimeout;

    this.requests.forEach((request) => {
      if (request.status === "pending" && request.startTime < staleBefore) {
        request.status = "failed";
        request.error = "Request timed out";
        this.stats.failedRequests++;
      }
    });
  }

  createMockFromRequest(request) {
    if (!request.response) return;

    const mockKey = `${request.method}:${request.url}`;
    const mock = {
      id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: request.url,
      method: request.method,
      statusCode: request.response.statusCode,
      headers: { ...request.response.headers },
      body: request.response.body,
      enabled: false, // Start disabled
      createdAt: new Date().toISOString(),
      fromRequest: request.id,
    };

    this.mocks.set(mockKey, mock);
    this.emit("mock-created", mock);
  }

  // Mock management methods
  createMock(mockData) {
    const mock = {
      id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: mockData.url,
      method: mockData.method,
      statusCode: mockData.statusCode || 200,
      headers: mockData.headers || {},
      body: mockData.body || "",
      enabled: mockData.enabled !== undefined ? mockData.enabled : true,
      createdAt: new Date().toISOString(),
    };

    const mockKey = `${mock.method}:${mock.url}`;
    this.mocks.set(mockKey, mock);
    this.emit("mock-created", mock);
    return mock;
  }

  getMocks() {
    return Array.from(this.mocks.values());
  }

  importMocks(mockData) {
    // Handle both direct array and export object format
    let mocks;
    if (Array.isArray(mockData)) {
      mocks = mockData;
    } else if (mockData && Array.isArray(mockData.mocks)) {
      mocks = mockData.mocks;
    } else {
      return;
    }

    for (const mockDef of mocks) {
      // Preserve the enabled state from the imported mock
      const mock = {
        id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: mockDef.url,
        method: mockDef.method,
        statusCode: mockDef.statusCode || 200,
        headers: mockDef.headers || {},
        body: mockDef.body || "",
        enabled: mockDef.enabled !== undefined ? mockDef.enabled : true,
        createdAt: mockDef.createdAt || new Date().toISOString(),
      };

      const mockKey = `${mock.method}:${mock.url}`;
      this.mocks.set(mockKey, mock);
      this.emit("mock-created", mock);
    }

    console.log(`📦 Imported ${mocks.length} mocks for proxy ${this.name}`);
  }

  enableMock(mockId) {
    for (const mock of this.mocks.values()) {
      if (mock.id === mockId) {
        mock.enabled = true;
        this.emit("mock-updated", mock);
        return mock;
      }
    }
    return null;
  }

  disableMock(mockId) {
    for (const mock of this.mocks.values()) {
      if (mock.id === mockId) {
        mock.enabled = false;
        this.emit("mock-updated", mock);
        return mock;
      }
    }
    return null;
  }

  deleteMock(mockId) {
    for (const [key, mock] of this.mocks.entries()) {
      if (mock.id === mockId) {
        this.mocks.delete(key);
        this.emit("mock-deleted", mock);
        return mock;
      }
    }
    return null;
  }

  // Add toggle method expected by tests (by ID)
  toggleMockById(mockId) {
    for (const mock of this.mocks.values()) {
      if (mock.id === mockId) {
        mock.enabled = !mock.enabled;
        this.emit("mock-updated", mock);
        return mock;
      }
    }
    return null;
  }

  // Add addMock method that is expected by tests
  addMock(method, url, response, options = {}) {
    // Handle both 3-parameter and 4-parameter signatures
    let body, statusCode, headers;

    if (arguments.length === 4) {
      // 4-parameter signature: (method, url, responseBody, options)
      body = typeof response === "object" ? JSON.stringify(response) : response;
      statusCode = options.status || 200;
      headers = { ...options.headers } || {};

      // Set content-type for JSON responses
      if (typeof response === "object" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    } else if (
      typeof response === "object" &&
      response !== null &&
      !response.body
    ) {
      // 3-parameter signature with data object as response
      body = JSON.stringify(response);
      statusCode = 200;
      headers = { "Content-Type": "application/json" };
    } else {
      // 3-parameter signature with standard response format
      body =
        typeof response.body === "object"
          ? JSON.stringify(response.body)
          : response.body || "";
      statusCode = response.statusCode || 200;
      headers = response.headers || {};

      // Set content-type for JSON responses
      if (typeof response.body === "object" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const mock = {
      id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: url,
      method: method,
      statusCode: statusCode,
      headers: headers,
      body: body,
      enabled: true,
      delay: options.delay || 0, // Support for delayed responses
      createdAt: new Date().toISOString(),
    };

    const mockKey = `${method}:${url}`;
    this.mocks.set(mockKey, mock);
    this.emit("mock-created", mock);
    return mock;
  }

  // Add removeMock method that is expected by tests
  removeMock(method, url) {
    const mockKey = `${method}:${url}`;
    const mock = this.mocks.get(mockKey);
    if (mock) {
      this.mocks.delete(mockKey);
      this.emit("mock-deleted", mock);
      return mock;
    }
    return null;
  }

  // Add toggleMock method with method and URL parameters
  toggleMock(method, url) {
    const mockKey = `${method}:${url}`;
    const mock = this.mocks.get(mockKey);
    if (mock) {
      mock.enabled = !mock.enabled;
      this.emit("mock-updated", mock);
      return mock;
    }
    return null;
  }

  getRequests() {
    // Return copy sorted by timestamp/startTime in ascending order (oldest first)
    // Integration tests expect chronological ordering from earliest to latest
    return [...this.requests].sort((a, b) => {
      const timeA = a.startTime || new Date(a.timestamp).getTime();
      const timeB = b.startTime || new Date(b.timestamp).getTime();
      return timeA - timeB; // Ascending order (oldest first)
    });
  }

  // Add addRequest method for testing
  addRequest(requestData) {
    const request = {
      id:
        requestData.id ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: requestData.timestamp || new Date().toISOString(),
      method: requestData.method || "GET",
      url: requestData.url || "/",
      headers: requestData.headers || {},
      body: requestData.body || null,
      startTime: requestData.startTime || Date.now(),
      proxyPort: this.port,
      status: requestData.status || "pending",
      response: requestData.response || null,
      ...requestData,
    };

    this.requests.push(request);
    this.trimRequestHistory();

    // Update stats based on request status
    if (request.status === "completed" || request.status === "success") {
      this.stats.totalRequests++;
      if (
        request.response &&
        request.response.statusCode >= 200 &&
        request.response.statusCode < 300
      ) {
        this.stats.successfulRequests++;
      } else if (!request.response) {
        // For success status without response details
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
      }
    } else if (request.status === "failed") {
      this.stats.totalRequests++;
      this.stats.failedRequests++;
    }

    this.emit("request", request);
    return request;
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

  // Mock management methods
  getMocks() {
    return Array.from(this.mocks.values());
  }

  clearMocks() {
    this.mocks.clear();
    this.emit("mocks-cleared");
  }

  // Export/Import functionality
  exportMocks() {
    return {
      mocks: this.getMocks(),
      exportDate: new Date().toISOString(),
      proxyPort: this.port,
    };
  }

  // Data export methods
  exportData() {
    return {
      config: {
        port: this.port,
        targetHost: this.targetHost,
        targetPort: this.targetPort,
        name: this.name,
      },
      requests: this.getRequests(), // Use getRequests() to ensure chronological ordering
      mocks: Array.from(this.mocks.values()),
      stats: this.stats,
      timestamp: new Date().toISOString(),
    };
  }

  compressData() {
    // Simple compression - in real app, would use actual compression library
    const data = this.exportData();
    return {
      compressed: true,
      size: JSON.stringify(data).length,
      data: data, // In real implementation, this would be compressed
    };
  }

  // Enhanced stats with totalMocks
  getStats() {
    return {
      ...this.stats,
      totalMocks: this.mocks.size,
    };
  }

  // Update settings method - needed for settings save functionality
  updateSettings(settings) {
    try {
      if (settings.hasOwnProperty("maxRequestHistory")) {
        this.maxRequestHistory = settings.maxRequestHistory;
        this.trimRequestHistory();
      }

      if (settings.hasOwnProperty("maxMockHistory")) {
        this.maxMockHistory = settings.maxMockHistory;
        this.trimMockHistory();
      }

      if (settings.hasOwnProperty("autoSaveAsMocks")) {
        this.autoSaveAsMocks = settings.autoSaveAsMocks;
      }

      if (settings.hasOwnProperty("autoReplaceMocksOnDifference")) {
        this.autoReplaceMocksOnDifference =
          settings.autoReplaceMocksOnDifference;
      }

      if (settings.hasOwnProperty("enablePatternMatching")) {
        this.enablePatternMatching = settings.enablePatternMatching;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Trim mock history to stay within limits
  trimMockHistory() {
    if (this.mocks.size > this.maxMockHistory) {
      const mocksArray = Array.from(this.mocks.entries());
      const excess = this.mocks.size - this.maxMockHistory;

      // Remove oldest mocks (simple approach - in production might want more sophisticated logic)
      for (let i = 0; i < excess; i++) {
        this.mocks.delete(mocksArray[i][0]);
      }
    }
  }

  findMatchingMock(method, path) {
    const mockKey = `${method}:${path}`;
    const exactMatch = this.mocks.get(mockKey);
    if (exactMatch && exactMatch.enabled) {
      return exactMatch;
    }

    // Try pattern matching if enabled
    if (this.enablePatternMatching) {
      for (const [key, mock] of this.mocks.entries()) {
        if (mock.enabled && mock.method === method) {
          // Handle wildcard patterns with *
          if (mock.url.includes("*")) {
            const regexPattern = mock.url
              .replace(/\*/g, "([^/]+)")
              .replace(/\//g, "\\/");
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(path)) {
              return mock;
            }
          }

          // Simple pattern matching for IDs and UUIDs
          const pattern = mock.url
            .replace(/\/\d+/g, "/{id}")
            .replace(/\/[a-f0-9-]{36}/gi, "/{uuid}");
          const pathPattern = path
            .replace(/\/\d+/g, "/{id}")
            .replace(/\/[a-f0-9-]{36}/gi, "/{uuid}");
          if (pattern === pathPattern) {
            return mock;
          }
        }
      }
    }
    return null;
  }
}

module.exports = SnifflerProxy;
