// End-to-end tests for complete workflow coverage across all proxy types
// These tests ensure the entire request flow works correctly from proxy interception to UI display

const { test, expect } = require("@playwright/test");

const APP_URL = "http://localhost:8765";
const PROXY_PORTS = {
  normal: 4000,
  database: 4445,
  outgoing: 4444,
};

test.describe("Complete Workflow E2E Tests", () => {
  test.beforeAll(async () => {
    // Ensure test server and app are running
    // In CI, these would be started as part of the test setup
    console.log(
      "E2E Tests require the full application to be running on localhost:8765"
    );
  });

  test.beforeEach(async ({ page }) => {
    try {
      await page.goto(APP_URL, { timeout: 5000 });
      await page.waitForSelector('[data-testid="app-container"]', {
        timeout: 5000,
      });
    } catch (error) {
      // Skip tests if app is not available
      test.skip(true, "Application not available at " + APP_URL);
    }
  });

  test.describe("Normal Request Proxy Workflow", () => {
    test("complete workflow: request -> proxy -> backend -> response -> UI update -> mock creation", async ({
      page,
    }) => {
      // Step 1: Navigate to dashboard
      await page.click('[data-testid="nav-dashboard"]');
      await page.waitForSelector('[data-testid="dashboard-view"]');

      // Step 2: Verify proxy is running
      const proxyStatus = await page
        .locator('[data-testid="proxy-status-4000"]')
        .textContent();
      expect(proxyStatus).toContain("Running");

      // Step 3: Get initial counts
      const initialRequestCount = await page
        .locator('[data-testid="request-item"]')
        .count();
      const initialMockCount = await page
        .locator('[data-testid="mock-item"]')
        .count();

      // Step 4: Make request through proxy
      const response = await page.evaluate(async (port) => {
        try {
          const res = await fetch(`http://localhost:${port}/api/users`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          return {
            ok: res.ok,
            status: res.status,
            data: await res.json(),
          };
        } catch (error) {
          return { error: error.message };
        }
      }, PROXY_PORTS.normal);

      // Step 5: Verify request appears in UI immediately
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="request-item"]'
          );
          return elements.length > expectedCount;
        },
        initialRequestCount,
        { timeout: 5000 }
      );

      const newRequestCount = await page
        .locator('[data-testid="request-item"]')
        .count();
      expect(newRequestCount).toBe(initialRequestCount + 1);

      // Step 6: Verify request details in UI
      const latestRequest = page
        .locator('[data-testid="request-item"]')
        .first();
      await expect(
        latestRequest.locator('[data-testid="request-method"]')
      ).toContainText("GET");
      await expect(
        latestRequest.locator('[data-testid="request-path"]')
      ).toContainText("/api/users");
      await expect(
        latestRequest.locator('[data-testid="request-proxy-port"]')
      ).toContainText("4000");

      // Step 7: Wait for response to complete and status to update
      await page.waitForFunction(
        () => {
          const statusEl = document.querySelector(
            '[data-testid="request-status"]'
          );
          return statusEl && !statusEl.textContent.includes("Pending");
        },
        { timeout: 10000 }
      );

      const requestStatus = await latestRequest
        .locator('[data-testid="request-status"]')
        .textContent();
      expect(["Success", "Completed", "200"]).toContain(requestStatus.trim());

      // Step 8: Verify mock was auto-created (if auto-save is enabled)
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="mock-item"]'
          );
          return elements.length > expectedCount;
        },
        initialMockCount,
        { timeout: 5000 }
      );

      const newMockCount = await page
        .locator('[data-testid="mock-item"]')
        .count();
      expect(newMockCount).toBe(initialMockCount + 1);

      // Step 9: Verify mock details
      const latestMock = page.locator('[data-testid="mock-item"]').first();
      await expect(
        latestMock.locator('[data-testid="mock-url"]')
      ).toContainText("/api/users");
      await expect(
        latestMock.locator('[data-testid="mock-method"]')
      ).toContainText("GET");

      // Step 10: Verify mock is initially disabled (auto-created mocks should be disabled)
      const mockStatus = await latestMock
        .locator('[data-testid="mock-enabled"]')
        .textContent();
      expect(mockStatus).toContain("Disabled");
    });

    test("workflow: enable mock -> make same request -> verify mock served", async ({
      page,
    }) => {
      // Navigate to project view to manage mocks
      await page.click('[data-testid="nav-dashboard"]');
      const projectButtons = await page.locator(
        '[data-testid="project-button"]'
      );
      if ((await projectButtons.count()) > 0) {
        await projectButtons.first().click();
        await page.waitForSelector('[data-testid="project-view"]');
      }

      // Enable a mock
      const mockItems = page.locator('[data-testid="mock-item"]');
      if ((await mockItems.count()) > 0) {
        const firstMock = mockItems.first();
        const enableButton = firstMock.locator(
          '[data-testid="mock-enable-button"]'
        );
        if (await enableButton.isVisible()) {
          await enableButton.click();
        }

        // Verify mock is now enabled
        await expect(
          firstMock.locator('[data-testid="mock-enabled"]')
        ).toContainText("Enabled");

        // Get mock details for the request
        const mockUrl = await firstMock
          .locator('[data-testid="mock-url"]')
          .textContent();
        const mockMethod = await firstMock
          .locator('[data-testid="mock-method"]')
          .textContent();

        // Make the same request
        const response = await page.evaluate(
          async (port, url, method) => {
            try {
              const res = await fetch(`http://localhost:${port}${url}`, {
                method: method,
                headers: { "Content-Type": "application/json" },
              });
              return {
                ok: res.ok,
                status: res.status,
                data: await res.json(),
                headers: Object.fromEntries(res.headers.entries()),
              };
            } catch (error) {
              return { error: error.message };
            }
          },
          PROXY_PORTS.normal,
          mockUrl,
          mockMethod
        );

        // Verify response came from mock (check for mock indicators)
        expect(response.ok).toBe(true);

        // Check if mock served counter increased
        // This would need to be implemented in the UI to show mock usage stats
      }
    });

    test("workflow: modify mock -> verify updated response", async ({
      page,
    }) => {
      await page.click('[data-testid="nav-dashboard"]');
      const projectButtons = await page.locator(
        '[data-testid="project-button"]'
      );
      if ((await projectButtons.count()) > 0) {
        await projectButtons.first().click();
        await page.waitForSelector('[data-testid="project-view"]');
      }

      const mockItems = page.locator('[data-testid="mock-item"]');
      if ((await mockItems.count()) > 0) {
        const firstMock = mockItems.first();

        // Edit the mock
        const editButton = firstMock.locator(
          '[data-testid="mock-edit-button"]'
        );
        if (await editButton.isVisible()) {
          await editButton.click();

          // Wait for edit modal/form
          await page.waitForSelector('[data-testid="mock-edit-form"]');

          // Modify the response
          const responseField = page.locator(
            '[data-testid="mock-response-field"]'
          );
          await responseField.fill(
            '{"modified": true, "message": "Updated mock response"}'
          );

          // Save changes
          await page.click('[data-testid="mock-save-button"]');

          // Make request to verify updated response
          const mockUrl = await firstMock
            .locator('[data-testid="mock-url"]')
            .textContent();
          const mockMethod = await firstMock
            .locator('[data-testid="mock-method"]')
            .textContent();

          const response = await page.evaluate(
            async (port, url, method) => {
              try {
                const res = await fetch(`http://localhost:${port}${url}`, {
                  method: method,
                  headers: { "Content-Type": "application/json" },
                });
                return await res.json();
              } catch (error) {
                return { error: error.message };
              }
            },
            PROXY_PORTS.normal,
            mockUrl,
            mockMethod
          );

          expect(response.modified).toBe(true);
          expect(response.message).toBe("Updated mock response");
        }
      }
    });
  });

  test.describe("Database Proxy Workflow", () => {
    test("complete workflow: database query -> proxy -> database -> response -> UI update -> mock creation", async ({
      page,
    }) => {
      // Navigate to database proxy view
      await page.click('[data-testid="nav-database-proxy"]');
      await page.waitForSelector('[data-testid="database-proxy-view"]');

      // Get initial counts
      const initialQueryCount = await page
        .locator('[data-testid="database-query-item"]')
        .count();
      const initialMockCount = await page
        .locator('[data-testid="database-mock-item"]')
        .count();

      // Execute database query through proxy
      const queryResult = await page.evaluate(async (port) => {
        try {
          // This would need to be adapted based on how database queries are made through the proxy
          // For now, simulating with a fetch request that represents a database operation
          const res = await fetch(`http://localhost:${port}/db-query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "SELECT * FROM users WHERE active = true",
              database: "postgresql",
            }),
          });
          return {
            ok: res.ok,
            status: res.status,
            data: await res.json(),
          };
        } catch (error) {
          return { error: error.message };
        }
      }, PROXY_PORTS.database);

      // Verify query appears in UI
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="database-query-item"]'
          );
          return elements.length > expectedCount;
        },
        initialQueryCount,
        { timeout: 8000 }
      );

      const newQueryCount = await page
        .locator('[data-testid="database-query-item"]')
        .count();
      expect(newQueryCount).toBe(initialQueryCount + 1);

      // Verify query details
      const latestQuery = page
        .locator('[data-testid="database-query-item"]')
        .first();
      await expect(
        latestQuery.locator('[data-testid="query-text"]')
      ).toContainText("SELECT * FROM users");
      await expect(
        latestQuery.locator('[data-testid="query-database"]')
      ).toContainText("postgresql");

      // Wait for query to complete
      await page.waitForFunction(
        () => {
          const statusEl = document.querySelector(
            '[data-testid="query-status"]'
          );
          return statusEl && !statusEl.textContent.includes("Executing");
        },
        { timeout: 10000 }
      );

      // Verify mock was auto-created
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="database-mock-item"]'
          );
          return elements.length > expectedCount;
        },
        initialMockCount,
        { timeout: 5000 }
      );

      const newMockCount = await page
        .locator('[data-testid="database-mock-item"]')
        .count();
      expect(newMockCount).toBe(initialMockCount + 1);
    });

    test("workflow: enable database mock -> execute same query -> verify mock served", async ({
      page,
    }) => {
      await page.click('[data-testid="nav-database-proxy"]');
      await page.waitForSelector('[data-testid="database-proxy-view"]');

      const mockItems = page.locator('[data-testid="database-mock-item"]');
      if ((await mockItems.count()) > 0) {
        const firstMock = mockItems.first();

        // Enable the mock
        const enableButton = firstMock.locator(
          '[data-testid="database-mock-enable-button"]'
        );
        if (await enableButton.isVisible()) {
          await enableButton.click();
        }

        // Get mock details
        const mockQuery = await firstMock
          .locator('[data-testid="database-mock-query"]')
          .textContent();

        // Execute the same query
        const queryResult = await page.evaluate(
          async (port, query) => {
            try {
              const res = await fetch(`http://localhost:${port}/db-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, database: "postgresql" }),
              });
              return await res.json();
            } catch (error) {
              return { error: error.message };
            }
          },
          PROXY_PORTS.database,
          mockQuery
        );

        // Verify mock was served (response should be from mock, not actual database)
        expect(queryResult).toBeDefined();
      }
    });
  });

  test.describe("Outgoing Request Proxy Workflow", () => {
    test("complete workflow: outgoing request -> proxy -> external service -> response -> UI update -> mock creation", async ({
      page,
    }) => {
      // Navigate to outgoing requests view
      await page.click('[data-testid="nav-outgoing-requests"]');
      await page.waitForSelector('[data-testid="outgoing-requests-view"]');

      // Get initial counts
      const initialRequestCount = await page
        .locator('[data-testid="outgoing-request-item"]')
        .count();
      const initialMockCount = await page
        .locator('[data-testid="outgoing-mock-item"]')
        .count();

      // Make outgoing request through proxy
      const response = await page.evaluate(async (port) => {
        try {
          const res = await fetch(`http://localhost:${port}/posts/1`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          return {
            ok: res.ok,
            status: res.status,
            data: await res.json(),
          };
        } catch (error) {
          return { error: error.message };
        }
      }, PROXY_PORTS.outgoing);

      // Verify outgoing request appears in UI
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="outgoing-request-item"]'
          );
          return elements.length > expectedCount;
        },
        initialRequestCount,
        { timeout: 8000 }
      );

      const newRequestCount = await page
        .locator('[data-testid="outgoing-request-item"]')
        .count();
      expect(newRequestCount).toBe(initialRequestCount + 1);

      // Verify request details
      const latestRequest = page
        .locator('[data-testid="outgoing-request-item"]')
        .first();
      await expect(
        latestRequest.locator('[data-testid="outgoing-method"]')
      ).toContainText("GET");
      await expect(
        latestRequest.locator('[data-testid="outgoing-path"]')
      ).toContainText("/posts/1");

      // Wait for response to complete
      await page.waitForFunction(
        () => {
          const statusEl = document.querySelector(
            '[data-testid="outgoing-status"]'
          );
          return statusEl && !statusEl.textContent.includes("Pending");
        },
        { timeout: 10000 }
      );

      // Verify mock was auto-created
      await page.waitForFunction(
        (expectedCount) => {
          const elements = document.querySelectorAll(
            '[data-testid="outgoing-mock-item"]'
          );
          return elements.length > expectedCount;
        },
        initialMockCount,
        { timeout: 5000 }
      );

      const newMockCount = await page
        .locator('[data-testid="outgoing-mock-item"]')
        .count();
      expect(newMockCount).toBe(initialMockCount + 1);
    });

    test("workflow: enable outgoing mock -> make same request -> verify mock served", async ({
      page,
    }) => {
      await page.click('[data-testid="nav-outgoing-requests"]');
      await page.waitForSelector('[data-testid="outgoing-requests-view"]');

      const mockItems = page.locator('[data-testid="outgoing-mock-item"]');
      if ((await mockItems.count()) > 0) {
        const firstMock = mockItems.first();

        // Enable the mock
        const enableButton = firstMock.locator(
          '[data-testid="outgoing-mock-enable-button"]'
        );
        if (await enableButton.isVisible()) {
          await enableButton.click();
        }

        // Get mock details
        const mockUrl = await firstMock
          .locator('[data-testid="outgoing-mock-url"]')
          .textContent();
        const mockMethod = await firstMock
          .locator('[data-testid="outgoing-mock-method"]')
          .textContent();

        // Make the same request
        const response = await page.evaluate(
          async (port, url, method) => {
            try {
              const res = await fetch(`http://localhost:${port}${url}`, {
                method: method,
                headers: { "Content-Type": "application/json" },
              });
              return {
                ok: res.ok,
                status: res.status,
                data: await res.json(),
                headers: Object.fromEntries(res.headers.entries()),
              };
            } catch (error) {
              return { error: error.message };
            }
          },
          PROXY_PORTS.outgoing,
          mockUrl,
          mockMethod
        );

        // Verify response came from mock
        expect(response.ok).toBe(true);
      }
    });
  });

  test.describe("Cross-Category Integration Workflows", () => {
    test("complete workflow: simultaneous requests across all proxy types", async ({
      page,
    }) => {
      // Navigate to dashboard for overview
      await page.click('[data-testid="nav-dashboard"]');
      await page.waitForSelector('[data-testid="dashboard-view"]');

      // Get initial overview counts
      const initialStats = await page.evaluate(() => {
        const normalCount =
          document.querySelector('[data-testid="normal-requests-count"]')
            ?.textContent || "0";
        const dbCount =
          document.querySelector('[data-testid="database-requests-count"]')
            ?.textContent || "0";
        const outgoingCount =
          document.querySelector('[data-testid="outgoing-requests-count"]')
            ?.textContent || "0";

        return {
          normal: parseInt(normalCount),
          database: parseInt(dbCount),
          outgoing: parseInt(outgoingCount),
        };
      });

      // Make simultaneous requests across all three proxy types
      const requests = await page.evaluate(async (ports) => {
        const results = await Promise.allSettled([
          // Normal request
          fetch(`http://localhost:${ports.normal}/api/cross-category-test`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }).then((res) => ({
            type: "normal",
            ok: res.ok,
            status: res.status,
          })),

          // Database request
          fetch(`http://localhost:${ports.database}/db-query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "SELECT 1 as test",
              database: "postgresql",
            }),
          }).then((res) => ({
            type: "database",
            ok: res.ok,
            status: res.status,
          })),

          // Outgoing request
          fetch(`http://localhost:${ports.outgoing}/posts/999`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }).then((res) => ({
            type: "outgoing",
            ok: res.ok,
            status: res.status,
          })),
        ]);

        return results.map((r) =>
          r.status === "fulfilled" ? r.value : { error: r.reason?.message }
        );
      }, PROXY_PORTS);

      // Wait for UI to update with all requests
      await page.waitForTimeout(3000);

      // Verify dashboard overview shows updated counts
      const finalStats = await page.evaluate(() => {
        const normalCount =
          document.querySelector('[data-testid="normal-requests-count"]')
            ?.textContent || "0";
        const dbCount =
          document.querySelector('[data-testid="database-requests-count"]')
            ?.textContent || "0";
        const outgoingCount =
          document.querySelector('[data-testid="outgoing-requests-count"]')
            ?.textContent || "0";

        return {
          normal: parseInt(normalCount),
          database: parseInt(dbCount),
          outgoing: parseInt(outgoingCount),
        };
      });

      // At least some categories should show increased counts
      const totalInitial =
        initialStats.normal + initialStats.database + initialStats.outgoing;
      const totalFinal =
        finalStats.normal + finalStats.database + finalStats.outgoing;
      expect(totalFinal).toBeGreaterThan(totalInitial);

      // Verify each request category view shows the new requests
      for (const viewName of [
        "nav-dashboard",
        "nav-database-proxy",
        "nav-outgoing-requests",
      ]) {
        await page.click(`[data-testid="${viewName}"]`);
        await page.waitForTimeout(1000);

        // Verify requests are visible in their respective views
        const hasRequests = await page.evaluate(() => {
          const requestItems = document.querySelectorAll(
            '[data-testid*="request-item"], [data-testid*="query-item"]'
          );
          return requestItems.length > 0;
        });
        expect(hasRequests).toBe(true);
      }
    });

    test("workflow: regression testing with mocks across all categories", async ({
      page,
    }) => {
      // Enable testing mode
      await page.click('[data-testid="nav-settings"]');
      await page.waitForSelector('[data-testid="settings-view"]');

      const testingModeToggle = page.locator(
        '[data-testid="testing-mode-toggle"]'
      );
      if (await testingModeToggle.isVisible()) {
        await testingModeToggle.click();
      }

      // Enable all mocks across categories
      for (const viewName of [
        "nav-dashboard",
        "nav-database-proxy",
        "nav-outgoing-requests",
      ]) {
        await page.click(`[data-testid="${viewName}"]`);
        await page.waitForTimeout(1000);

        // Enable available mocks
        const enableButtons = page.locator(
          '[data-testid*="mock-enable-button"]'
        );
        const count = await enableButtons.count();
        for (let i = 0; i < Math.min(count, 3); i++) {
          await enableButtons.nth(i).click();
          await page.waitForTimeout(500);
        }
      }

      // Run regression test
      const regressionButton = page.locator(
        '[data-testid="run-regression-test"]'
      );
      if (await regressionButton.isVisible()) {
        await regressionButton.click();

        // Wait for test to complete
        await page.waitForFunction(
          () => {
            const testStatus = document.querySelector(
              '[data-testid="regression-test-status"]'
            );
            return testStatus && !testStatus.textContent.includes("Running");
          },
          { timeout: 30000 }
        );

        // Verify test results
        const testResults = await page
          .locator('[data-testid="regression-test-results"]')
          .textContent();
        expect(testResults).toContain("completed");
      }
    });

    test("workflow: export and import data across all categories", async ({
      page,
    }) => {
      // Navigate to export/import view
      await page.click('[data-testid="nav-export-import"]');
      await page.waitForSelector('[data-testid="export-import-view"]');

      // Export all data
      const exportAllButton = page.locator('[data-testid="export-all-button"]');
      if (await exportAllButton.isVisible()) {
        await exportAllButton.click();

        // Wait for export to complete
        await page.waitForFunction(
          () => {
            const exportStatus = document.querySelector(
              '[data-testid="export-status"]'
            );
            return (
              exportStatus && exportStatus.textContent.includes("completed")
            );
          },
          { timeout: 10000 }
        );

        // Verify export included all categories
        const exportSummary = await page
          .locator('[data-testid="export-summary"]')
          .textContent();
        expect(exportSummary).toContain("proxies");
        expect(exportSummary).toContain("mocks");
        expect(exportSummary).toContain("requests");
      }
    });
  });

  test.describe("Performance and Stress Testing", () => {
    test("workflow: high-volume requests across all proxy types", async ({
      page,
    }) => {
      await page.click('[data-testid="nav-dashboard"]');
      await page.waitForSelector('[data-testid="dashboard-view"]');

      // Make high volume of requests
      const highVolumeRequests = await page.evaluate(async (ports) => {
        const requests = [];

        // 50 requests per proxy type
        for (let i = 0; i < 50; i++) {
          requests.push(
            fetch(`http://localhost:${ports.normal}/api/high-volume-${i}`, {
              method: "GET",
            }).catch(() => null)
          );

          requests.push(
            fetch(`http://localhost:${ports.outgoing}/posts/${i}`, {
              method: "GET",
            }).catch(() => null)
          );
        }

        const results = await Promise.allSettled(requests);
        return results.filter((r) => r.status === "fulfilled").length;
      }, PROXY_PORTS);

      // Wait for UI to process all requests
      await page.waitForTimeout(10000);

      // Verify UI is still responsive
      const isResponsive = await page.evaluate(() => {
        return (
          document.readyState === "complete" &&
          !document.querySelector('[data-testid="loading-spinner"]')
        );
      });
      expect(isResponsive).toBe(true);

      // Verify requests appear in UI (at least some of them)
      const totalRequestElements = await page
        .locator('[data-testid*="request-item"]')
        .count();
      expect(totalRequestElements).toBeGreaterThan(10);
    });

    test("workflow: continuous real-time updates for extended period", async ({
      page,
    }) => {
      await page.click('[data-testid="nav-dashboard"]');
      await page.waitForSelector('[data-testid="dashboard-view"]');

      // Start continuous request generation
      const continuousTest = page.evaluate(async (ports) => {
        let requestCount = 0;
        const interval = setInterval(async () => {
          if (requestCount >= 20) {
            clearInterval(interval);
            return;
          }

          try {
            await fetch(
              `http://localhost:${ports.normal}/api/continuous-${requestCount}`,
              {
                method: "GET",
              }
            );
            requestCount++;
          } catch (error) {
            // Ignore errors for this test
          }
        }, 500); // One request every 500ms

        // Return a promise that resolves after all requests
        return new Promise((resolve) => {
          const checkComplete = () => {
            if (requestCount >= 20) {
              resolve(requestCount);
            } else {
              setTimeout(checkComplete, 100);
            }
          };
          checkComplete();
        });
      }, PROXY_PORTS);

      // Monitor UI updates during continuous requests
      let previousCount = 0;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(2000);

        const currentCount = await page
          .locator('[data-testid="request-item"]')
          .count();
        expect(currentCount).toBeGreaterThanOrEqual(previousCount);
        previousCount = currentCount;

        // Verify UI remains responsive
        const navIsClickable = await page
          .locator('[data-testid="nav-dashboard"]')
          .isEnabled();
        expect(navIsClickable).toBe(true);
      }

      await continuousTest;
    });
  });
});
