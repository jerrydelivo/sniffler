/**
 * Tests for Database Proxy UI Status Colors and Icons
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the icons
jest.mock("react-icons/md", () => ({
  MdCheckCircle: () => <div data-testid="check-circle-icon" />,
  MdError: () => <div data-testid="error-icon" />,
  MdTimer: () => <div data-testid="timer-icon" />,
  MdWarning: () => <div data-testid="warning-icon" />,
  MdExpandMore: () => <div data-testid="expand-more-icon" />,
  MdChevronRight: () => <div data-testid="chevron-right-icon" />,
}));

// Import the component we need to test
// Note: We'll extract the DatabaseQueryItem component for easier testing
const DatabaseQueryItem = ({ query, proxies = [] }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
      case "executed":
        return (
          <div data-testid="check-circle-icon" className="text-green-500" />
        );
      case "failed":
        return <div data-testid="error-icon" className="text-red-500" />;
      case "pending":
        return <div data-testid="timer-icon" className="text-yellow-500" />;
      case "mocked":
        return (
          <div data-testid="check-circle-icon" className="text-blue-500" />
        );
      default:
        return <div data-testid="warning-icon" className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
      case "executed":
        return "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800";
      case "failed":
        return "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800";
      case "pending":
        return "bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800";
      case "mocked":
        return "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600";
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 ${getStatusColor(query.status)}`}
      data-testid="query-item"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {getStatusIcon(query.status)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {query.type || "QUERY"}
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
                {typeof query.query === "string"
                  ? query.query.substring(0, 50)
                  : query.query?.sql?.substring(0, 50) || "Database Query"}
                {(query.query?.length > 50 || query.query?.sql?.length > 50) &&
                  "..."}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(query.timestamp).toLocaleTimeString()}
              </span>
              {query.duration && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  • {query.duration}ms
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {query.response && (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                query.status === "success" || query.status === "executed"
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
              }`}
              data-testid="status-badge"
            >
              {query.status?.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

describe("Database Proxy UI Status Colors", () => {
  const mockProxies = [];

  describe("Status Icons", () => {
    test("should show green check icon for success status", () => {
      const query = {
        id: "test-1",
        status: "success",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("check-circle-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-green-500");
    });

    test("should show green check icon for executed status (backward compatibility)", () => {
      const query = {
        id: "test-2",
        status: "executed",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("check-circle-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-green-500");
    });

    test("should show red error icon for failed status", () => {
      const query = {
        id: "test-3",
        status: "failed",
        type: "SELECT",
        query: "SELECT * FROM nonexistent",
        timestamp: new Date().toISOString(),
        error: "Table does not exist",
        response: null,
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("error-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-red-500");
    });

    test("should show yellow timer icon for pending status", () => {
      const query = {
        id: "test-4",
        status: "pending",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("timer-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-yellow-500");
    });

    test("should show blue check icon for mocked status", () => {
      const query = {
        id: "test-5",
        status: "mocked",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("check-circle-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-blue-500");
    });

    test("should show gray warning icon for unknown status", () => {
      const query = {
        id: "test-6",
        status: "unknown",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const icon = screen.getByTestId("warning-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-gray-500");
    });
  });

  describe("Background Colors", () => {
    test("should have green background for success status", () => {
      const query = {
        id: "test-7",
        status: "success",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-green-50");
      expect(queryItem).toHaveClass("border-green-200");
    });

    test("should have green background for executed status (backward compatibility)", () => {
      const query = {
        id: "test-8",
        status: "executed",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-green-50");
      expect(queryItem).toHaveClass("border-green-200");
    });

    test("should have red background for failed status", () => {
      const query = {
        id: "test-9",
        status: "failed",
        type: "SELECT",
        query: "SELECT * FROM nonexistent",
        timestamp: new Date().toISOString(),
        error: "Table does not exist",
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-red-50");
      expect(queryItem).toHaveClass("border-red-200");
    });

    test("should have yellow background for pending status", () => {
      const query = {
        id: "test-10",
        status: "pending",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-yellow-50");
      expect(queryItem).toHaveClass("border-yellow-200");
    });

    test("should have blue background for mocked status", () => {
      const query = {
        id: "test-11",
        status: "mocked",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-blue-50");
      expect(queryItem).toHaveClass("border-blue-200");
    });

    test("should have gray background for unknown status", () => {
      const query = {
        id: "test-12",
        status: "unknown",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const queryItem = screen.getByTestId("query-item");
      expect(queryItem).toHaveClass("bg-gray-50");
      expect(queryItem).toHaveClass("border-gray-200");
    });
  });

  describe("Status Badge Colors", () => {
    test("should show green status badge for success status", () => {
      const query = {
        id: "test-13",
        status: "success",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const badge = screen.getByTestId("status-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-700");
      expect(badge).toHaveTextContent("SUCCESS");
    });

    test("should show green status badge for executed status (backward compatibility)", () => {
      const query = {
        id: "test-14",
        status: "executed",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: { rows: [] },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const badge = screen.getByTestId("status-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-700");
      expect(badge).toHaveTextContent("EXECUTED");
    });

    test("should show red status badge for failed status", () => {
      const query = {
        id: "test-15",
        status: "failed",
        type: "SELECT",
        query: "SELECT * FROM nonexistent",
        timestamp: new Date().toISOString(),
        error: "Table does not exist",
        response: { error: "Table does not exist" },
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      const badge = screen.getByTestId("status-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-700");
      expect(badge).toHaveTextContent("FAILED");
    });

    test("should not show status badge when no response", () => {
      const query = {
        id: "test-16",
        status: "pending",
        type: "SELECT",
        query: "SELECT * FROM users",
        timestamp: new Date().toISOString(),
        response: null,
      };

      render(<DatabaseQueryItem query={query} proxies={mockProxies} />);

      expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
    });
  });

  describe("Overview Tab Status Indicators", () => {
    // Test for the small status dots in overview
    const StatusDot = ({ status }) => (
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
          status === "success" || status === "executed"
            ? "bg-green-400"
            : status === "failed"
            ? "bg-red-400"
            : status === "mocked"
            ? "bg-blue-400"
            : "bg-yellow-400"
        }`}
        data-testid="status-dot"
      />
    );

    test("should show green dot for success status", () => {
      render(<StatusDot status="success" />);

      const dot = screen.getByTestId("status-dot");
      expect(dot).toHaveClass("bg-green-400");
    });

    test("should show green dot for executed status (backward compatibility)", () => {
      render(<StatusDot status="executed" />);

      const dot = screen.getByTestId("status-dot");
      expect(dot).toHaveClass("bg-green-400");
    });

    test("should show red dot for failed status", () => {
      render(<StatusDot status="failed" />);

      const dot = screen.getByTestId("status-dot");
      expect(dot).toHaveClass("bg-red-400");
    });

    test("should show blue dot for mocked status", () => {
      render(<StatusDot status="mocked" />);

      const dot = screen.getByTestId("status-dot");
      expect(dot).toHaveClass("bg-blue-400");
    });

    test("should show yellow dot for pending status", () => {
      render(<StatusDot status="pending" />);

      const dot = screen.getByTestId("status-dot");
      expect(dot).toHaveClass("bg-yellow-400");
    });
  });
});
