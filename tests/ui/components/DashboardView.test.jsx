// Dashboard View Component Tests
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { mockDataGenerators, userActions } from "../utils/test-utils";
import DashboardView from "../../../apps/renderer/src/components/views/DashboardView";

describe("DashboardView Component", () => {
  const mockProps = {
    projects: [],
    requests: [],
    mocks: [],
    onSelectProject: jest.fn(),
    onCreateProject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Empty State", () => {
    test("should render empty dashboard with no projects", () => {
      render(<DashboardView {...mockProps} />);

      // Check title
      expect(screen.getByText("Dashboard")).toBeInTheDocument();

      // Check stats cards show zero
      expect(screen.getByText("Active Projects")).toBeInTheDocument();

      // Check that Active Projects shows 0
      const activeProjectsSection = screen
        .getByText("Active Projects")
        .closest("div");
      expect(within(activeProjectsSection).getByText("0")).toBeInTheDocument();

      // Check empty state message
      expect(screen.getByText("No projects yet")).toBeInTheDocument();
      expect(screen.getByText("Create Your First Project")).toBeInTheDocument();
    });

    test("should call onCreateProject when create button is clicked", async () => {
      render(<DashboardView {...mockProps} />);

      const createButton = screen.getByRole("button", {
        name: /create your first project/i,
      });
      await userActions.clickButton("Create Your First Project");

      expect(mockProps.onCreateProject).toHaveBeenCalledTimes(1);
    });

    test("should show correct stats for empty dashboard", () => {
      render(<DashboardView {...mockProps} />);

      // All stats should be 0 - check specific stats by label
      expect(screen.getByText("Active Projects")).toBeInTheDocument();
      expect(screen.getByText("Total Requests")).toBeInTheDocument();
      expect(screen.getByText("Failed Requests")).toBeInTheDocument();
      expect(screen.getByText("Saved Mocks")).toBeInTheDocument();

      // Check that all four stat values are 0
      const statValues = screen.getAllByText("0");
      expect(statValues).toHaveLength(4); // 4 stat cards
    });
  });

  describe("Dashboard with Data", () => {
    const mockProjects = [
      mockDataGenerators.project({
        port: 8080,
        name: "API Gateway",
        targetHost: "api.example.com",
        targetPort: 443,
      }),
      mockDataGenerators.project({
        port: 8081,
        name: "Auth Service",
        disabled: true,
      }),
    ];

    const mockRequests = [
      mockDataGenerators.request({
        proxyPort: 8080,
        method: "GET",
        path: "/api/users",
        status: "success", // Use status string instead of code
      }),
      mockDataGenerators.request({
        proxyPort: 8080,
        method: "POST",
        path: "/api/auth",
        status: "failed", // Use status string for failed request
      }),
      mockDataGenerators.request({
        proxyPort: 8081,
        method: "GET",
        path: "/health",
        status: "success",
      }),
    ];

    const mockMocks = [
      mockDataGenerators.mock({ proxyPort: 8080, url: "/api/mock1" }),
      mockDataGenerators.mock({ proxyPort: 8081, url: "/api/mock2" }),
    ];

    test("should render correct statistics", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Check specific stats by finding the parent containers
      const activeProjectsSection = screen
        .getByText("Active Projects")
        .closest("div");
      expect(within(activeProjectsSection).getByText("2")).toBeInTheDocument();

      const totalRequestsSection = screen
        .getByText("Total Requests")
        .closest("div");
      expect(within(totalRequestsSection).getByText("3")).toBeInTheDocument();

      // Component looks for status codes >= 400, so count should be 1 for the 500 status
      const failedRequestsSection = screen
        .getByText("Failed Requests")
        .closest("div");
      expect(within(failedRequestsSection).getByText("1")).toBeInTheDocument();

      const savedMocksSection = screen.getByText("Saved Mocks").closest("div");
      expect(within(savedMocksSection).getByText("2")).toBeInTheDocument();
    });

    test("should display all projects with correct information", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Check project names - use getAllByText since names appear multiple times
      const apiGatewayElements = screen.getAllByText("API Gateway");
      expect(apiGatewayElements.length).toBeGreaterThan(0);

      const authServiceElements = screen.getAllByText("Auth Service");
      expect(authServiceElements.length).toBeGreaterThan(0);

      // Check project status indicators
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Disabled")).toBeInTheDocument();

      // Check port information
      expect(screen.getByText(/Port 8080/)).toBeInTheDocument();
      expect(screen.getByText(/Port 8081/)).toBeInTheDocument();

      // Check target information
      expect(screen.getByText(/api.example.com:443/)).toBeInTheDocument();
    });

    test("should show correct request and mock counts per project", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Find projects section and look for request/mock counts
      const projectsSection = screen.getByText("Projects").closest("div");

      // API Gateway should have 2 requests, 1 mock
      const apiGatewayElements =
        within(projectsSection).getAllByText("API Gateway");
      const apiGatewaySection = apiGatewayElements[0].closest("div");
      expect(within(apiGatewaySection).getByText("2 req")).toBeInTheDocument();
      expect(
        within(apiGatewaySection).getByText("1 mocks")
      ).toBeInTheDocument();

      // Auth Service should have 1 request, 1 mock
      const authServiceElements =
        within(projectsSection).getAllByText("Auth Service");
      const authServiceSection = authServiceElements[0].closest("div");
      expect(within(authServiceSection).getByText("1 req")).toBeInTheDocument();
      expect(
        within(authServiceSection).getByText("1 mocks")
      ).toBeInTheDocument();
    });

    test("should call onSelectProject when project is clicked", async () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Find the projects section first to avoid confusion with recent activity
      const projectsSection = screen.getByText("Projects").closest("div");
      const apiGatewayElements =
        within(projectsSection).getAllByText("API Gateway");
      const projectElement = apiGatewayElements[0].closest("div");
      await userEvent.click(projectElement);

      expect(mockProps.onSelectProject).toHaveBeenCalledWith(mockProjects[0]);
    });

    test("should not allow clicking disabled projects", async () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Find the Auth Service project - it might be the second occurrence
      const authServiceElements = screen.getAllByText("Auth Service");
      const disabledProject = authServiceElements[0].closest("div");
      await userEvent.click(disabledProject);

      // Should not call onSelectProject for disabled project
      expect(mockProps.onSelectProject).not.toHaveBeenCalled();
    });

    test("should display recent activity", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Check recent activity section
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();

      // Should show request methods (there are multiple GET requests, so use getAllByText)
      const getMethods = screen.getAllByText("GET");
      expect(getMethods.length).toBeGreaterThan(0);

      expect(screen.getByText("POST")).toBeInTheDocument();
      expect(screen.getByText("/api/users")).toBeInTheDocument();
      expect(screen.getByText("/api/auth")).toBeInTheDocument();
      expect(screen.getByText("/health")).toBeInTheDocument();
    });

    test("should show project names in recent activity", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={mockProjects}
          requests={mockRequests}
          mocks={mockMocks}
        />
      );

      // Recent activity should show project names
      // Allow for flexibility in how many times project names appear
      const apiGatewayElements = screen.getAllByText("API Gateway");
      expect(apiGatewayElements.length).toBeGreaterThanOrEqual(2); // At least in projects and recent activity

      const authServiceElements = screen.getAllByText("Auth Service");
      expect(authServiceElements.length).toBeGreaterThanOrEqual(1); // At least in projects
    });
  });

  describe("Responsive Design", () => {
    test("should adapt to mobile viewport", () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<DashboardView {...mockProps} />);

      // Check that mobile classes are applied
      const statsGrid = screen.getByText("Dashboard").nextElementSibling;
      expect(statsGrid).toHaveClass("grid-cols-2"); // Mobile: 2 columns
    });

    test("should adapt to desktop viewport", () => {
      // Mock desktop viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<DashboardView {...mockProps} />);

      // Check that desktop classes are applied
      const statsGrid = screen.getByText("Dashboard").nextElementSibling;
      expect(statsGrid).toHaveClass("lg:grid-cols-4"); // Desktop: 4 columns
    });
  });

  describe("Dark Mode Support", () => {
    test("should support dark mode classes", () => {
      // Mock dark mode
      document.documentElement.classList.add("dark");

      render(<DashboardView {...mockProps} />);

      // Check for dark mode classes
      const title = screen.getByText("Dashboard");
      expect(title).toHaveClass("dark:text-white");

      // Cleanup
      document.documentElement.classList.remove("dark");
    });
  });

  describe("Real-time Updates", () => {
    test("should update stats when props change", async () => {
      const { rerender } = render(<DashboardView {...mockProps} />);

      // Initially should show 0 for active projects
      const activeProjectsSection = screen
        .getByText("Active Projects")
        .closest("div");
      expect(within(activeProjectsSection).getByText("0")).toBeInTheDocument();

      // Add a project
      const newProps = {
        ...mockProps,
        projects: [mockDataGenerators.project()],
      };

      rerender(<DashboardView {...newProps} />);

      // Should now show 1 for active projects
      await waitFor(() => {
        const updatedActiveProjectsSection = screen
          .getByText("Active Projects")
          .closest("div");
        expect(
          within(updatedActiveProjectsSection).getByText("1")
        ).toBeInTheDocument();
      });
    });

    test("should handle empty requests gracefully", () => {
      render(
        <DashboardView
          {...mockProps}
          projects={[mockDataGenerators.project()]}
          requests={[]}
          mocks={[]}
        />
      );

      // Look for the exact text that appears in the component
      expect(screen.getByText(/No requests captured yet/)).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    test("should handle large numbers of projects efficiently", () => {
      const manyProjects = Array.from({ length: 50 }, (_, i) =>
        mockDataGenerators.project({
          port: 8000 + i,
          name: `Project ${i}`,
        })
      );

      const renderStart = performance.now();
      render(<DashboardView {...mockProps} projects={manyProjects} />);
      const renderEnd = performance.now();

      // Should render within reasonable time (< 200ms to account for CI environment)
      expect(renderEnd - renderStart).toBeLessThan(200);

      // Should still show correct count in Active Projects section
      const activeProjectsSection = screen
        .getByText("Active Projects")
        .closest("div");
      expect(within(activeProjectsSection).getByText("50")).toBeInTheDocument();
    });

    test("should handle large numbers of requests efficiently", () => {
      const manyRequests = Array.from({ length: 1000 }, (_, i) =>
        mockDataGenerators.request({
          id: `req-${i}`,
          path: `/api/endpoint-${i}`,
        })
      );

      const renderStart = performance.now();
      render(<DashboardView {...mockProps} requests={manyRequests} />);
      const renderEnd = performance.now();

      // Should render within reasonable time
      expect(renderEnd - renderStart).toBeLessThan(200);

      // Should show correct total in Total Requests section
      const totalRequestsSection = screen
        .getByText("Total Requests")
        .closest("div");
      expect(
        within(totalRequestsSection).getByText("1000")
      ).toBeInTheDocument();

      // Recent activity should only show 5 items max
      const recentActivity = screen.getByText("Recent Activity").closest("div");
      const activityItems =
        within(recentActivity).queryAllByText(/\/api\/endpoint-/);
      expect(activityItems.length).toBeLessThanOrEqual(5);
    });
  });
});
