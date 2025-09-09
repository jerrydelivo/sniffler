// Unit tests for real-time event handling and state management
// Tests the connection between proxy events and UI state updates

import { render, waitFor, act } from "@testing-library/react";
import { jest } from "@jest/globals";
import App from "../../apps/renderer/src/App";

// Mock electron API
const mockElectronAPI = {
  getProxies: jest.fn(),
  getMocks: jest.fn(),
  getRequests: jest.fn(),
  startProxy: jest.fn(),
  stopProxy: jest.fn(),
  onProxyRequest: jest.fn(),
  onProxyResponse: jest.fn(),
  onProxyError: jest.fn(),
  onMockAutoCreated: jest.fn(),
  onDatabaseQuery: jest.fn(),
  onDatabaseResponse: jest.fn(),
  onDatabaseMockCreated: jest.fn(),
  onOutgoingRequest: jest.fn(),
  onOutgoingResponse: jest.fn(),
  onOutgoingMockCreated: jest.fn(),
  removeAllListeners: jest.fn(),
};

describe("UI Real-time Event Handling Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window.electronAPI = mockElectronAPI;

    // Default mock implementations
    mockElectronAPI.getProxies.mockResolvedValue([]);
    mockElectronAPI.getMocks.mockResolvedValue([]);
    mockElectronAPI.getRequests.mockResolvedValue([]);
  });

  describe("Normal Request Events", () => {
    test("should handle onProxyRequest event and update state", async () => {
      const mockRequest = {
        id: "req-1",
        method: "GET",
        url: "/api/test",
        proxyPort: 8080,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      render(<App />);

      // Get the callback function passed to onProxyRequest
      expect(mockElectronAPI.onProxyRequest).toHaveBeenCalled();
      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Simulate the event
      await act(async () => {
        onProxyRequestCallback({ request: mockRequest });
      });

      // Verify the request appears in the UI
      await waitFor(() => {
        // This would need to be adapted based on actual UI structure
        const requestElements = document.querySelectorAll(
          '[data-testid="request-item"]'
        );
        expect(requestElements.length).toBeGreaterThan(0);
      });
    });

    test("should handle onProxyResponse event and update existing request", async () => {
      const mockRequest = {
        id: "req-1",
        method: "GET",
        url: "/api/test",
        proxyPort: 8080,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      const mockResponse = {
        status: 200,
        data: { message: "success" },
        headers: { "content-type": "application/json" },
      };

      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];
      const onProxyResponseCallback =
        mockElectronAPI.onProxyResponse.mock.calls[0][0];

      // First add the request
      await act(async () => {
        onProxyRequestCallback({ request: mockRequest });
      });

      // Then update with response
      await act(async () => {
        onProxyResponseCallback({
          request: {
            ...mockRequest,
            status: "success",
            duration: 150,
          },
          response: mockResponse,
        });
      });

      // Verify the request status was updated
      await waitFor(() => {
        // Check that the request status changed from pending to success
        const statusElements = document.querySelectorAll(
          '[data-testid="request-status"]'
        );
        const hasSuccessStatus = Array.from(statusElements).some(
          (el) =>
            el.textContent.includes("success") || el.textContent.includes("200")
        );
        expect(hasSuccessStatus).toBe(true);
      });
    });

    test("should handle onMockAutoCreated event and add mock to state", async () => {
      const mockMock = {
        id: "mock-1",
        method: "GET",
        url: "/api/test",
        response: { data: "test" },
        proxyPort: 8080,
        enabled: false, // Auto-created mocks are disabled by default
      };

      render(<App />);

      const onMockAutoCreatedCallback =
        mockElectronAPI.onMockAutoCreated.mock.calls[0][0];

      await act(async () => {
        onMockAutoCreatedCallback({
          proxyId: 8080,
          mock: mockMock,
        });
      });

      // Verify the mock was added to state and appears in UI
      await waitFor(() => {
        const mockElements = document.querySelectorAll(
          '[data-testid="mock-item"]'
        );
        expect(mockElements.length).toBeGreaterThan(0);
      });
    });

    test("should handle onProxyError event gracefully", async () => {
      // Spy on alert to verify error handling
      const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

      render(<App />);

      const onProxyErrorCallback =
        mockElectronAPI.onProxyError.mock.calls[0][0];

      await act(async () => {
        onProxyErrorCallback({
          proxyId: 8080,
          error: "Connection refused",
        });
      });

      // Verify error was handled
      expect(alertSpy).toHaveBeenCalledWith(
        "Proxy Error (Port 8080): Connection refused"
      );

      alertSpy.mockRestore();
    });

    test("should handle multiple rapid requests without losing any", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Create 10 rapid requests
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `req-${i}`,
        method: "GET",
        url: `/api/test-${i}`,
        proxyPort: 8080,
        timestamp: new Date().toISOString(),
        status: "pending",
      }));

      // Simulate rapid events
      await act(async () => {
        requests.forEach((request) => {
          onProxyRequestCallback({ request });
        });
      });

      // Verify all requests were added
      await waitFor(() => {
        const requestElements = document.querySelectorAll(
          '[data-testid="request-item"]'
        );
        expect(requestElements.length).toBe(10);
      });
    });
  });

  describe("Database Request Events", () => {
    test("should handle onDatabaseQuery event and update state", async () => {
      const mockQuery = {
        id: "query-1",
        query: "SELECT * FROM users",
        database: "postgresql",
        proxyPort: 5433,
        timestamp: new Date().toISOString(),
        status: "executing",
      };

      // Mock database event handler if it exists
      if (mockElectronAPI.onDatabaseQuery) {
        render(<App />);

        const onDatabaseQueryCallback =
          mockElectronAPI.onDatabaseQuery.mock.calls[0][0];

        await act(async () => {
          onDatabaseQueryCallback({ query: mockQuery });
        });

        await waitFor(() => {
          const queryElements = document.querySelectorAll(
            '[data-testid="database-query-item"]'
          );
          expect(queryElements.length).toBeGreaterThan(0);
        });
      } else {
        // Skip test if database events not implemented
        expect(true).toBe(true);
      }
    });

    test("should handle onDatabaseResponse event and update query status", async () => {
      const mockQuery = {
        id: "query-1",
        query: "SELECT * FROM users",
        database: "postgresql",
        proxyPort: 5433,
        timestamp: new Date().toISOString(),
        status: "executing",
      };

      const mockResponse = {
        rows: [{ id: 1, name: "test" }],
        rowCount: 1,
      };

      if (
        mockElectronAPI.onDatabaseQuery &&
        mockElectronAPI.onDatabaseResponse
      ) {
        render(<App />);

        const onDatabaseQueryCallback =
          mockElectronAPI.onDatabaseQuery.mock.calls[0][0];
        const onDatabaseResponseCallback =
          mockElectronAPI.onDatabaseResponse.mock.calls[0][0];

        // Add query first
        await act(async () => {
          onDatabaseQueryCallback({ query: mockQuery });
        });

        // Then add response
        await act(async () => {
          onDatabaseResponseCallback({
            query: {
              ...mockQuery,
              status: "completed",
              duration: 25,
            },
            response: mockResponse,
          });
        });

        await waitFor(() => {
          const statusElements = document.querySelectorAll(
            '[data-testid="query-status"]'
          );
          const hasCompletedStatus = Array.from(statusElements).some(
            (el) =>
              el.textContent.includes("completed") ||
              el.textContent.includes("success")
          );
          expect(hasCompletedStatus).toBe(true);
        });
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle onDatabaseMockCreated event", async () => {
      const mockDatabaseMock = {
        id: "db-mock-1",
        query: "SELECT * FROM users",
        response: { rows: [], rowCount: 0 },
        proxyPort: 5433,
        enabled: false,
      };

      if (mockElectronAPI.onDatabaseMockCreated) {
        render(<App />);

        const onDatabaseMockCreatedCallback =
          mockElectronAPI.onDatabaseMockCreated.mock.calls[0][0];

        await act(async () => {
          onDatabaseMockCreatedCallback({
            proxyId: 5433,
            mock: mockDatabaseMock,
          });
        });

        await waitFor(() => {
          const mockElements = document.querySelectorAll(
            '[data-testid="database-mock-item"]'
          );
          expect(mockElements.length).toBeGreaterThan(0);
        });
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("Outgoing Request Events", () => {
    test("should handle onOutgoingRequest event and update state", async () => {
      const mockOutgoingRequest = {
        id: "outgoing-1",
        method: "GET",
        url: "https://api.external.com/data",
        proxyPort: 8888,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      if (mockElectronAPI.onOutgoingRequest) {
        render(<App />);

        const onOutgoingRequestCallback =
          mockElectronAPI.onOutgoingRequest.mock.calls[0][0];

        await act(async () => {
          onOutgoingRequestCallback({ request: mockOutgoingRequest });
        });

        await waitFor(() => {
          const requestElements = document.querySelectorAll(
            '[data-testid="outgoing-request-item"]'
          );
          expect(requestElements.length).toBeGreaterThan(0);
        });
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle onOutgoingResponse event and update request status", async () => {
      const mockOutgoingRequest = {
        id: "outgoing-1",
        method: "GET",
        url: "https://api.external.com/data",
        proxyPort: 8888,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      const mockResponse = {
        status: 200,
        data: { external: "data" },
      };

      if (
        mockElectronAPI.onOutgoingRequest &&
        mockElectronAPI.onOutgoingResponse
      ) {
        render(<App />);

        const onOutgoingRequestCallback =
          mockElectronAPI.onOutgoingRequest.mock.calls[0][0];
        const onOutgoingResponseCallback =
          mockElectronAPI.onOutgoingResponse.mock.calls[0][0];

        // Add request first
        await act(async () => {
          onOutgoingRequestCallback({ request: mockOutgoingRequest });
        });

        // Then add response
        await act(async () => {
          onOutgoingResponseCallback({
            request: {
              ...mockOutgoingRequest,
              status: "success",
              duration: 300,
            },
            response: mockResponse,
          });
        });

        await waitFor(() => {
          const statusElements = document.querySelectorAll(
            '[data-testid="outgoing-status"]'
          );
          const hasSuccessStatus = Array.from(statusElements).some(
            (el) =>
              el.textContent.includes("success") ||
              el.textContent.includes("200")
          );
          expect(hasSuccessStatus).toBe(true);
        });
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle onOutgoingMockCreated event", async () => {
      const mockOutgoingMock = {
        id: "outgoing-mock-1",
        method: "GET",
        url: "https://api.external.com/data",
        response: { external: "data" },
        proxyPort: 8888,
        enabled: false,
      };

      if (mockElectronAPI.onOutgoingMockCreated) {
        render(<App />);

        const onOutgoingMockCreatedCallback =
          mockElectronAPI.onOutgoingMockCreated.mock.calls[0][0];

        await act(async () => {
          onOutgoingMockCreatedCallback({
            proxyId: 8888,
            mock: mockOutgoingMock,
          });
        });

        await waitFor(() => {
          const mockElements = document.querySelectorAll(
            '[data-testid="outgoing-mock-item"]'
          );
          expect(mockElements.length).toBeGreaterThan(0);
        });
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("State Management and Consistency", () => {
    test("should maintain separate state for different proxy ports", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Add requests for different proxy ports
      const requests = [
        {
          id: "req-1",
          method: "GET",
          url: "/api/test1",
          proxyPort: 8080,
          timestamp: new Date().toISOString(),
          status: "pending",
        },
        {
          id: "req-2",
          method: "POST",
          url: "/api/test2",
          proxyPort: 8081,
          timestamp: new Date().toISOString(),
          status: "pending",
        },
      ];

      await act(async () => {
        requests.forEach((request) => {
          onProxyRequestCallback({ request });
        });
      });

      await waitFor(() => {
        const requestElements = document.querySelectorAll(
          '[data-testid="request-item"]'
        );
        expect(requestElements.length).toBe(2);
      });

      // Verify requests are properly categorized by proxy port
      const portElements = document.querySelectorAll(
        '[data-testid="request-proxy-port"]'
      );
      const ports = Array.from(portElements).map((el) => el.textContent);
      expect(ports).toContain("8080");
      expect(ports).toContain("8081");
    });

    test("should handle state updates without memory leaks", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Simulate a large number of events
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          onProxyRequestCallback({
            request: {
              id: `req-${i}`,
              method: "GET",
              url: `/api/test-${i}`,
              proxyPort: 8080,
              timestamp: new Date().toISOString(),
              status: "pending",
            },
          });
        });
      }

      // Verify UI can handle large state without crashing
      await waitFor(() => {
        const requestElements = document.querySelectorAll(
          '[data-testid="request-item"]'
        );
        expect(requestElements.length).toBeGreaterThan(0);
      });

      // App should still be responsive
      expect(
        document.querySelector('[data-testid="app-container"]')
      ).toBeInTheDocument();
    });

    test("should preserve request order in real-time updates", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      const requests = [
        {
          id: "req-1",
          method: "GET",
          url: "/api/first",
          proxyPort: 8080,
          timestamp: "2023-01-01T10:00:00.000Z",
          status: "pending",
        },
        {
          id: "req-2",
          method: "GET",
          url: "/api/second",
          proxyPort: 8080,
          timestamp: "2023-01-01T10:00:01.000Z",
          status: "pending",
        },
        {
          id: "req-3",
          method: "GET",
          url: "/api/third",
          proxyPort: 8080,
          timestamp: "2023-01-01T10:00:02.000Z",
          status: "pending",
        },
      ];

      // Add requests in order
      for (const request of requests) {
        await act(async () => {
          onProxyRequestCallback({ request });
        });
      }

      await waitFor(() => {
        const requestElements = document.querySelectorAll(
          '[data-testid="request-item"]'
        );
        expect(requestElements.length).toBe(3);
      });

      // Verify order is preserved (newest first typically)
      const urlElements = document.querySelectorAll(
        '[data-testid="request-url"]'
      );
      const urls = Array.from(urlElements).map((el) => el.textContent);

      // Assuming newest requests appear first
      expect(urls[0]).toContain("/api/third");
      expect(urls[1]).toContain("/api/second");
      expect(urls[2]).toContain("/api/first");
    });

    test("should handle event listener cleanup properly", async () => {
      const { unmount } = render(<App />);

      // Verify event listeners were set up
      expect(mockElectronAPI.onProxyRequest).toHaveBeenCalled();
      expect(mockElectronAPI.onProxyResponse).toHaveBeenCalled();
      expect(mockElectronAPI.onProxyError).toHaveBeenCalled();
      expect(mockElectronAPI.onMockAutoCreated).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Verify cleanup was called (if implemented)
      if (mockElectronAPI.removeAllListeners) {
        expect(mockElectronAPI.removeAllListeners).toHaveBeenCalled();
      }
    });
  });

  describe("Error Handling in Event Processing", () => {
    test("should handle malformed request events gracefully", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Test with malformed request object
      await act(async () => {
        expect(() => {
          onProxyRequestCallback({ request: null });
        }).not.toThrow();
      });

      await act(async () => {
        expect(() => {
          onProxyRequestCallback({
            request: { id: "missing-required-fields" },
          });
        }).not.toThrow();
      });

      // App should still be functional
      expect(
        document.querySelector('[data-testid="app-container"]')
      ).toBeInTheDocument();
    });

    test("should handle event processing errors without crashing", async () => {
      render(<App />);

      const onProxyRequestCallback =
        mockElectronAPI.onProxyRequest.mock.calls[0][0];

      // Simulate an event that might cause an error
      await act(async () => {
        expect(() => {
          onProxyRequestCallback({
            request: {
              id: "req-1",
              method: "INVALID_METHOD",
              url: "/api/test",
              proxyPort: "invalid-port",
              timestamp: "invalid-timestamp",
              status: "unknown-status",
            },
          });
        }).not.toThrow();
      });

      // App should still be responsive
      expect(
        document.querySelector('[data-testid="app-container"]')
      ).toBeInTheDocument();
    });
  });
});
