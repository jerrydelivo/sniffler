// Simple StatCard Component Test to verify testing setup
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StatCard component for testing
const StatCard = ({ title, value, icon, color }) => (
  <div className={`stat-card stat-card-${color}`} data-testid="stat-card">
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <h3 className="stat-title">{title}</h3>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

describe("StatCard Component (Setup Test)", () => {
  test("should render with correct props", () => {
    const mockIcon = <span data-testid="mock-icon">📊</span>;

    render(
      <StatCard title="Test Stat" value={42} icon={mockIcon} color="blue" />
    );

    // Check if component renders correctly
    expect(screen.getByTestId("stat-card")).toBeInTheDocument();
    expect(screen.getByText("Test Stat")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByTestId("mock-icon")).toBeInTheDocument();

    // Check CSS classes
    const statCard = screen.getByTestId("stat-card");
    expect(statCard).toHaveClass("stat-card-blue");
  });

  test("should handle different value types", () => {
    render(
      <StatCard
        title="String Value"
        value="Test String"
        icon={<span>📈</span>}
        color="green"
      />
    );

    expect(screen.getByText("String Value")).toBeInTheDocument();
    expect(screen.getByText("Test String")).toBeInTheDocument();
  });

  test("should apply different color classes", () => {
    const { rerender } = render(
      <StatCard
        title="Color Test"
        value={100}
        icon={<span>🎨</span>}
        color="red"
      />
    );

    const statCard = screen.getByTestId("stat-card");
    expect(statCard).toHaveClass("stat-card-red");

    // Rerender with different color
    rerender(
      <StatCard
        title="Color Test"
        value={100}
        icon={<span>🎨</span>}
        color="purple"
      />
    );

    expect(statCard).toHaveClass("stat-card-purple");
    expect(statCard).not.toHaveClass("stat-card-red");
  });

  test("should handle zero values correctly", () => {
    render(
      <StatCard
        title="Zero Value"
        value={0}
        icon={<span>0️⃣</span>}
        color="gray"
      />
    );

    expect(screen.getByText("Zero Value")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
