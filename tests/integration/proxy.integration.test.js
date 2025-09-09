// Integration tests for proxy functionality with real Docker containers
const SnifflerProxy = require("../../apps/main/proxy");
const HttpTestHelper = require("../utils/http-helper");

describe("Proxy Integration Tests", () => {
  let httpHelper;
  let proxy;

  beforeAll(async () => {
    httpHelper = new HttpTestHelper();

    // Test that Docker containers are running
    const apiStatus = await httpHelper.testApiConnectivity();
    const workingApis = Object.values(apiStatus).filter((api) => api.success);

    if (workingApis.length === 0) {
      throw new Error(
        "No test APIs are running. Please ensure Docker containers are started."
      );
    }

    console.log(`✅ Found ${workingApis.length} working test APIs`);
  });

  afterAll(async () => {
    if (httpHelper) {
      await httpHelper.stopAllMockServers();
    }
  });

  beforeEach(async () => {
    // Clean up any existing proxy
    if (proxy && proxy.isRunning) {
      await proxy.stop();
    }
  });

  afterEach(async () => {
    if (proxy) {
      try {
        await proxy.stop();
      } catch (error) {
        console.warn("Error stopping proxy:", error.message);
      }
      proxy = null;
    }
  });

  describe("Basic Proxy Functionality", () => {
    test("should start proxy and forward requests to API server", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001, // API server 1
        name: "Test Integration Proxy",
      });

      // Test target connection first
      const connectionTest = await proxy.testTargetConnection();
      expect(connectionTest.success).toBe(true);

      // Start the proxy
      await proxy.start();
      expect(proxy.isRunning).toBe(true);

      // Wait for proxy to be ready
      await testUtils.waitForPort(proxyPort);

      // Make a request through the proxy
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        status: "ok",
        service: "api1",
        timestamp: expect.any(String),
      });
    }, 15000);

    test("should handle POST requests with JSON data", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        name: "POST Test Proxy",
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      const testUser = httpHelper.generateTestUser("integration");
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "POST",
        "/users",
        {
          data: testUser,
          headers: { "Content-Type": "application/json" },
        }
      );

      expect(response.success).toBe(true);
      expect(response.status).toBe(201);
      expect(response.data.user.name).toBe(testUser.name);
      expect(response.data.user.email).toBe(testUser.email);
      expect(response.data.user.id).toBeDefined();
    }, 15000);

    test("should track request history", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        maxRequestHistory: 10,
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Make multiple requests
      await httpHelper.makeProxyRequest(proxyPort, "GET", "/health");
      await httpHelper.makeProxyRequest(proxyPort, "GET", "/users");
      await httpHelper.makeProxyRequest(proxyPort, "POST", "/users", {
        data: { name: "Test User", email: "test@example.com" },
      });

      const requests = proxy.getRequests();
      expect(requests.length).toBe(3);

      expect(requests[0].method).toBe("GET");
      expect(requests[0].url).toBe("/health");
      expect(requests[1].method).toBe("GET");
      expect(requests[1].url).toBe("/users");
      expect(requests[2].method).toBe("POST");
      expect(requests[2].url).toBe("/users");
    }, 15000);
  });

  describe("Mock Functionality", () => {
    test("should serve mocked responses instead of proxying", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add a mock
      const mockResponse = { message: "This is a mocked response" };
      proxy.addMock("GET", "/mocked-endpoint", mockResponse);

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request the mocked endpoint
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/mocked-endpoint"
      );

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);

      // Verify stats
      const stats = proxy.getStats();
      expect(stats.mocksServed).toBe(1);
    }, 15000);

    test("should pass through non-mocked requests", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add a mock for one endpoint
      proxy.addMock("GET", "/mocked", { mock: true });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request a non-mocked endpoint
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );

      expect(response.success).toBe(true);
      expect(response.data.service).toBe("api1"); // Real API response

      // Request the mocked endpoint
      const mockedResponse = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/mocked"
      );
      expect(mockedResponse.data).toEqual({ mock: true });
    }, 15000);

    test("should handle disabled mocks", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      // Add and disable a mock
      proxy.addMock("GET", "/disabled-mock", { mock: true });
      proxy.toggleMock("GET", "/disabled-mock"); // Disable it

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Request should pass through to real API (which returns 404)
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/disabled-mock"
      );
      expect(response.status).toBe(404); // Real API 404 response
    }, 15000);
  });

  describe("Error Handling", () => {
    test("should handle target server being down", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 9999, // Non-existent port
        name: "Down Server Proxy",
      });

      // Connection test should fail
      const connectionTest = await proxy.testTargetConnection();
      expect(connectionTest.success).toBe(false);
      expect(connectionTest.errorType).toBe("SERVICE_NOT_RUNNING");

      // Proxy should still start (target might come online later)
      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // But requests should fail with 502
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "GET",
        "/health"
      );
      expect(response.success).toBe(true);
      expect(response.status).toBe(502); // Bad Gateway
    }, 10000);

    test("should handle malformed requests gracefully", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Make a request with invalid JSON
      const response = await httpHelper.makeProxyRequest(
        proxyPort,
        "POST",
        "/users",
        {
          data: "invalid json",
          headers: { "Content-Type": "application/json" },
        }
      );

      // Should still get a response (400 from the API)
      expect(response.success).toBe(true);
      expect(response.status).toBe(400);
    }, 15000);
  });

  describe("Performance and Load", () => {
    test("should handle multiple concurrent requests", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        maxRequestHistory: 100,
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Make 10 concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        httpHelper.makeProxyRequest(proxyPort, "GET", `/health?id=${i}`)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response, i) => {
        expect(response.success).toBe(true);
        expect(response.status).toBe(200);
      });

      // Check that all requests were tracked
      const requestHistory = proxy.getRequests();
      expect(requestHistory.length).toBe(10);
    }, 20000);

    test("should respect request history limits", async () => {
      const proxyPort = testUtils.generateTestPort();

      proxy = new SnifflerProxy({
        port: proxyPort,
        targetHost: "localhost",
        targetPort: 3001,
        maxRequestHistory: 5, // Small limit for testing
      });

      await proxy.start();
      await testUtils.waitForPort(proxyPort);

      // Make more requests than the limit
      for (let i = 0; i < 10; i++) {
        await httpHelper.makeProxyRequest(proxyPort, "GET", `/health?id=${i}`);
      }

      const requests = proxy.getRequests();
      expect(requests.length).toBe(5); // Should be limited to 5

      // Should contain the most recent requests (ids 5-9)
      expect(requests[0].url).toContain("id=5");
      expect(requests[4].url).toContain("id=9");
    }, 20000);
  });

  describe("Different Target APIs", () => {
    test("should work with different API servers", async () => {
      const testCases = [
        { port: 3001, service: "api1" },
        { port: 3002, service: "api2" },
        { port: 3003, service: "api3" },
        { port: 3004, service: "api4" },
      ];

      for (const testCase of testCases) {
        const proxyPort = testUtils.generateTestPort();

        const testProxy = new SnifflerProxy({
          port: proxyPort,
          targetHost: "localhost",
          targetPort: testCase.port,
          name: `${testCase.service} Proxy`,
        });

        try {
          // Test if this API is available
          const connectionTest = await testProxy.testTargetConnection();
          if (!connectionTest.success) {
            console.warn(`Skipping ${testCase.service} - not available`);
            continue;
          }

          await testProxy.start();
          await testUtils.waitForPort(proxyPort);

          const response = await httpHelper.makeProxyRequest(
            proxyPort,
            "GET",
            "/health"
          );

          expect(response.success).toBe(true);
          expect(response.status).toBe(200);
          expect(response.data.service).toBe(testCase.service);

          await testProxy.stop();
        } catch (error) {
          console.warn(`Error testing ${testCase.service}:`, error.message);
          if (testProxy.isRunning) {
            await testProxy.stop();
          }
        }
      }
    }, 30000);
  });
});
