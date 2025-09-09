// Unit tests for the main proxy functionality
const path = require("path");

// Mock electron before importing modules
jest.mock("electron");

const SnifflerProxy = require("../../apps/main/proxy");

describe("SnifflerProxy Unit Tests", () => {
  let proxy;
  const testPort = 9001;
  const targetPort = 9002;

  beforeEach(() => {
    proxy = new SnifflerProxy({
      port: testPort,
      targetHost: "localhost",
      targetPort: targetPort,
      name: "Test Proxy",
      maxRequestHistory: 10,
      maxMockHistory: 10,
    });
  });

  afterEach(async () => {
    if (proxy && proxy.isRunning) {
      await proxy.stop().catch(() => {});
    }
    if (proxy && proxy.cleanupInterval) {
      clearInterval(proxy.cleanupInterval);
    }
  });

  describe("Proxy Configuration", () => {
    test("should initialize with correct default values", () => {
      const defaultProxy = new SnifflerProxy();

      expect(defaultProxy.port).toBe(8080);
      expect(defaultProxy.targetHost).toBe("localhost");
      expect(defaultProxy.targetPort).toBe(3000);
      expect(defaultProxy.name).toBe("Proxy 8080");
      expect(defaultProxy.isRunning).toBe(false);
      expect(defaultProxy.requests).toEqual([]);
      expect(defaultProxy.mocks).toBeInstanceOf(Map);
      expect(defaultProxy.maxRequestHistory).toBe(100);

      // Cleanup
      if (defaultProxy.cleanupInterval) {
        clearInterval(defaultProxy.cleanupInterval);
      }
    });

    test("should initialize with custom configuration", () => {
      expect(proxy.port).toBe(testPort);
      expect(proxy.targetHost).toBe("localhost");
      expect(proxy.targetPort).toBe(targetPort);
      expect(proxy.name).toBe("Test Proxy");
      expect(proxy.maxRequestHistory).toBe(10);
      expect(proxy.maxMockHistory).toBe(10);
    });

    test("should prevent circular proxy configuration", async () => {
      const circularProxy = new SnifflerProxy({
        port: 9003,
        targetHost: "localhost",
        targetPort: 9003, // Same as proxy port
      });

      await expect(circularProxy.start()).rejects.toThrow(
        "Cannot proxy port 9003 to itself"
      );

      // Cleanup
      if (circularProxy.cleanupInterval) {
        clearInterval(circularProxy.cleanupInterval);
      }
    });
  });

  describe("Target Connection Testing", () => {
    test("should detect unreachable target server", async () => {
      const result = await proxy.testTargetConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain("No service is running on");
      expect(result.errorType).toBe("SERVICE_NOT_RUNNING");
    });

    test("should handle host not found", async () => {
      const invalidHostProxy = new SnifflerProxy({
        port: 9004,
        targetHost: "invalid-host-name",
        targetPort: 80,
      });

      const result = await invalidHostProxy.testTargetConnection();

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("HOST_NOT_FOUND");

      // Cleanup
      if (invalidHostProxy.cleanupInterval) {
        clearInterval(invalidHostProxy.cleanupInterval);
      }
    });

    test("should handle connection timeout", async () => {
      // Use a non-routable IP to simulate timeout
      const timeoutProxy = new SnifflerProxy({
        port: 9005,
        targetHost: "10.255.255.1",
        targetPort: 80,
      });

      const result = await timeoutProxy.testTargetConnection();

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("TIMEOUT");

      // Cleanup
      if (timeoutProxy.cleanupInterval) {
        clearInterval(timeoutProxy.cleanupInterval);
      }
    }, 10000);
  });

  describe("Mock Management", () => {
    test("should add a mock", () => {
      const mockResponse = { body: "Hello World", statusCode: 200 };
      const mock = proxy.addMock("GET", "/test", mockResponse);

      expect(mock.method).toBe("GET");
      expect(mock.url).toBe("/test");
      expect(mock.body).toBe("Hello World");
      expect(mock.statusCode).toBe(200);
      expect(mock.enabled).toBe(true);
      expect(proxy.mocks.size).toBe(1);
    });

    test("should remove a mock", () => {
      proxy.addMock("GET", "/test", { body: "Hello", statusCode: 200 });
      expect(proxy.mocks.size).toBe(1);

      const removed = proxy.removeMock("GET", "/test");
      expect(removed).toBeTruthy();
      expect(proxy.mocks.size).toBe(0);
    });

    test("should not remove non-existent mock", () => {
      const removed = proxy.removeMock("GET", "/nonexistent");
      expect(removed).toBeNull();
    });

    test("should toggle mock enabled state", () => {
      proxy.addMock("GET", "/test", { body: "Hello", statusCode: 200 });

      const toggledMock = proxy.toggleMock("GET", "/test");
      expect(toggledMock.enabled).toBe(false);

      const toggledAgain = proxy.toggleMock("GET", "/test");
      expect(toggledAgain.enabled).toBe(true);
    });

    test("should get all mocks", () => {
      proxy.addMock("GET", "/test1", { body: "data1", statusCode: 200 });
      proxy.addMock("POST", "/test2", { body: "data2", statusCode: 201 });

      const mocks = proxy.getMocks();
      expect(mocks).toHaveLength(2);
      expect(mocks[0].url).toBe("/test1");
      expect(mocks[1].url).toBe("/test2");
    });

    test("should clear all mocks", () => {
      proxy.addMock("GET", "/test1", { body: "data1", statusCode: 200 });
      proxy.addMock("POST", "/test2", { body: "data2", statusCode: 201 });
      expect(proxy.mocks.size).toBe(2);

      proxy.mocks.clear();
      expect(proxy.mocks.size).toBe(0);
    });

    test("should respect max mock history limit", () => {
      // Set a very small limit
      proxy.maxMockHistory = 2;

      proxy.addMock("GET", "/test1", { body: "data1", statusCode: 200 });
      proxy.addMock("GET", "/test2", { body: "data2", statusCode: 200 });
      proxy.addMock("GET", "/test3", { body: "data3", statusCode: 200 });

      // Manually trigger trimming since the proxy doesn't auto-trim mocks
      proxy.trimMockHistory();

      const mocks = proxy.getMocks();
      expect(mocks.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Request History Management", () => {
    test("should clear requests", () => {
      // Manually add some requests for testing
      proxy.requests = [
        { id: 1, method: "GET", url: "/test1" },
        { id: 2, method: "POST", url: "/test2" },
      ];

      proxy.clearRequests();
      expect(proxy.requests).toHaveLength(0);
    });

    test("should get requests", () => {
      const testRequests = [
        { id: 1, method: "GET", url: "/test1" },
        { id: 2, method: "POST", url: "/test2" },
      ];
      proxy.requests = testRequests;

      const requests = proxy.getRequests();
      expect(requests).toEqual(testRequests);
    });
  });

  describe("Statistics", () => {
    test("should initialize with zero stats", () => {
      expect(proxy.stats.totalRequests).toBe(0);
      expect(proxy.stats.successfulRequests).toBe(0);
      expect(proxy.stats.failedRequests).toBe(0);
      expect(proxy.stats.mocksServed).toBe(0);
    });

    test("should provide stats through getStats method", () => {
      const stats = proxy.getStats();
      expect(stats).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        mocksServed: 0,
        totalMocks: 0,
      });
    });
  });

  describe("Mock Import/Export", () => {
    test("should export data", () => {
      proxy.addMock("GET", "/test1", { body: "data1", statusCode: 200 });
      proxy.addMock("POST", "/test2", { body: "data2", statusCode: 201 });

      const exported = proxy.exportData();
      expect(exported.mocks).toHaveLength(2);
      expect(exported.config).toBeDefined();
      expect(exported.timestamp).toBeDefined();
    });

    test("should import mocks", () => {
      const importData = [
        {
          method: "GET",
          url: "/imported1",
          body: "imported1",
          statusCode: 200,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        {
          method: "POST",
          url: "/imported2",
          body: "imported2",
          statusCode: 201,
          enabled: false,
          createdAt: new Date().toISOString(),
        },
      ];

      proxy.importMocks(importData);

      const mocks = proxy.getMocks();
      expect(mocks).toHaveLength(2);
      expect(mocks[0].url).toBe("/imported1");
      expect(mocks[0].enabled).toBe(true);
      expect(mocks[1].url).toBe("/imported2");
      expect(mocks[1].enabled).toBe(false);
    });

    test("should handle invalid import data", () => {
      // Should not throw, just handle gracefully
      expect(() => {
        proxy.importMocks({ invalid: "data" });
      }).not.toThrow();

      expect(() => {
        proxy.importMocks({});
      }).not.toThrow();
    });
  });

  describe("Event Emission", () => {
    test("should be an EventEmitter", () => {
      expect(proxy.on).toBeDefined();
      expect(proxy.emit).toBeDefined();
      expect(proxy.removeListener).toBeDefined();
    });

    test("should emit events when mocks are added", (done) => {
      proxy.on("mock-created", (mock) => {
        expect(mock.method).toBe("GET");
        expect(mock.url).toBe("/test");
        done();
      });

      proxy.addMock("GET", "/test", { body: "test", statusCode: 200 });
    });
  });

  describe("Testing Mode", () => {
    test("should toggle testing mode", () => {
      expect(proxy.testingMode).toBe(false);

      proxy.testingMode = true;
      expect(proxy.testingMode).toBe(true);

      proxy.testingMode = false;
      expect(proxy.testingMode).toBe(false);
    });
  });

  // Regression test for the UI event emission bug
  describe("Event Emission Timing Regression Tests", () => {
    test("should emit request event immediately when request starts (Bug #001 regression test)", () => {
      // This test specifically prevents regression of the bug where requests
      // were not showing up in UI because events were only emitted after completion

      const events = [];

      proxy.on("request", (request) => {
        events.push({
          type: "request",
          status: request.status,
          timestamp: Date.now(),
        });
      });

      proxy.on("response", (data) => {
        events.push({
          type: "response",
          status: data.request.status,
          timestamp: Date.now(),
        });
      });

      // Simulate a request being processed
      const mockReq = {
        method: "GET",
        url: "/test",
        headers: { host: "localhost" },
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      const startTime = Date.now();

      // Call handleRequest directly to test event timing
      proxy.handleRequest(mockReq, mockRes);

      // Request event should be emitted immediately
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("request");
      expect(events[0].status).toBe("pending");

      // Verify it was emitted quickly (within 10ms)
      const eventDelay = events[0].timestamp - startTime;
      expect(eventDelay).toBeLessThan(10);

      // Verify request is in history with pending status
      const requests = proxy.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].status).toBe("pending");
    });

    test("should emit separate events for request start and completion", () => {
      const events = [];

      proxy.on("request", (request) => {
        events.push({
          type: "request",
          status: request.status,
          id: request.id,
        });
      });

      proxy.on("response", (data) => {
        events.push({
          type: "response",
          status: data.request.status,
          id: data.request.id,
        });
      });

      // Create a mock for a successful request/response cycle
      const mockRequest = {
        method: "POST",
        url: "/api/test",
        headers: { "content-type": "application/json" },
      };

      const mockResponse = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };

      // Add a mock to serve instead of making real request
      proxy.addMock("POST", "/api/test", {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true }),
      });

      // Enable the mock
      const mock = proxy.findMatchingMock("POST", "/api/test");
      mock.enabled = true;

      // Process the request
      proxy.handleRequest(mockRequest, mockResponse);

      // Should have both request and response events
      expect(events).toHaveLength(2);

      // First event should be request with pending status
      expect(events[0].type).toBe("request");
      expect(events[0].status).toBe("pending");

      // Second event should be response with completed status
      expect(events[1].type).toBe("response");
      expect(events[1].status).toBe("completed");

      // Both events should reference the same request
      expect(events[0].id).toBe(events[1].id);
    });

    test("should maintain event emission order under load", () => {
      const events = [];

      proxy.on("request", (request) => {
        events.push({ type: "request", id: request.id, url: request.url });
      });

      proxy.on("response", (data) => {
        events.push({
          type: "response",
          id: data.request.id,
          url: data.request.url,
        });
      });

      // Simulate multiple concurrent requests
      const numRequests = 10;
      const requestIds = [];

      for (let i = 0; i < numRequests; i++) {
        const mockReq = {
          method: "GET",
          url: `/test-${i}`,
          headers: { host: "localhost" },
        };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn(),
        };

        proxy.handleRequest(mockReq, mockRes);
      }

      // Should have request events for all requests
      const requestEvents = events.filter((e) => e.type === "request");
      expect(requestEvents).toHaveLength(numRequests);

      // All request events should be emitted immediately
      requestEvents.forEach((event) => {
        expect(event.type).toBe("request");
      });

      // Verify all requests are in history
      const requests = proxy.getRequests();
      expect(requests).toHaveLength(numRequests);
    });
  });
});
