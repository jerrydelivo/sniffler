// React Testing utilities for UI tests
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock data generators
export const mockDataGenerators = {
  project: (overrides = {}) => ({
    port: 8080,
    name: "Test Project",
    targetHost: "localhost",
    targetPort: 3000,
    status: "running",
    disabled: false,
    mocksEnabled: true,
    autoMockEnabled: false,
    ...overrides,
  }),

  request: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    method: "GET",
    url: "/api/test",
    path: "/api/test",
    status: 200,
    timestamp: new Date().toISOString(),
    duration: 150,
    proxyPort: 8080,
    headers: { "content-type": "application/json" },
    body: null,
    response: { success: true },
    ...overrides,
  }),

  mock: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    method: "GET",
    url: "/api/mock",
    pattern: "/api/mock",
    response: { mock: true },
    statusCode: 200,
    enabled: true,
    proxyPort: 8080,
    headers: { "content-type": "application/json" },
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  databaseProxy: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    name: "Test Database",
    protocol: "postgresql",
    targetHost: "localhost",
    targetPort: 5432,
    port: 5433,
    isRunning: false,
    queryCount: 0,
    ...overrides,
  }),

  databaseQuery: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    query: "SELECT * FROM users",
    timestamp: new Date().toISOString(),
    duration: 50,
    protocol: "postgresql",
    proxyPort: 5433,
    status: "success",
    type: "SELECT",
    ...overrides,
  }),
};

// Component testing utilities
export const renderWithMocks = (component, mocks = {}) => {
  // Set up default mocks
  const defaultMocks = {
    projects: [],
    requests: [],
    mocks: [],
    databaseProxies: [],
    ...mocks,
  };

  // Configure electron API mocks
  if (defaultMocks.projects.length > 0) {
    global.window.electronAPI.getProxies.mockResolvedValue(
      defaultMocks.projects
    );
  }

  if (defaultMocks.requests.length > 0) {
    global.window.electronAPI.getRequests.mockResolvedValue({
      success: true,
      requests: defaultMocks.requests,
    });
  }

  if (defaultMocks.mocks.length > 0) {
    global.window.electronAPI.getMocks.mockResolvedValue({
      success: true,
      mocks: defaultMocks.mocks,
    });
  }

  return render(component);
};

// Interaction helpers
export const userActions = {
  async clickButton(name) {
    // First try to find by role with exact name
    let button = screen.queryByRole("button", { name: name });

    // If not found, try to find by role with flexible matching
    if (!button) {
      button = screen.queryByRole("button", { name: new RegExp(name, "i") });
    }

    // If not found, try to find by text content
    if (!button) {
      button = screen.queryByText(name);
    }

    // If not found, try text content with regex
    if (!button) {
      button = screen.queryByText(new RegExp(name, "i"));
    }

    // If still not found, try a more flexible approach
    if (!button) {
      const buttons = screen.getAllByRole("button");
      button = buttons.find(
        (btn) =>
          btn.textContent.includes(name) ||
          btn.getAttribute("title")?.includes(name) ||
          btn.getAttribute("aria-label")?.includes(name)
      );
    }

    // If still not found, try looking for buttons that contain the text anywhere
    if (!button) {
      const allElements = screen.queryAllByText(new RegExp(name, "i"));
      button = allElements.find((el) => el.closest("button"));
    }

    if (!button) {
      // Log available buttons for debugging
      const availableButtons = screen.getAllByRole("button").map((btn) => ({
        text: btn.textContent,
        title: btn.getAttribute("title"),
        ariaLabel: btn.getAttribute("aria-label"),
      }));
      console.warn(
        `Button "${name}" not found. Available buttons:`,
        availableButtons
      );
      throw new Error(`Button with name "${name}" not found`);
    }

    // Find the actual button element if we found a nested element
    const actualButton = button.closest("button") || button;

    await act(async () => {
      await userEvent.click(actualButton);
    });
    return actualButton;
  },

  async fillInput(label, value) {
    const input = screen.getByLabelText(label);
    await act(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, value);
    });
    return input;
  },

  async selectOption(label, value) {
    const select = screen.getByLabelText(label);
    await act(async () => {
      await userEvent.selectOptions(select, value);
    });
    return select;
  },

  async fillForm(formData) {
    for (const [label, value] of Object.entries(formData)) {
      await this.fillInput(label, value);
    }
  },

  async waitForElement(element, timeout = 5000) {
    await waitFor(
      () => {
        expect(element).toBeInTheDocument();
      },
      { timeout }
    );
  },

  async waitForText(text, timeout = 5000) {
    await waitFor(
      () => {
        expect(screen.getByText(text)).toBeInTheDocument();
      },
      { timeout }
    );
  },
};

// Assertion helpers
export const expectHelpers = {
  toBeVisible(element) {
    expect(element).toBeInTheDocument();
    expect(element).toBeVisible();
  },

  toHaveText(element, text) {
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent(text);
  },

  toBeDisabled(element) {
    expect(element).toBeInTheDocument();
    expect(element).toBeDisabled();
  },

  toBeEnabled(element) {
    expect(element).toBeInTheDocument();
    expect(element).not.toBeDisabled();
  },

  toHaveClass(element, className) {
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass(className);
  },

  async toShowModal(modalTitle) {
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(modalTitle)).toBeInTheDocument();
    });
  },

  async toHideModal() {
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  },
};

// Mock response helpers
export const mockResponses = {
  success: (data = {}) => ({
    success: true,
    ...data,
  }),

  error: (message = "Test error", data = {}) => ({
    success: false,
    error: message,
    ...data,
  }),

  projects: (projects = []) => ({
    success: true,
    projects,
  }),

  requests: (requests = []) => ({
    success: true,
    requests,
  }),

  mocks: (mocks = []) => ({
    success: true,
    mocks,
  }),
};

// Navigation helpers
export const navigationHelpers = {
  async navigateToView(viewName) {
    const navItem = screen.getByRole("button", {
      name: new RegExp(viewName, "i"),
    });
    await act(async () => {
      await userEvent.click(navItem);
    });
    await waitFor(() => {
      expect(navItem).toHaveClass("bg-blue-100");
    });
  },

  async navigateToProject(projectName) {
    const projectItem = screen.getByText(projectName);
    await act(async () => {
      await userEvent.click(projectItem);
    });
    await waitFor(() => {
      expect(screen.getByText(projectName)).toBeInTheDocument();
    });
  },
};

// Export all testing utilities
export { render, screen, fireEvent, waitFor, within, userEvent, act, React };
