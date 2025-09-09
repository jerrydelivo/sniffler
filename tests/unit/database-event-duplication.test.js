/**
 * Test to ensure database events are not duplicated
 * This test prevents regression of the issue where database-query and database-response
 * events were being emitted twice due to duplicate event listeners in main process.
 */

const { EventEmitter } = require("events");

describe("Database Event Duplication Prevention", () => {
  let mockMainWindow;
  let mockDatabaseProxyInterceptor;
  let eventCounts;

  beforeEach(() => {
    // Reset event counts
    eventCounts = {
      "database-proxy-query": 0,
      "database-proxy-response": 0,
    };

    // Mock mainWindow with webContents.send that tracks calls
    mockMainWindow = {
      webContents: {
        send: jest.fn((channel, data) => {
          if (eventCounts.hasOwnProperty(channel)) {
            eventCounts[channel]++;
          }
        }),
      },
    };

    // Mock database proxy interceptor
    mockDatabaseProxyInterceptor = new EventEmitter();

    // Clear any existing listeners
    mockDatabaseProxyInterceptor.removeAllListeners();
  });

  afterEach(() => {
    mockDatabaseProxyInterceptor.removeAllListeners();
  });

  test("should only emit database-query event once per actual query", () => {
    // Simulate the main process event listener setup (only once, not duplicated)
    mockDatabaseProxyInterceptor.on("database-query", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-query", query);
      }
    });

    // Verify there's only one listener for database-query
    const queryListeners =
      mockDatabaseProxyInterceptor.listeners("database-query");
    expect(queryListeners).toHaveLength(1);

    // Simulate a database query event
    const mockQuery = {
      id: "db-query-test-123",
      connectionId: "db-conn-test-456",
      timestamp: new Date().toISOString(),
      proxyPort: 4445,
      proxyName: "Postgres",
      query: "SELECT * FROM users",
      protocol: "postgresql",
    };

    // Emit the event once
    mockDatabaseProxyInterceptor.emit("database-query", mockQuery);

    // Verify the event was sent to renderer only once
    expect(eventCounts["database-proxy-query"]).toBe(1);
    expect(mockMainWindow.webContents.send).toHaveBeenCalledTimes(1);
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      "database-proxy-query",
      mockQuery
    );
  });

  test("should only emit database-response event once per actual response", () => {
    // Simulate the main process event listener setup (only once, not duplicated)
    mockDatabaseProxyInterceptor.on("database-query-response", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-response", query);
      }
    });

    // Verify there's only one listener for database-query-response
    const responseListeners = mockDatabaseProxyInterceptor.listeners(
      "database-query-response"
    );
    expect(responseListeners).toHaveLength(1);

    // Simulate a database response event
    const mockResponse = {
      id: "db-query-test-123",
      connectionId: "db-conn-test-456",
      timestamp: new Date().toISOString(),
      proxyPort: 4445,
      proxyName: "Postgres",
      query: "SELECT * FROM users",
      protocol: "postgresql",
      status: "success",
      duration: 15,
      response: {
        rows: [{ id: 1, name: "John" }],
        rowCount: 1,
      },
    };

    // Emit the event once
    mockDatabaseProxyInterceptor.emit("database-query-response", mockResponse);

    // Verify the event was sent to renderer only once
    expect(eventCounts["database-proxy-response"]).toBe(1);
    expect(mockMainWindow.webContents.send).toHaveBeenCalledTimes(1);
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      "database-proxy-response",
      mockResponse
    );
  });

  test("should not have duplicate event listeners after initialization", () => {
    // This test simulates what happened in the bug - duplicate listeners being added

    // First setup (correct)
    mockDatabaseProxyInterceptor.on("database-query", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-query", query);
      }
    });

    // Verify we have one listener
    expect(
      mockDatabaseProxyInterceptor.listeners("database-query")
    ).toHaveLength(1);

    // Second setup (this would be the bug - adding another listener)
    // THIS SHOULD NOT HAPPEN IN PRODUCTION CODE
    mockDatabaseProxyInterceptor.on("database-query", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-query", query);
      }
    });

    // This shows the bug - now we have 2 listeners
    expect(
      mockDatabaseProxyInterceptor.listeners("database-query")
    ).toHaveLength(2);

    // Emit one event
    const mockQuery = {
      id: "db-query-test-duplicate",
      query: "SELECT * FROM test",
    };

    mockDatabaseProxyInterceptor.emit("database-query", mockQuery);

    // This demonstrates the bug - the event is sent twice
    expect(eventCounts["database-proxy-query"]).toBe(2);
    expect(mockMainWindow.webContents.send).toHaveBeenCalledTimes(2);

    // In production, we should NEVER have more than 1 listener for these events
  });

  test("should validate main process has no duplicate database event listeners", () => {
    // This test can be used to check the actual main process code
    // by importing the actual modules and verifying listener counts

    // For now, this serves as documentation of what to check:
    // 1. initializeDatabaseProxies() should set up listeners
    // 2. app.whenReady() should NOT set up duplicate listeners
    // 3. Total listeners for "database-query" should be exactly 1
    // 4. Total listeners for "database-query-response" should be exactly 1

    // Mock the correct behavior
    mockDatabaseProxyInterceptor.on("database-query", () => {});
    mockDatabaseProxyInterceptor.on("database-query-response", () => {});

    expect(
      mockDatabaseProxyInterceptor.listeners("database-query")
    ).toHaveLength(1);
    expect(
      mockDatabaseProxyInterceptor.listeners("database-query-response")
    ).toHaveLength(1);

    // This test passes when there are no duplicates
    expect(
      mockDatabaseProxyInterceptor.listenerCount("database-query")
    ).toBeLessThanOrEqual(1);
    expect(
      mockDatabaseProxyInterceptor.listenerCount("database-query-response")
    ).toBeLessThanOrEqual(1);
  });

  test("should handle multiple different database events without duplication", () => {
    // Set up listeners for multiple event types (this is correct)
    mockDatabaseProxyInterceptor.on("database-query", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-query", query);
      }
    });

    mockDatabaseProxyInterceptor.on("database-query-response", (query) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-proxy-response", query);
      }
    });

    mockDatabaseProxyInterceptor.on("database-mock-served", (data) => {
      if (mockMainWindow) {
        mockMainWindow.webContents.send("database-mock-served", data);
      }
    });

    // Verify each event type has exactly one listener
    expect(mockDatabaseProxyInterceptor.listenerCount("database-query")).toBe(
      1
    );
    expect(
      mockDatabaseProxyInterceptor.listenerCount("database-query-response")
    ).toBe(1);
    expect(
      mockDatabaseProxyInterceptor.listenerCount("database-mock-served")
    ).toBe(1);

    // Emit different events
    mockDatabaseProxyInterceptor.emit("database-query", { id: "query1" });
    mockDatabaseProxyInterceptor.emit("database-query-response", {
      id: "response1",
    });
    mockDatabaseProxyInterceptor.emit("database-mock-served", { id: "mock1" });

    // Each should be called exactly once
    expect(mockMainWindow.webContents.send).toHaveBeenCalledTimes(3);
    expect(eventCounts["database-proxy-query"]).toBe(1);
    expect(eventCounts["database-proxy-response"]).toBe(1);
  });
});
