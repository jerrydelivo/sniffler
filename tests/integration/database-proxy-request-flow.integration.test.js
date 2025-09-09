/**
 * Integration test for database proxy request handling
 * Tests the complete flow from query to UI display
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const net = require("net");

describe("Database Proxy Request Flow Integration", () => {
  let mainProcess;
  let testPort = 15432;
  let targetPort = 15433;
  let mockDatabaseServer;

  // Mock database server that responds to queries
  function createMockDatabaseServer(port) {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        console.log(`Mock DB: Client connected to port ${port}`);

        socket.on("data", (data) => {
          console.log(`Mock DB: Received query:`, data.toString());

          // Simulate database response
          const query = data.toString().trim();
          let response;

          if (query.includes("SELECT 1")) {
            // Successful response
            response = JSON.stringify({
              type: "query_result",
              rows: [{ "?column?": 1 }],
              rowCount: 1,
              isError: false,
            });
          } else if (query.includes("nonexistent")) {
            // Error response
            response = JSON.stringify({
              type: "error",
              isError: true,
              errorInfo: {
                message: "Table 'nonexistent' doesn't exist",
              },
            });
          } else {
            // Default success response
            response = JSON.stringify({
              type: "query_result",
              rows: [{ result: "test" }],
              rowCount: 1,
              isError: false,
            });
          }

          socket.write(response);
        });

        socket.on("error", (err) => {
          console.log(`Mock DB: Socket error:`, err.message);
        });

        socket.on("close", () => {
          console.log(`Mock DB: Client disconnected from port ${port}`);
        });
      });

      server.listen(port, "localhost", () => {
        console.log(`Mock database server listening on port ${port}`);
        resolve(server);
      });

      server.on("error", reject);
    });
  }

  beforeAll(async () => {
    // Start mock database server
    mockDatabaseServer = await createMockDatabaseServer(targetPort);
  }, 30000);

  afterAll(async () => {
    // Clean up
    if (mockDatabaseServer) {
      mockDatabaseServer.close();
    }
    if (mainProcess) {
      mainProcess.kill();
    }
  }, 10000);

  describe("Database Proxy Request Handling", () => {
    test("should handle database query lifecycle without duplicates", async () => {
      // This test simulates the full lifecycle of a database query
      const DatabaseProxyInterceptor = require("../../apps/main/database-proxy-interceptor");
      const DataManager = require("../../apps/main/data-manager");

      // Create a real interceptor instance
      const interceptor = new DatabaseProxyInterceptor({
        maxRequestHistory: 100,
      });

      // Enable auto-save
      interceptor.settings.autoSaveRequestsAsMocks = true;

      // Mock the data manager to track saves
      const saveCalls = [];
      interceptor.dataManager.saveDatabaseRequest = jest.fn(
        async (port, request) => {
          saveCalls.push({ port, request: { ...request } });
        }
      );

      try {
        // Create and start a database proxy
        const proxyConfig = interceptor.createDatabaseProxy({
          port: testPort,
          targetHost: "localhost",
          targetPort: targetPort,
          protocol: "postgresql",
          name: "Test Integration Proxy",
        });

        await interceptor.startDatabaseProxy(testPort);

        // Wait a bit for the proxy to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate a client connection
        const client = new net.Socket();

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 5000);

          client.connect(testPort, "localhost", () => {
            clearTimeout(timeout);
            console.log("Test client connected to proxy");

            // Send a test query
            client.write("SELECT 1");

            // Wait for response
            client.on("data", (data) => {
              console.log("Test client received response:", data.toString());
              client.destroy();
              resolve();
            });

            client.on("error", (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          client.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        // Wait for async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify that request was saved only once
        expect(saveCalls.length).toBe(1);

        const savedRequest = saveCalls[0].request;
        expect(savedRequest.id).toBeDefined();
        expect(savedRequest.status).toBe("success"); // Should be "success", not "executed"
        expect(savedRequest.response).toBeDefined();
        expect(savedRequest.proxyPort).toBe(testPort);
        expect(savedRequest.duration).toBeDefined();

        // Verify that the intercepted query has the correct status
        const interceptedQueries = interceptor.getInterceptedQueries();
        expect(interceptedQueries.length).toBeGreaterThan(0);

        const query = interceptedQueries.find((q) => q.proxyPort === testPort);
        expect(query).toBeDefined();
        expect(query.status).toBe("success");
        expect(query.response).toBeDefined();
      } finally {
        // Clean up
        try {
          await interceptor.stopDatabaseProxy(testPort);
        } catch (error) {
          console.log("Cleanup error:", error.message);
        }
      }
    }, 10000);

    test("should handle failed queries correctly", async () => {
      const DatabaseProxyInterceptor = require("../../apps/main/database-proxy-interceptor");

      const interceptor = new DatabaseProxyInterceptor({
        maxRequestHistory: 100,
      });

      interceptor.settings.autoSaveRequestsAsMocks = true;

      const saveCalls = [];
      interceptor.dataManager.saveDatabaseRequest = jest.fn(
        async (port, request) => {
          saveCalls.push({ port, request: { ...request } });
        }
      );

      const failedTestPort = testPort + 1;

      try {
        // Create and start a database proxy
        interceptor.createDatabaseProxy({
          port: failedTestPort,
          targetHost: "localhost",
          targetPort: targetPort,
          protocol: "postgresql",
          name: "Test Failed Query Proxy",
        });

        await interceptor.startDatabaseProxy(failedTestPort);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate a client connection with a failing query
        const client = new net.Socket();

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 5000);

          client.connect(failedTestPort, "localhost", () => {
            clearTimeout(timeout);
            console.log("Test client connected to proxy for failed query");

            // Send a query that will fail
            client.write("SELECT * FROM nonexistent_table");

            client.on("data", (data) => {
              console.log(
                "Test client received error response:",
                data.toString()
              );
              client.destroy();
              resolve();
            });

            client.on("error", (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          client.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify failed request handling
        expect(saveCalls.length).toBe(1);

        const savedRequest = saveCalls[0].request;
        expect(savedRequest.status).toBe("failed");
        expect(savedRequest.error).toBeDefined();
        expect(savedRequest.response).toBeDefined();
      } finally {
        try {
          await interceptor.stopDatabaseProxy(failedTestPort);
        } catch (error) {
          console.log("Cleanup error:", error.message);
        }
      }
    }, 10000);

    test("should not create duplicate queries for concurrent requests", async () => {
      const DatabaseProxyInterceptor = require("../../apps/main/database-proxy-interceptor");

      const interceptor = new DatabaseProxyInterceptor({
        maxRequestHistory: 100,
      });

      interceptor.settings.autoSaveRequestsAsMocks = true;

      const saveCalls = [];
      interceptor.dataManager.saveDatabaseRequest = jest.fn(
        async (port, request) => {
          saveCalls.push({ port, request: { ...request } });
        }
      );

      const concurrentTestPort = testPort + 2;

      try {
        interceptor.createDatabaseProxy({
          port: concurrentTestPort,
          targetHost: "localhost",
          targetPort: targetPort,
          protocol: "postgresql",
          name: "Test Concurrent Proxy",
        });

        await interceptor.startDatabaseProxy(concurrentTestPort);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create multiple concurrent connections
        const connections = [];
        const promises = [];

        for (let i = 0; i < 3; i++) {
          const client = new net.Socket();
          connections.push(client);

          const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Connection ${i} timeout`));
            }, 5000);

            client.connect(concurrentTestPort, "localhost", () => {
              clearTimeout(timeout);
              console.log(`Concurrent client ${i} connected`);

              // Each client sends a unique query
              client.write(`SELECT ${i + 1}`);

              client.on("data", (data) => {
                console.log(
                  `Concurrent client ${i} received response:`,
                  data.toString()
                );
                client.destroy();
                resolve();
              });

              client.on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
              });
            });

            client.on("error", (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          promises.push(promise);
        }

        // Wait for all connections to complete
        await Promise.all(promises);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Should have exactly 3 saves (one per query)
        expect(saveCalls.length).toBe(3);

        // Each save should be for a different query
        const savedQueries = saveCalls.map((call) => call.request.query);
        expect(new Set(savedQueries).size).toBe(3); // All unique

        // All should be successful
        saveCalls.forEach((call) => {
          expect(call.request.status).toBe("success");
          expect(call.request.response).toBeDefined();
        });
      } finally {
        try {
          await interceptor.stopDatabaseProxy(concurrentTestPort);
        } catch (error) {
          console.log("Cleanup error:", error.message);
        }
      }
    }, 15000);
  });

  describe("Event Emission", () => {
    test("should emit events in correct order", async () => {
      const DatabaseProxyInterceptor = require("../../apps/main/database-proxy-interceptor");

      const interceptor = new DatabaseProxyInterceptor();
      const events = [];

      // Track events
      interceptor.on("database-query", (query) => {
        events.push({ type: "query", query: { ...query } });
      });

      interceptor.on("database-query-response", (query) => {
        events.push({ type: "response", query: { ...query } });
      });

      const eventTestPort = testPort + 3;

      try {
        interceptor.createDatabaseProxy({
          port: eventTestPort,
          targetHost: "localhost",
          targetPort: targetPort,
          protocol: "postgresql",
          name: "Test Event Order Proxy",
        });

        await interceptor.startDatabaseProxy(eventTestPort);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const client = new net.Socket();

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 5000);

          client.connect(eventTestPort, "localhost", () => {
            clearTimeout(timeout);
            client.write("SELECT 1");

            client.on("data", (data) => {
              client.destroy();
              resolve();
            });

            client.on("error", reject);
          });

          client.on("error", reject);
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Should have exactly 2 events in correct order
        expect(events.length).toBe(2);
        expect(events[0].type).toBe("query");
        expect(events[1].type).toBe("response");

        // Query event should have pending status
        expect(events[0].query.status).toBe("pending");
        expect(events[0].query.response).toBeNull();

        // Response event should have success status and response
        expect(events[1].query.status).toBe("success");
        expect(events[1].query.response).toBeDefined();
        expect(events[1].query.duration).toBeDefined();
      } finally {
        try {
          await interceptor.stopDatabaseProxy(eventTestPort);
        } catch (error) {
          console.log("Cleanup error:", error.message);
        }
      }
    }, 10000);
  });
});
