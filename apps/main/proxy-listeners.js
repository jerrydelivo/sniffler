const setupProxyEventListeners = (
  port,
  proxy,
  { mainWindow, dataManager, appSettings }
) => {
  if (!proxy) return;

  // Idempotency guard: ensure listeners are attached only once per proxy
  if (proxy.__listenersBound) {
    return;
  }

  // Basic validation and defaults
  const safeAppSettings = appSettings || { maxRequestHistory: 100 };

  // Request events
  proxy.on("request", (request) => {
    if (mainWindow) {
      mainWindow.webContents.send("proxy-request", {
        proxyId: port,
        request,
      });
    }
  });

  proxy.on("response", (data) => {
    // Normalize status for UI: map internal 'completed' to user-facing 'success' or 'failed'
    let normalizedStatus = data?.request?.status;
    if (normalizedStatus === "completed") {
      const code =
        data?.response?.statusCode ?? data?.request?.response?.statusCode;
      if (typeof code === "number") {
        normalizedStatus = code < 400 ? "success" : "failed";
      } else {
        normalizedStatus = "success"; // default to success when completed but no code available
      }
    }

    const normalizedRequest = data?.request
      ? { ...data.request, status: normalizedStatus }
      : data?.request;

    if (mainWindow) {
      mainWindow.webContents.send("proxy-response", {
        proxyId: port,
        request: normalizedRequest,
        response: data.response,
      });
    }

    // Auto-save requests (always enabled)
    if (dataManager && typeof dataManager.saveRequests === "function") {
      Promise.resolve(
        dataManager.saveRequests(
          port,
          proxy.getRequests(),
          safeAppSettings.maxRequestHistory
        )
      ).catch(() => {});
    }
  });

  // Mock served
  proxy.on("mock-served", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("mock-served", {
        proxyId: port,
        ...data,
      });
    }
  });

  // Auto-created mock
  proxy.on("mock-auto-created", async (data) => {
    try {
      if (dataManager && typeof dataManager.saveMocks === "function") {
        await dataManager.saveMocks(port, proxy.getMocks());
      }
      if (mainWindow) {
        mainWindow.webContents.send("mock-auto-created", {
          proxyId: port,
          mock: data.mock,
          request: data.request,
        });
      }
    } catch (_) {
      // swallow to avoid breaking UI on save failure
    }
  });

  // Difference and replacement notices (if emitted by proxy)
  proxy.on("mock-difference-detected", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("mock-difference-detected", {
        proxyId: port,
        request: data.request,
        mock: data.mock,
        comparison: data.comparison,
      });
    }
  });

  proxy.on("mock-auto-replaced", (data) => {
    if (mainWindow) {
      mainWindow.webContents.send("mock-auto-replaced", {
        proxyId: port,
        request: data.request,
        oldMock: data.oldMock,
        newMock: data.newMock,
        comparison: data.comparison,
      });
    }
  });

  // Save-mocks request
  proxy.on("save-mocks", async () => {
    try {
      if (dataManager && typeof dataManager.saveMocks === "function") {
        await dataManager.saveMocks(port, proxy.getMocks());
      }
    } catch (_) {}
  });

  // Errors
  proxy.on("error", (errorData) => {
    if (mainWindow) {
      mainWindow.webContents.send("proxy-error", {
        proxyId: port,
        ...errorData,
      });
    }
  });

  // Mark as bound to prevent duplicate bindings
  Object.defineProperty(proxy, "__listenersBound", {
    value: true,
    enumerable: false,
    writable: false,
  });
};

module.exports = { setupProxyEventListeners };
