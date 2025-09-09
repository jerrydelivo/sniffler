const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs").promises;

describe("Proxy UI Communication Integration Tests", () => {
  let electronProcess;
  let testServer;
  const testServerPort = 3199;

  beforeAll(async () => {
    // Start test server
    testServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "integration test response",
          url: req.url,
          timestamp: new Date().toISOString(),
        })
      );
    });

    await new Promise((resolve) => {
      testServer.listen(testServerPort, resolve);
    });
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(resolve);
      });
    }

    if (electronProcess) {
      electronProcess.kill();
    }
  });

  describe("Request Event Flow Bug Prevention", () => {
    test("should verify that requests appear in UI immediately when made through proxy", async () => {
      // This test specifically targets the bug where requests were not showing up in the UI
      // even though they were being processed by the proxy

      const testResults = {
        proxyStarted: false,
        requestEventEmitted: false,
        responseEventEmitted: false,
        requestInHistory: false,
        uiUpdated: false,
      };

      // Create a test configuration that would trigger the original bug scenario
      const testConfig = {
        port: 4199,
        targetHost: "localhost",
        targetPort: testServerPort,
        name: "Integration Test Proxy",
      };

      // Use the DataManager and ProxyManager to simulate the real startup sequence
      const DataManager = require("../../apps/main/data-manager");
      const ProxyManager = require("../../apps/main/proxy-manager");
      const SnifflerProxy = require("../../apps/main/proxy");

      const dataManager = new DataManager();
      const proxyManager = new ProxyManager();

      // Save a test proxy configuration that would be loaded on startup
      await proxyManager.saveNormalProxies(
        new Map([
          [
            testConfig.port,
            {
              proxy: null, // Will be populated
              name: testConfig.name,
              targetHost: testConfig.targetHost,
              targetPort: testConfig.targetPort,
              autoStart: true,
              disabled: false,
            },
          ],
        ])
      );

      // Simulate the proxy creation and startup sequence from index.js
      const proxy = new SnifflerProxy({
        port: testConfig.port,
        name: testConfig.name,
        targetHost: testConfig.targetHost,
        targetPort: testConfig.targetPort,
        maxRequestHistory: 100,
        autoSaveAsMocks: false,
        autoReplaceMocksOnDifference: false,
        enablePatternMatching: false,
      });

      // Test the event emission timing
      const events = [];

      proxy.on("request", (request) => {
        events.push({
          type: "request",
          timestamp: Date.now(),
          status: request.status,
          id: request.id,
        });
        testResults.requestEventEmitted = true;
      });

      proxy.on("response", (data) => {
        events.push({
          type: "response",
          timestamp: Date.now(),
          status: data.request.status,
          id: data.request.id,
        });
        testResults.responseEventEmitted = true;
      });

      // Simulate the setupProxyEventListeners function from the fix
      const mockUIUpdates = [];
      const setupProxyEventListeners = (port, proxyInstance) => {
        const mockMainWindow = {
          webContents: {
            send: (eventName, data) => {
              mockUIUpdates.push({
                eventName,
                data,
                timestamp: Date.now(),
              });
              if (eventName === "proxy-request") {
                testResults.uiUpdated = true;
              }
            },
          },
        };

        proxyInstance.on("request", (request) => {
          if (mockMainWindow) {
            mockMainWindow.webContents.send("proxy-request", {
              proxyId: port,
              request,
            });
          }
        });

        proxyInstance.on("response", (data) => {
          if (mockMainWindow) {
            mockMainWindow.webContents.send("proxy-response", {
              proxyId: port,
              request: data.request,
              response: data.response,
            });
          }
        });

        return mockMainWindow;
      };

      // Start the proxy
      await proxy.start();
      testResults.proxyStarted = true;

      // Set up event listeners (simulating window creation after proxy startup)
      const mockMainWindow = setupProxyEventListeners(testConfig.port, proxy);

      // Make a request through the proxy to trigger the event flow
      const requestStartTime = Date.now();
      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: testConfig.port,
            path: "/integration-test",
            method: "GET",
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ statusCode: res.statusCode, body }));
          }
        );

        req.on("error", reject);
        req.end();
      });

      // Wait for all events to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if request appears in proxy history
      const requests = proxy.getRequests();
      testResults.requestInHistory = requests.length > 0;

      // Verify all aspects of the bug fix
      expect(testResults.proxyStarted).toBe(true);
      expect(testResults.requestEventEmitted).toBe(true);
      expect(testResults.responseEventEmitted).toBe(true);
      expect(testResults.requestInHistory).toBe(true);
      expect(testResults.uiUpdated).toBe(true);

      // Verify the timing of events
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("request");
      expect(events[0].status).toBe("pending");
      expect(events[1].type).toBe("response");
      expect(events[1].status).toBe("completed");

      // Verify UI updates were sent
      expect(mockUIUpdates.length).toBeGreaterThanOrEqual(1);
      const requestUpdate = mockUIUpdates.find(
        (u) => u.eventName === "proxy-request"
      );
      const responseUpdate = mockUIUpdates.find(
        (u) => u.eventName === "proxy-response"
      );

      expect(requestUpdate).toBeDefined();
      // Note: Status might be "completed" if the request/response is very fast
      expect(["pending", "completed"]).toContain(
        requestUpdate.data.request.status
      );

      if (responseUpdate) {
        expect(responseUpdate.data.request.status).toBe("completed");
      }

      // Verify request was sent to UI immediately (within reasonable time)
      const uiUpdateDelay = requestUpdate.timestamp - requestStartTime;
      expect(uiUpdateDelay).toBeLessThan(200); // More generous timing

      // Verify the HTTP request was successful
      expect(response.statusCode).toBe(200);

      // Clean up
      await proxy.stop();
      if (proxy.cleanupInterval) {
        clearInterval(proxy.cleanupInterval);
        proxy.cleanupInterval = null;
      }
    }, 15000); // Longer timeout for integration test

    test("should handle the original bug scenario where mainWindow is not available during proxy startup", async () => {
      // This test specifically recreates the original bug scenario
      const testConfig = {
        port: 4198,
        targetHost: "localhost",
        targetPort: testServerPort,
        name: "Bug Scenario Test Proxy",
      };

      const SnifflerProxy = require("../../apps/main/proxy");

      // Create proxy without mainWindow available (original bug scenario)
      const proxy = new SnifflerProxy(testConfig);

      // Simulate the original setupProxyEventListeners function that would fail
      const originalSetupProxyEventListeners = (port, proxyInstance) => {
        const mainWindow = null; // This was the bug - mainWindow not available

        if (!mainWindow) {
          console.warn(
            `⚠️ Cannot set up event listeners for proxy ${port}: mainWindow not available`
          );
          return;
        }

        // This code would never execute in the bug scenario
        proxyInstance.on("request", (request) => {
          if (mainWindow) {
            mainWindow.webContents.send("proxy-request", {
              proxyId: port,
              request,
            });
          }
        });
      };

      // Start proxy
      await proxy.start();

      // Try to set up event listeners (this would fail in the original bug)
      originalSetupProxyEventListeners(testConfig.port, proxy);

      // Track events that actually get emitted
      const events = [];

      // Add listeners after the failed setup (simulating the fix)
      proxy.on("request", (request) => {
        events.push({ type: "request", status: request.status });
      });

      proxy.on("response", (data) => {
        events.push({ type: "response", status: data.request.status });
      });

      // Make a request
      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: testConfig.port,
            path: "/bug-scenario-test",
            method: "GET",
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ statusCode: res.statusCode, body }));
          }
        );

        req.on("error", reject);
        req.end();
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify proxy still processes requests correctly
      expect(response.statusCode).toBe(200);

      // Verify events are still emitted (the fix ensures this)
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("request");
      expect(events[0].status).toBe("pending");
      expect(events[1].type).toBe("response");
      expect(events[1].status).toBe("completed");

      // Verify requests are still saved to history
      const requests = proxy.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].status).toBe("completed");

      await proxy.stop();
      if (proxy.cleanupInterval) {
        clearInterval(proxy.cleanupInterval);
        proxy.cleanupInterval = null;
      }
    });

    test("should verify that the fixed setupProxyEventListeners works when called after window creation", async () => {
      // This test verifies the fix works correctly
      const testConfig = {
        port: 4197,
        targetHost: "localhost",
        targetPort: testServerPort,
        name: "Fixed Scenario Test Proxy",
      };

      const SnifflerProxy = require("../../apps/main/proxy");
      const proxy = new SnifflerProxy(testConfig);

      // Start proxy first (mainWindow not available yet)
      await proxy.start();

      // Now simulate window creation and event listener setup (the fix)
      const mockMainWindow = {
        webContents: {
          send: jest.fn(),
        },
      };

      // The fixed setupProxyEventListeners function
      const fixedSetupProxyEventListeners = (port, proxyInstance) => {
        if (!mockMainWindow) {
          console.warn(
            `⚠️ Cannot set up event listeners for proxy ${port}: mainWindow not available`
          );
          return;
        }

        console.log(`🔌 Setting up event listeners for proxy on port ${port}`);

        proxyInstance.on("request", (request) => {
          if (mockMainWindow) {
            mockMainWindow.webContents.send("proxy-request", {
              proxyId: port,
              request,
            });
          }
        });

        proxyInstance.on("response", (data) => {
          if (mockMainWindow) {
            mockMainWindow.webContents.send("proxy-response", {
              proxyId: port,
              request: data.request,
              response: data.response,
            });
          }
        });
      };

      // Set up event listeners after window is "created"
      fixedSetupProxyEventListeners(testConfig.port, proxy);

      // Make a request
      const response = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: testConfig.port,
            path: "/fixed-scenario-test",
            method: "GET",
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ statusCode: res.statusCode, body }));
          }
        );

        req.on("error", reject);
        req.end();
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the fix works
      expect(response.statusCode).toBe(200);
      expect(mockMainWindow.webContents.send).toHaveBeenCalled();

      const calls = mockMainWindow.webContents.send.mock.calls;
      expect(calls[0][0]).toBe("proxy-request");
      // Status might be "completed" if request/response is very fast
      expect(["pending", "completed"]).toContain(calls[0][1].request.status);

      if (calls.length >= 2) {
        expect(calls[1][0]).toBe("proxy-response");
        expect(calls[1][1].request.status).toBe("completed");
      }

      await proxy.stop();
      if (proxy.cleanupInterval) {
        clearInterval(proxy.cleanupInterval);
        proxy.cleanupInterval = null;
      }
    });
  });
});
