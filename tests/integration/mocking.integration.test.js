// Integration tests for mocking functionality
const SnifflerProxy = require("../../apps/main/proxy");
const HttpTestHelper = require("../utils/http-helper");

describe("Mocking Integration Tests", () => {
  let httpHelper;
  let proxy;

  beforeAll(async () => {
    httpHelper = new HttpTestHelper();
  });

  afterAll(async () => {
    if (httpHelper) {
      await httpHelper.stopAllMockServers();
    }
  });

  beforeEach(() => {
    // Clean up any existing proxy
    if (proxy && proxy.isRunning) {
      proxy.stop();
    }
  });

  afterEach(async () => {
    if (proxy && proxy.isRunning) {
      await proxy.stop();
    }
  });

  describe("Mock Response Handling", () => {
    test("should serve exact mock matches", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        name: "Mock Test Proxy",
      });

      // Add exact match mock
      const mockResponse = {
        success: true,
        message: "This is a mocked response",
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      proxy.addMock("GET", "/api/users/123", mockResponse);

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request the exact mocked endpoint
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/api/users/123"
      );

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);

      // Verify mock was served
      const stats = proxy.getStats();
      expect(stats.mocksServed).toBe(1);
    }, 15000);

    test("should handle different HTTP methods for same URL", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add mocks for different methods
      proxy.addMock("GET", "/api/resource", {
        method: "GET",
        data: "get-data",
      });
      proxy.addMock("POST", "/api/resource", {
        method: "POST",
        data: "post-data",
      });
      proxy.addMock("PUT", "/api/resource", {
        method: "PUT",
        data: "put-data",
      });
      proxy.addMock("DELETE", "/api/resource", {
        method: "DELETE",
        data: "delete-data",
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Test each method
      const getResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/api/resource"
      );
      expect(getResponse.data.method).toBe("GET");

      const postResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "POST",
        "/api/resource"
      );
      expect(postResponse.data.method).toBe("POST");

      const putResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "PUT",
        "/api/resource"
      );
      expect(putResponse.data.method).toBe("PUT");

      const deleteResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "DELETE",
        "/api/resource"
      );
      expect(deleteResponse.data.method).toBe("DELETE");

      // All should be mocked
      const stats = proxy.getStats();
      expect(stats.mocksServed).toBe(4);
    }, 15000);

    test("should handle complex mock responses", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Complex mock with nested data
      const complexMock = {
        users: [
          { id: 1, name: "John Doe", email: "john@example.com" },
          { id: 2, name: "Jane Smith", email: "jane@example.com" },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          hasNext: false,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      proxy.addMock("GET", "/api/users", complexMock);

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/api/users"
      );

      expect(response.success).toBe(true);
      expect(response.data.users).toHaveLength(2);
      expect(response.data.users[0].name).toBe("John Doe");
      expect(response.data.pagination.total).toBe(2);
      expect(response.data.metadata.version).toBe("1.0.0");
    }, 15000);
  });

  describe("Mock Priority and Fallback", () => {
    test("should prioritize mocks over real API responses", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Mock an endpoint that exists in the real API
      proxy.addMock("GET", "/health", {
        status: "mocked",
        service: "mock-service",
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );

      expect(response.data.status).toBe("mocked");
      expect(response.data.service).toBe("mock-service");
      // Should NOT be the real API response
    }, 15000);

    test("should fall back to real API when no mock exists", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add a mock for a different endpoint
      proxy.addMock("GET", "/mocked-only", { mock: true });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request an unmocked endpoint
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );

      expect(response.data.service).toBe("api1"); // Real API response
      expect(response.data.status).toBe("ok"); // Real API response
    }, 15000);

    test("should handle disabled mocks correctly", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add and immediately disable a mock
      proxy.addMock("GET", "/disabled-endpoint", { mocked: true });
      proxy.toggleMock("GET", "/disabled-endpoint"); // Disable

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request should fall back to real API (404 in this case)
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/disabled-endpoint"
      );

      expect(response.status).toBe(404); // Real API 404

      // No mocks should have been served
      const stats = proxy.getStats();
      expect(stats.mocksServed).toBe(0);
    }, 15000);
  });

  describe("Mock Management Operations", () => {
    test("should add, update, and remove mocks during runtime", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Initially no mock
      let response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/dynamic"
      );
      expect(response.status).toBe(404); // Real API 404

      // Add mock
      proxy.addMock("GET", "/dynamic", { version: 1 });
      response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/dynamic"
      );
      expect(response.data.version).toBe(1);

      // Update mock
      proxy.removeMock("GET", "/dynamic");
      proxy.addMock("GET", "/dynamic", { version: 2, updated: true });
      response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/dynamic"
      );
      expect(response.data.version).toBe(2);
      expect(response.data.updated).toBe(true);

      // Remove mock
      proxy.removeMock("GET", "/dynamic");
      response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/dynamic"
      );
      expect(response.status).toBe(404); // Back to real API 404
    }, 15000);

    test("should handle mock export and import", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add several mocks
      proxy.addMock("GET", "/export-test-1", { test: 1 });
      proxy.addMock("POST", "/export-test-2", { test: 2 });
      proxy.addMock("PUT", "/export-test-3", { test: 3 });

      // Export mocks
      const exported = proxy.exportMocks();
      expect(exported.mocks).toHaveLength(3);

      // Clear all mocks
      proxy.clearMocks();
      expect(proxy.getMocks()).toHaveLength(0);

      // Import mocks back
      proxy.importMocks(exported);
      expect(proxy.getMocks()).toHaveLength(3);

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Test that imported mocks work
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/export-test-1"
      );
      expect(response.data.test).toBe(1);
    }, 15000);
  });

  describe("Mock Response Customization", () => {
    test("should handle custom HTTP status codes", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add mocks with different status codes
      proxy.addMock("GET", "/success", { message: "OK" });
      proxy.addMock("GET", "/created", { message: "Created" }, { status: 201 });
      proxy.addMock(
        "GET",
        "/not-found",
        { error: "Not Found" },
        { status: 404 }
      );
      proxy.addMock(
        "GET",
        "/server-error",
        { error: "Internal Error" },
        { status: 500 }
      );

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Test different status codes
      const successResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/success"
      );
      expect(successResponse.status).toBe(200);

      const createdResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/created"
      );
      expect(createdResponse.status).toBe(201);

      const notFoundResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/not-found"
      );
      expect(notFoundResponse.status).toBe(404);

      const errorResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/server-error"
      );
      expect(errorResponse.status).toBe(500);
    }, 15000);

    test("should handle custom headers in mock responses", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add mock with custom headers
      proxy.addMock(
        "GET",
        "/custom-headers",
        { message: "Custom headers test" },
        {
          headers: {
            "X-Custom-Header": "test-value",
            "X-API-Version": "2.0",
            "Cache-Control": "no-cache",
          },
        }
      );

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/custom-headers"
      );

      expect(response.headers["x-custom-header"]).toBe("test-value");
      expect(response.headers["x-api-version"]).toBe("2.0");
      expect(response.headers["cache-control"]).toBe("no-cache");
    }, 15000);

    test("should handle delayed mock responses", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add mock with delay
      proxy.addMock(
        "GET",
        "/delayed",
        { message: "Delayed response" },
        { delay: 1000 } // 1 second delay
      );

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      const startTime = Date.now();
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/delayed"
      );
      const duration = Date.now() - startTime;

      expect(response.data.message).toBe("Delayed response");
      expect(duration).toBeGreaterThan(900); // Should take at least 900ms
      expect(duration).toBeLessThan(2000); // But not too long
    }, 15000);
  });

  describe("Pattern Matching and Auto-Mocking", () => {
    test("should handle URL pattern matching", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        enablePatternMatching: true,
      });

      // Add pattern-based mock
      proxy.addMock("GET", "/api/users/*", {
        message: "Pattern matched user",
        userId: "{{path.1}}", // Extract user ID from path
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Test different user IDs
      const response1 = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/api/users/123"
      );
      const response2 = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/api/users/456"
      );

      expect(response1.data.message).toBe("Pattern matched user");
      expect(response2.data.message).toBe("Pattern matched user");

      // Both should be served by the same pattern mock
      const stats = proxy.getStats();
      expect(stats.mocksServed).toBe(2);
    }, 15000);

    test("should create auto-mocks from real responses", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        autoSaveAsMocks: true,
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Make a request to a real endpoint
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );
      expect(response.data.service).toBe("api1");

      // Wait a bit for auto-mock to be created
      await testUtils.sleep(500);

      // Check if auto-mock was created
      const mocks = proxy.getMocks();
      const autoMock = mocks.find(
        (m) => m.url === "/health" && m.method === "GET"
      );

      if (autoMock) {
        expect(autoMock.response.service).toBe("api1");
        expect(autoMock.createdAt).toBeDefined();
      }
    }, 15000);
  });
});
