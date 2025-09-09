/**
 * Tests to ensure database proxy requests are not saved twice
 * and have the correct status and color
 */
const DatabaseProxyInterceptor = require("../../apps/main/database-proxy-interceptor");
const DataManager = require("../../apps/main/data-manager");

jest.mock("../../apps/main/data-manager");

describe("Database Proxy Duplicate Request Fix", () => {
  let interceptor;
  let mockDataManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DataManager
    mockDataManager = {
      initialize: jest.fn().mockResolvedValue(),
      saveDatabaseRequest: jest.fn().mockResolvedValue(),
      loadDatabaseRequests: jest.fn().mockResolvedValue([]),
    };

    DataManager.mockImplementation(() => mockDataManager);

    interceptor = new DatabaseProxyInterceptor({
      maxRequestHistory: 100,
      autoSaveRequestsAsMocks: true,
    });

    // Override the dataManager instance
    interceptor.dataManager = mockDataManager;
    interceptor.settings.autoSaveRequestsAsMocks = true;
  });

  afterEach(() => {
    if (interceptor) {
      // Clean up any proxy servers
      for (const [port, proxy] of interceptor.proxyServers) {
        if (proxy.server) {
          try {
            proxy.server.close();
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    }
  });

  describe("Request Saving", () => {
    test("should save database request only once per query cycle", async () => {
      // Create a mock proxy configuration
      const proxyConfig = {
        id: "test-proxy-1",
        port: 5432,
        targetHost: "localhost",
        targetPort: 5433,
        protocol: "postgresql",
        name: "Test PostgreSQL Proxy",
        createdAt: new Date().toISOString(),
        isRunning: false,
        server: null,
        stats: {
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          activeConnections: 0,
          mocksServed: 0,
        },
      };

      interceptor.proxyServers.set(5432, proxyConfig);

      // Simulate processing a query
      const connectionId = "test-connection-1";
      const parsedQuery = {
        type: "SELECT",
        sql: "SELECT 1",
        isQuery: true,
      };

      // Create a mock connection
      interceptor.connections.set(connectionId, {
        clientSocket: { write: jest.fn() },
        targetSocket: { write: jest.fn() },
        parser: {
          parseQuery: (data) => ({
            type: "SELECT",
            sql: "SELECT 1",
          }),
          parseResponse: (data) => ({
            type: "query_result",
            rows: [{ "?column?": 1 }],
            rowCount: 1,
            isError: false,
          }),
        },
        proxyConfig,
      });

      // Process the query (this should NOT save to database anymore)
      const processedQuery = interceptor.processQuery(
        connectionId,
        parsedQuery,
        proxyConfig
      );

      expect(processedQuery).toBeTruthy();
      expect(processedQuery.id).toBeDefined();
      expect(processedQuery.status).toBe("pending");

      // At this point, saveDatabaseRequest should NOT have been called
      expect(mockDataManager.saveDatabaseRequest).not.toHaveBeenCalled();

      // Simulate receiving response data
      const responseBuffer = Buffer.from("mock response data");
      interceptor.handleTargetData(connectionId, responseBuffer);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check if the query was updated in intercepted queries
      const updatedQuery = interceptor.interceptedQueries.find(
        (q) => q.connectionId === connectionId
      );
      expect(updatedQuery).toBeTruthy();
      expect(updatedQuery.status).toBe("success"); // Should be updated

      // Now saveDatabaseRequest should have been called exactly once
      expect(mockDataManager.saveDatabaseRequest).toHaveBeenCalledTimes(1);

      // Verify the saved request has the correct status
      const savedRequest = mockDataManager.saveDatabaseRequest.mock.calls[0][1];
      expect(savedRequest.status).toBe("success"); // Should be "success", not "executed"
      expect(savedRequest.response).toBeDefined();
    });

    test("should save failed requests with correct status", async () => {
      // Create a mock proxy configuration
      const proxyConfig = {
        id: "test-proxy-2",
        port: 5432,
        targetHost: "localhost",
        targetPort: 5433,
        protocol: "postgresql",
        name: "Test PostgreSQL Proxy",
        createdAt: new Date().toISOString(),
        isRunning: false,
        server: null,
        stats: {
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          activeConnections: 0,
          mocksServed: 0,
        },
      };

      interceptor.proxyServers.set(5432, proxyConfig);

      // Simulate processing a query
      const connectionId = "test-connection-2";
      const parsedQuery = {
        type: "SELECT",
        sql: "SELECT * FROM nonexistent_table",
        isQuery: true,
      };

      // Create a mock connection with error response
      interceptor.connections.set(connectionId, {
        clientSocket: { write: jest.fn() },
        targetSocket: { write: jest.fn() },
        parser: {
          parseQuery: (data) => ({
            type: "SELECT",
            sql: "SELECT * FROM nonexistent_table",
          }),
          parseResponse: (data) => ({
            type: "error",
            isError: true,
            errorInfo: {
              message: "Table 'nonexistent_table' doesn't exist",
            },
          }),
        },
        proxyConfig,
      });

      // Process the query
      const processedQuery = interceptor.processQuery(
        connectionId,
        parsedQuery,
        proxyConfig
      );

      expect(processedQuery).toBeTruthy();
      expect(processedQuery.status).toBe("pending");

      // Should not save yet
      expect(mockDataManager.saveDatabaseRequest).not.toHaveBeenCalled();

      // Simulate receiving error response data
      const responseBuffer = Buffer.from("error response data");
      interceptor.handleTargetData(connectionId, responseBuffer);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have been called exactly once
      expect(mockDataManager.saveDatabaseRequest).toHaveBeenCalledTimes(1);

      // Verify the saved request has the correct error status
      const savedRequest = mockDataManager.saveDatabaseRequest.mock.calls[0][1];
      expect(savedRequest.status).toBe("failed");
      expect(savedRequest.error).toBeDefined();
    });

    test("should not save duplicate requests when same query is processed multiple times", async () => {
      const proxyConfig = {
        id: "test-proxy-3",
        port: 5432,
        targetHost: "localhost",
        targetPort: 5433,
        protocol: "postgresql",
        name: "Test PostgreSQL Proxy",
        stats: {
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          activeConnections: 0,
          mocksServed: 0,
        },
      };

      interceptor.proxyServers.set(5432, proxyConfig);

      const connectionId1 = "test-connection-3a";
      const connectionId2 = "test-connection-3b";
      const parsedQuery = {
        type: "SELECT",
        sql: "SELECT NOW()",
        isQuery: true,
      };

      // Create mock connections
      const mockConnection = {
        clientSocket: { write: jest.fn() },
        targetSocket: { write: jest.fn() },
        parser: {
          parseQuery: (data) => ({
            type: "SELECT",
            sql: "SELECT NOW()",
          }),
          parseResponse: (data) => ({
            type: "query_result",
            rows: [{ now: new Date().toISOString() }],
            rowCount: 1,
            isError: false,
          }),
        },
        proxyConfig,
      };

      interceptor.connections.set(connectionId1, mockConnection);
      interceptor.connections.set(connectionId2, { ...mockConnection });

      // Process the same query twice with different connection IDs
      const query1 = interceptor.processQuery(
        connectionId1,
        parsedQuery,
        proxyConfig
      );
      const query2 = interceptor.processQuery(
        connectionId2,
        parsedQuery,
        proxyConfig
      );

      expect(query1).toBeTruthy();
      expect(query2).toBeTruthy();
      expect(query1.id).not.toBe(query2.id); // Different IDs

      // No saves yet
      expect(mockDataManager.saveDatabaseRequest).not.toHaveBeenCalled();

      // Simulate responses
      const responseBuffer = Buffer.from("response data");
      interceptor.handleTargetData(connectionId1, responseBuffer);
      interceptor.handleTargetData(connectionId2, responseBuffer);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have been called exactly twice (once per unique query)
      expect(mockDataManager.saveDatabaseRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("Query Status", () => {
    test("should set status to 'success' for successful queries", () => {
      const connectionId = "test-connection-status-1";
      const query = {
        id: "test-query-1",
        connectionId: connectionId,
        status: "pending",
        response: null,
        startTime: Date.now(),
      };

      // Add to intercepted queries
      interceptor.interceptedQueries.push(query);

      const proxyConfig = {
        stats: { failedQueries: 0, successfulQueries: 0 },
        protocol: "postgresql",
      };

      interceptor.connections.set(connectionId, {
        clientSocket: { write: jest.fn() },
        parser: {
          parseResponse: (data) => ({
            type: "query_result",
            rows: [{ result: "success" }],
            rowCount: 1,
            isError: false,
          }),
        },
        proxyConfig,
      });

      // Simulate successful response
      const responseBuffer = Buffer.from("success response");
      interceptor.handleTargetData(connectionId, responseBuffer);

      // Find the updated query
      const updatedQuery = interceptor.interceptedQueries.find(
        (q) => q.id === query.id
      );
      expect(updatedQuery.status).toBe("success"); // Should be "success", not "executed"
      expect(updatedQuery.response).toBeDefined();
      expect(updatedQuery.duration).toBeDefined();
    });

    test("should set status to 'failed' for failed queries", () => {
      const connectionId = "test-connection-status-2";
      const query = {
        id: "test-query-2",
        connectionId: connectionId,
        status: "pending",
        response: null,
        startTime: Date.now(),
      };

      // Add to intercepted queries
      interceptor.interceptedQueries.push(query);

      const proxyConfig = {
        stats: { failedQueries: 0, successfulQueries: 0 },
        protocol: "postgresql",
      };

      interceptor.connections.set(connectionId, {
        clientSocket: { write: jest.fn() },
        parser: {
          parseResponse: (data) => ({
            type: "error",
            isError: true,
            errorInfo: {
              message: "Database connection failed",
            },
          }),
        },
        proxyConfig,
      });

      // Simulate error response
      const responseBuffer = Buffer.from("error response");
      interceptor.handleTargetData(connectionId, responseBuffer);

      // Find the updated query
      const updatedQuery = interceptor.interceptedQueries.find(
        (q) => q.id === query.id
      );
      expect(updatedQuery.status).toBe("failed");
      expect(updatedQuery.error).toBeDefined();
      expect(updatedQuery.duration).toBeDefined();
    });
  });

  describe("Event Emissions", () => {
    test("should emit database-query event only once per query", (done) => {
      let eventCount = 0;

      interceptor.on("database-query", (query) => {
        eventCount++;
        expect(query.id).toBeDefined();
        expect(query.status).toBe("pending");

        // Should only be called once
        if (eventCount === 1) {
          setTimeout(() => {
            expect(eventCount).toBe(1);
            done();
          }, 50);
        } else {
          done(new Error(`Expected 1 event, got ${eventCount}`));
        }
      });

      const proxyConfig = {
        id: "test-proxy-events",
        port: 5432,
        stats: { totalQueries: 0, successfulQueries: 0 },
      };

      const connectionId = "test-connection-events";
      const parsedQuery = {
        type: "SELECT",
        sql: "SELECT 1",
        isQuery: true,
      };

      interceptor.connections.set(connectionId, {
        parser: {
          parseQuery: (data) => ({
            type: "SELECT",
            sql: "SELECT 1",
          }),
        },
        proxyConfig,
      });

      // Process query should emit event once
      interceptor.processQuery(connectionId, parsedQuery, proxyConfig);
    });

    test("should not emit event when loading from disk", () => {
      let eventCount = 0;

      interceptor.on("database-query", () => {
        eventCount++;
      });

      const savedQuery = {
        id: "test-saved-query",
        status: "success",
        query: "SELECT 1 FROM saved",
        timestamp: new Date().toISOString(),
      };

      // Add query without emitting event (like loading from disk)
      interceptor.addInterceptedQuery(savedQuery, false);

      // Should not have emitted any events
      expect(eventCount).toBe(0);

      // But query should be in the list
      expect(interceptor.interceptedQueries).toContain(savedQuery);
    });
    test("should emit database-query-response event when response is received", (done) => {
      const connectionId = "test-connection-response";
      const queryId = "test-query-response";
      const query = {
        id: queryId,
        connectionId: connectionId,
        status: "pending",
        response: null,
        startTime: Date.now(),
      };

      interceptor.interceptedQueries.push(query);

      interceptor.on("database-query-response", (responseQuery) => {
        try {
          expect(responseQuery.id).toBe(queryId);
          expect(responseQuery.status).toBe("success");
          expect(responseQuery.response).toBeDefined();
          done();
        } catch (error) {
          done(error);
        }
      });

      const proxyConfig = {
        stats: { failedQueries: 0, successfulQueries: 0 },
        protocol: "postgresql",
      };

      interceptor.connections.set(connectionId, {
        clientSocket: { write: jest.fn() },
        parser: {
          parseResponse: (data) => ({
            type: "query_result",
            rows: [{ result: "success" }],
            isError: false,
          }),
        },
        proxyConfig,
      });

      // Trigger response handling
      const responseBuffer = Buffer.from("success response");
      interceptor.handleTargetData(connectionId, responseBuffer);
    });
  });
});
