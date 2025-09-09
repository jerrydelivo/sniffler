const { EventEmitter } = require("events");
const { Proxy: MitmProxy } = require("http-mitm-proxy");
const { URL } = require("url");
const zlib = require("zlib");
const { promisify } = require("util");

// Promisify compression methods for easier async handling
const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

class OutgoingInterceptor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.proxyServers = new Map(); // Map of proxy configurations and servers
    this.interceptedRequests = [];
    this.maxRequestHistory = config.maxRequestHistory || 100;
    this.maxMockHistory = config.maxMockHistory || 1000;
    this.outgoingMocks = new Map(); // Map to store mocks by proxy port and request signature
    this.testingMode = false;
    this.mockingEnabled = false;
    this.isInitializing = false; // Flag to prevent logging during initialization
    this.settings = {
      autoSaveRequestsAsMocks: true,
      enableDeduplication: true, // Enable request deduplication by default
      deduplicationWindow: 1000, // 1 second window for detecting duplicates
    };
    this.processedEvents = new Map(); // Track processed events to prevent duplicates
  }

  // Helper function to decompress response body based on content-encoding
  async decompressResponseBody(buffer, encoding) {
    if (!buffer || buffer.length === 0) {
      return "";
    }

    try {
      switch (encoding?.toLowerCase()) {
        case "gzip":
          const gzipResult = await gunzip(buffer);
          return gzipResult.toString("utf8");

        case "deflate":
          const deflateResult = await inflate(buffer);
          return deflateResult.toString("utf8");

        case "br":
        case "brotli":
          const brotliResult = await brotliDecompress(buffer);
          return brotliResult.toString("utf8");

        default:
          // No compression or unknown compression
          return buffer.toString("utf8");
      }
    } catch (error) {
      console.warn(
        `Failed to decompress response with encoding '${encoding}':`,
        error.message
      );
      // If decompression fails, treat as binary content
      return `[Compressed content: ${encoding}, ${buffer.length} bytes - decompression failed]`;
    }
  }

  // Create a proxy configuration
  createProxy(config) {
    try {
      const { port, targetUrl, name } = config;

      if (this.proxyServers.has(port)) {
        throw new Error(`Proxy already exists on port ${port}`);
      }

      const proxyConfig = {
        id: this.generateProxyId(),
        port: parseInt(port),
        targetUrl,
        name: name || `Proxy ${port}`,
        createdAt: new Date().toISOString(),
        isRunning: false,
        server: null,
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          activeConnections: 0,
          mocksServed: 0,
        },
      };

      this.proxyServers.set(port, proxyConfig);

      // Create a serializable version of the proxy config for the event
      const serializableConfig = {
        id: proxyConfig.id,
        port: proxyConfig.port,
        targetUrl: proxyConfig.targetUrl,
        name: proxyConfig.name,
        createdAt: proxyConfig.createdAt,
        isRunning: proxyConfig.isRunning,
        stats: proxyConfig.stats,
      };

      this.emit("proxy-created", serializableConfig);
      return proxyConfig;
    } catch (error) {
      this.emit("error", {
        error: error.message,
        type: "proxy-creation",
      });
      throw error;
    }
  }

  // Start a proxy server
  async startProxy(port) {
    try {
      console.log(`🔄 Starting outgoing proxy on port ${port}...`);
      const proxyConfig = this.proxyServers.get(port);
      if (!proxyConfig) {
        throw new Error(`Proxy not found on port ${port}`);
      }

      if (proxyConfig.isRunning) {
        console.log(`⚠️ Proxy is already running on port ${port}`);
        throw new Error(`Proxy is already running on port ${port}`);
      }

      const proxy = new MitmProxy();
      const targetUrl = new URL(proxyConfig.targetUrl);

      proxy.onError((ctx, err, errorKind) => {
        try {
          const requestId = ctx.snifflerRequestId;
          const request = this.interceptedRequests.find(
            (r) => r.id === requestId
          );
          if (request) {
            const endTime = Date.now();
            request.duration = endTime - request.startTime;
            request.status = "failed";
            request.error = err.message;
            request.response = {
              statusCode: 0,
              statusMessage: err.message,
              headers: {},
              body: null,
              duration: request.duration,
              timestamp: new Date().toISOString(),
            };

            proxyConfig.stats.failedRequests++;

            // Emit error event - only emit for real-time UI updates if not initializing
            if (!this.isInitializing) {
              this.emit("outgoing-error", request);
            } else {
              console.log(
                `🚫 INIT: Skipping error event emission during startup`
              );
            }
          }
        } catch (error) {
          this.emit("error", {
            error: error.message,
            type: "error-handling",
            port,
          });
        }
      });

      proxy.onRequest((ctx, callback) => {
        // Generate request ID first and store in context - needed for all requests
        const requestId = this.generateRequestId();
        ctx.snifflerRequestId = requestId;

        // Completely block requests during initialization to prevent phantom requests
        if (this.isInitializing) {
          console.log(
            `🚫 INITIALIZATION: Blocking request during startup for ${ctx.clientToProxyRequest.method} ${ctx.clientToProxyRequest.url}`
          );
          // Return error to completely block the request
          ctx.proxyToClientResponse.writeHead(
            503,
            "Service Unavailable - Sniffler Initializing"
          );
          ctx.proxyToClientResponse.end(
            "Sniffler is initializing, please wait"
          );
          return callback(new Error("Blocked during initialization"));
        }

        const startTime = Date.now();
        console.log(
          `🔍 REQUEST HANDLER: Creating request ID ${requestId} for ${
            ctx.clientToProxyRequest.method
          } ${ctx.clientToProxyRequest.url} at ${new Date().toISOString()}`
        );

        // Add request-level deduplication to prevent duplicate request processing
        const requestKey = `${ctx.clientToProxyRequest.method}-${ctx.clientToProxyRequest.url}`;
        if (this.isEventProcessed("outgoing-request", requestKey)) {
          console.log(
            `🔄 DEDUPLICATION: Skipping duplicate request processing for ${ctx.clientToProxyRequest.method} ${ctx.clientToProxyRequest.url}`
          );
          return callback();
        }

        try {
          const isTargetHttps = targetUrl.protocol === "https:";

          let requestPath = ctx.clientToProxyRequest.url;
          if (
            requestPath.startsWith("http://") ||
            requestPath.startsWith("https://")
          ) {
            try {
              const fullUrl = new URL(requestPath);
              requestPath = fullUrl.pathname + fullUrl.search + fullUrl.hash;
            } catch (e) {
              // Keep original if parsing fails
            }
          }

          // Check if request should be mocked during testing
          if (
            this.shouldMockRequest(
              port,
              ctx.clientToProxyRequest.method,
              requestPath
            )
          ) {
            const mock = this.getOutgoingMockByKey(
              port,
              ctx.clientToProxyRequest.method,
              requestPath
            );
            if (mock) {
              // Create intercepted request record for the mock
              const interceptedRequest = {
                id: requestId,
                timestamp: new Date().toISOString(),
                method: ctx.clientToProxyRequest.method,
                url: requestPath,
                fullTargetUrl: new URL(
                  requestPath,
                  proxyConfig.targetUrl
                ).toString(),
                hostname: targetUrl.hostname,
                port: targetUrl.port || (isTargetHttps ? 443 : 80),
                path: requestPath,
                headers: { ...ctx.clientToProxyRequest.headers },
                proxyPort: proxyConfig.port,
                proxyName: proxyConfig.name,
                status: "mocked",
                response: {
                  requestId: requestId,
                  statusCode: mock.statusCode,
                  statusMessage: "OK",
                  headers: { ...mock.headers, "X-Sniffler-Mock": "true" },
                  body: mock.body,
                  duration: 0,
                  timestamp: new Date().toISOString(),
                  mocked: true,
                },
                error: null,
                duration: 0,
                startTime: startTime,
                body: "",
              };

              // Capture request body
              let requestBodyBuffer = Buffer.alloc(0);
              ctx.clientToProxyRequest.on("data", (chunk) => {
                requestBodyBuffer = Buffer.concat([requestBodyBuffer, chunk]);
              });

              ctx.clientToProxyRequest.on("end", () => {
                try {
                  const contentType =
                    interceptedRequest.headers["content-type"] || "";

                  // Function to check if buffer contains binary data
                  const isBinaryData = (buffer) => {
                    if (buffer.length === 0) return false;
                    const sample = buffer.slice(
                      0,
                      Math.min(512, buffer.length)
                    );
                    for (let i = 0; i < sample.length; i++) {
                      const byte = sample[i];
                      // Check for null bytes or control characters (except common ones like \n, \r, \t)
                      if (
                        byte === 0 ||
                        (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)
                      ) {
                        return true;
                      }
                    }
                    return false;
                  };

                  // Check for text-based content types first
                  if (
                    contentType.includes("application/json") ||
                    contentType.includes("text/") ||
                    contentType.includes("application/xml") ||
                    contentType.includes("application/x-www-form-urlencoded") ||
                    contentType.includes("application/javascript") ||
                    contentType.includes("application/x-javascript")
                  ) {
                    interceptedRequest.body =
                      requestBodyBuffer.toString("utf8");
                  } else if (requestBodyBuffer.length > 0) {
                    // Check if it's actually binary data
                    if (isBinaryData(requestBodyBuffer)) {
                      interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                    } else {
                      // Try to decode as text but check for corruption
                      try {
                        const decoded = requestBodyBuffer.toString("utf8");
                        if (decoded.includes("\uFFFD")) {
                          interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                        } else {
                          interceptedRequest.body = decoded;
                        }
                      } catch (decodeError) {
                        interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                      }
                    }
                  } else {
                    interceptedRequest.body = "";
                  }
                } catch (err) {
                  interceptedRequest.body = `[Request processing error: ${err.message}, ${requestBodyBuffer.length} bytes]`;
                }

                // Add to intercepted requests list only if not initializing (to prevent phantom requests)
                if (!this.isInitializing) {
                  this.interceptedRequests.unshift(interceptedRequest);
                  if (
                    this.interceptedRequests.length > this.maxRequestHistory
                  ) {
                    this.interceptedRequests = this.interceptedRequests.slice(
                      0,
                      this.maxRequestHistory
                    );
                  }

                  // Emit events for real-time UI updates
                  this.emit("outgoing-request", interceptedRequest);
                  this.emit("outgoing-response", interceptedRequest);
                  this.emit("mock-served", {
                    request: interceptedRequest,
                    mock,
                  });
                } else {
                  console.log(
                    `🚫 INIT: Skipping mock request storage and events during startup`
                  );
                }
              });

              // Send mock response to client
              const headers = { ...mock.headers, "X-Sniffler-Mock": "true" };
              ctx.proxyToClientResponse.writeHead(mock.statusCode, headers);
              ctx.proxyToClientResponse.end(mock.body);

              // Update stats
              proxyConfig.stats.mocksServed++;
              proxyConfig.stats.successfulRequests++;
              return; // Don't forward to real server
            }
          }

          // Add correct Host header for the target
          const correctHost = `${targetUrl.hostname}${
            targetUrl.port ? `:${targetUrl.port}` : ""
          }`;
          ctx.proxyToServerRequestOptions.headers =
            ctx.proxyToServerRequestOptions.headers || {};
          ctx.proxyToServerRequestOptions.headers["host"] = correctHost;
          ctx.proxyToServerRequestOptions.headers["Host"] = correctHost;

          // Create intercepted request record
          const interceptedRequest = {
            id: requestId,
            timestamp: new Date().toISOString(),
            method: ctx.clientToProxyRequest.method,
            url: requestPath,
            fullTargetUrl: new URL(
              requestPath,
              proxyConfig.targetUrl
            ).toString(),
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isTargetHttps ? 443 : 80),
            path: requestPath,
            headers: { ...ctx.clientToProxyRequest.headers },
            proxyPort: proxyConfig.port,
            proxyName: proxyConfig.name,
            status: "pending",
            response: null,
            error: null,
            duration: null,
            startTime: startTime,
          };

          // Capture request body
          let requestBodyBuffer = Buffer.alloc(0);

          ctx.clientToProxyRequest.on("data", (chunk) => {
            requestBodyBuffer = Buffer.concat([requestBodyBuffer, chunk]);
          });

          ctx.clientToProxyRequest.on("end", () => {
            try {
              const contentType =
                interceptedRequest.headers["content-type"] || "";

              // Function to check if buffer contains binary data
              const isBinaryData = (buffer) => {
                if (buffer.length === 0) return false;
                const sample = buffer.slice(0, Math.min(512, buffer.length));
                for (let i = 0; i < sample.length; i++) {
                  const byte = sample[i];
                  // Check for null bytes or control characters (except common ones like \n, \r, \t)
                  if (
                    byte === 0 ||
                    (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)
                  ) {
                    return true;
                  }
                }
                return false;
              };

              // Check for text-based content types first
              if (
                contentType.includes("application/json") ||
                contentType.includes("text/") ||
                contentType.includes("application/xml") ||
                contentType.includes("application/x-www-form-urlencoded") ||
                contentType.includes("application/javascript") ||
                contentType.includes("application/x-javascript")
              ) {
                interceptedRequest.body = requestBodyBuffer.toString("utf8");
              } else if (requestBodyBuffer.length > 0) {
                // Check if it's actually binary data
                if (isBinaryData(requestBodyBuffer)) {
                  interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                } else {
                  // Try to decode as text but check for corruption
                  try {
                    const decoded = requestBodyBuffer.toString("utf8");
                    if (decoded.includes("\uFFFD")) {
                      interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                    } else {
                      interceptedRequest.body = decoded;
                    }
                  } catch (decodeError) {
                    interceptedRequest.body = `[Binary request: ${contentType}, ${requestBodyBuffer.length} bytes]`;
                  }
                }
              } else {
                interceptedRequest.body = "";
              }
            } catch (err) {
              interceptedRequest.body = `[Request processing error: ${err.message}, ${requestBodyBuffer.length} bytes]`;
            }

            // Add to internal list only if not initializing (to prevent phantom requests)
            if (!this.isInitializing) {
              this.interceptedRequests.unshift(interceptedRequest);
              if (this.interceptedRequests.length > this.maxRequestHistory) {
                this.interceptedRequests = this.interceptedRequests.slice(
                  0,
                  this.maxRequestHistory
                );
              }

              // Emit the request event immediately for real-time UI updates
              this.emit("outgoing-request", interceptedRequest);
            } else {
              console.log(
                `🚫 INIT: Skipping request storage and event emission during startup`
              );
            }
          });

          try {
            callback();
          } catch (callbackError) {
            this.emit("error", {
              error: callbackError.message,
              type: "callback-error",
              port,
            });
          }
        } catch (error) {
          this.emit("error", {
            error: error.message,
            type: "request-handling",
            port,
          });
          try {
            callback();
          } catch (callbackError) {
            // Handle callback error silently
          }
        }
      });

      // Handle responses with SSL decryption
      proxy.onResponse((ctx, callback) => {
        // Skip logging responses during initialization to prevent phantom requests
        if (this.isInitializing) {
          console.log(
            `🚫 INITIALIZATION: Skipping response logging during startup`
          );
          return callback();
        }

        const endTime = Date.now();

        try {
          const requestId = ctx.snifflerRequestId;
          console.log(
            `🔍 RESPONSE HANDLER: Processing response for request ID ${requestId}`
          );

          const request = this.interceptedRequests.find(
            (r) => r.id === requestId
          );
          if (request) {
            console.log(
              `🔍 RESPONSE HANDLER: Found request ${request.method} ${request.url}`
            );
            const response = {
              requestId: request.id,
              statusCode: ctx.serverToProxyResponse.statusCode,
              statusMessage: ctx.serverToProxyResponse.statusMessage,
              headers: { ...ctx.serverToProxyResponse.headers },
              body: null,
              duration: endTime - request.startTime,
              timestamp: new Date().toISOString(),
            };

            let responseBody = "";
            let responseCompleted = false;

            const completeResponse = () => {
              if (responseCompleted) return;

              // Add response-level deduplication to prevent duplicate processing
              const responseKey = `response-complete-${request.id}`;
              if (
                this.isEventProcessed("outgoing-response-complete", responseKey)
              ) {
                console.log(
                  `🔄 DEDUPLICATION: Skipping duplicate response completion for ${request.method} ${request.url}`
                );
                return;
              }

              responseCompleted = true;

              // Handle response body decompression and content detection
              const processResponseBody = async () => {
                try {
                  const contentEncoding =
                    response.headers["content-encoding"] ||
                    response.headers["Content-Encoding"];
                  const contentType =
                    response.headers["content-type"] ||
                    response.headers["Content-Type"] ||
                    "";

                  if (responseBodyBuffer.length === 0) {
                    response.body = "";
                  } else if (contentEncoding) {
                    // Response is compressed, decompress it first
                    console.log(
                      `🔄 Decompressing response with encoding: ${contentEncoding}`
                    );
                    response.body = await this.decompressResponseBody(
                      responseBodyBuffer,
                      contentEncoding
                    );
                  } else {
                    // No compression, use the existing logic
                    const isBinaryData = (buffer) => {
                      if (buffer.length === 0) return false;
                      const sample = buffer.slice(
                        0,
                        Math.min(512, buffer.length)
                      );
                      for (let i = 0; i < sample.length; i++) {
                        const byte = sample[i];
                        if (
                          byte === 0 ||
                          (byte < 32 &&
                            byte !== 9 &&
                            byte !== 10 &&
                            byte !== 13)
                        ) {
                          return true;
                        }
                      }
                      return false;
                    };

                    if (
                      contentType.includes("application/json") ||
                      contentType.includes("text/") ||
                      contentType.includes("application/xml") ||
                      contentType.includes(
                        "application/x-www-form-urlencoded"
                      ) ||
                      contentType.includes("application/javascript") ||
                      contentType.includes("application/x-javascript")
                    ) {
                      response.body = responseBodyBuffer.toString("utf8");
                    } else if (
                      contentType.includes("image/") ||
                      contentType.includes("application/octet-stream") ||
                      contentType.includes("application/pdf") ||
                      contentType.includes("application/zip") ||
                      contentType.includes("application/x-") ||
                      contentType.includes("video/") ||
                      contentType.includes("audio/") ||
                      isBinaryData(responseBodyBuffer)
                    ) {
                      response.body = `[Binary content: ${contentType}, ${responseBodyBuffer.length} bytes]`;
                    } else {
                      try {
                        const decoded = responseBodyBuffer.toString("utf8");
                        if (
                          decoded.includes("\uFFFD") ||
                          isBinaryData(responseBodyBuffer)
                        ) {
                          response.body = `[Binary content: ${contentType}, ${responseBodyBuffer.length} bytes]`;
                        } else {
                          response.body = decoded;
                        }
                      } catch (decodeError) {
                        response.body = `[Binary content: ${contentType}, ${responseBodyBuffer.length} bytes]`;
                      }
                    }
                  }

                  request.response = response;
                  request.status = "success";
                  request.duration = response.duration;

                  proxyConfig.stats.totalRequests++;
                  if (request.status === "success") {
                    proxyConfig.stats.successfulRequests++;
                  } else {
                    proxyConfig.stats.failedRequests++;
                  }

                  // Auto-save successful requests as mocks if enabled (with deduplication)
                  if (
                    this.settings.autoSaveRequestsAsMocks &&
                    request.status === "success" &&
                    response.statusCode >= 200 &&
                    response.statusCode < 400
                  ) {
                    const autoSaveKey = `auto-save-${request.id}`;
                    if (
                      !this.isEventProcessed(
                        "outgoing-mock-auto-created",
                        autoSaveKey
                      )
                    ) {
                      try {
                        const result = this.createMockFromRequest(request);

                        if (result && result.created) {
                          const mock = result.mock;
                          console.log(
                            `✅ Auto-saved request as disabled mock: ${request.method} ${request.url}`
                          );
                          this.emit("outgoing-mock-auto-created", {
                            request,
                            mock,
                          });
                        } else if (result && !result.created) {
                          console.log(
                            `🔄 Auto-save skipped (mock already exists): ${request.method} ${request.url}`
                          );
                        }
                      } catch (autoSaveError) {
                        console.error(
                          "❌ Failed to auto-save request as mock:",
                          autoSaveError.message
                        );
                      }
                    }
                  }

                  // Emit response event - only emit for real-time UI updates if not initializing
                  if (!this.isInitializing) {
                    this.emit("outgoing-response", request);
                  } else {
                    console.log(
                      `🚫 INIT: Skipping response event emission during startup`
                    );
                  }
                } catch (processingError) {
                  console.error(
                    "❌ Error processing response body:",
                    processingError
                  );
                  response.body = `[Response processing error: ${processingError.message}, ${responseBodyBuffer.length} bytes]`;

                  request.response = response;
                  request.status = "success";
                  request.duration = response.duration;

                  // Still emit the response even if processing failed
                  if (!this.isInitializing) {
                    this.emit("outgoing-response", request);
                  }
                }
              };

              // Process the response body asynchronously
              processResponseBody();
            };

            // Collect response body
            let responseBodyBuffer = Buffer.alloc(0);

            ctx.serverToProxyResponse.on("data", (chunk) => {
              responseBodyBuffer = Buffer.concat([responseBodyBuffer, chunk]);
            });

            ctx.serverToProxyResponse.on("end", () => {
              completeResponse();
            });

            ctx.serverToProxyResponse.on("error", (err) => {
              request.status = "failed";
              request.error = err.message;
              request.duration = endTime - request.startTime;
              proxyConfig.stats.failedRequests++;

              // Emit error event - only emit for real-time UI updates if not initializing
              if (!this.isInitializing) {
                this.emit("outgoing-error", request);
              } else {
                console.log(
                  `🚫 INIT: Skipping error event emission during startup`
                );
              }
            });
          }

          callback();
        } catch (error) {
          callback();
        }
      });

      await new Promise((resolve, reject) => {
        proxy.listen({ port, silent: true }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      proxyConfig.server = proxy;
      proxyConfig.isRunning = true;
      console.log(
        `✅ Outgoing proxy server successfully started on port ${port}`
      );
      console.log(`🔗 Proxy ${port} -> ${proxyConfig.targetUrl}`);

      // Create a serializable version of the proxy config for the event
      const serializableConfig = {
        id: proxyConfig.id,
        port: proxyConfig.port,
        targetUrl: proxyConfig.targetUrl,
        name: proxyConfig.name,
        createdAt: proxyConfig.createdAt,
        isRunning: proxyConfig.isRunning,
        stats: proxyConfig.stats,
      };

      this.emit("proxy-started", serializableConfig);
      return proxyConfig;
    } catch (error) {
      console.error(
        `❌ Failed to start outgoing proxy on port ${port}:`,
        error.message
      );

      // Make sure to mark proxy as not running if start failed
      const proxyConfig = this.proxyServers.get(port);
      if (proxyConfig) {
        proxyConfig.isRunning = false;
        proxyConfig.server = null;
      }

      this.emit("error", {
        error: error.message,
        type: "proxy-start",
        port,
      });
      throw error;
    }
  }

  // Stop a proxy server
  async stopProxy(port) {
    try {
      console.log(`Attempting to stop proxy on port ${port}`);
      const proxyConfig = this.proxyServers.get(port);
      if (!proxyConfig) {
        throw new Error(`Proxy not found on port ${port}`);
      }

      console.log(`Proxy config found for port ${port}:`, {
        isRunning: proxyConfig.isRunning,
        hasServer: !!proxyConfig.server,
        serverType: typeof proxyConfig.server,
        hasCloseMethod:
          proxyConfig.server && typeof proxyConfig.server.close === "function",
      });

      if (!proxyConfig.isRunning) {
        console.log(`Proxy on port ${port} is already stopped`);
        // Still update state and emit event for consistency
        proxyConfig.isRunning = false;
        proxyConfig.server = null;

        const serializableConfig = {
          id: proxyConfig.id,
          port: proxyConfig.port,
          targetUrl: proxyConfig.targetUrl,
          name: proxyConfig.name,
          createdAt: proxyConfig.createdAt,
          isRunning: proxyConfig.isRunning,
          stats: proxyConfig.stats,
        };

        this.emit("proxy-stopped", serializableConfig);
        return proxyConfig;
      }

      if (
        proxyConfig.server &&
        typeof proxyConfig.server.close === "function"
      ) {
        console.log(`Closing proxy server on port ${port}`);

        // Use a more robust approach with shorter timeout and better error handling
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn(
                `Timeout stopping proxy on port ${port} - proceeding with cleanup`
              );
              resolve(); // Don't reject, just resolve to continue cleanup
            }, 3000); // Shorter timeout (3 seconds)

            let callbackCalled = false;
            const safeResolve = () => {
              if (!callbackCalled) {
                callbackCalled = true;
                clearTimeout(timeout);
                resolve();
              }
            };

            try {
              // Try to close the proxy server
              proxyConfig.server.close(safeResolve);

              // Also try to close the underlying server directly if available
              if (
                proxyConfig.server._server &&
                typeof proxyConfig.server._server.close === "function"
              ) {
                proxyConfig.server._server.close();
              }
            } catch (closeError) {
              console.warn(
                `Direct close failed for proxy on port ${port}:`,
                closeError.message
              );
              safeResolve(); // Continue with cleanup even if close fails
            }
          });

          console.log(`Proxy server on port ${port} closed successfully`);
        } catch (error) {
          console.warn(
            `Error during close operation for proxy on port ${port}:`,
            error.message
          );
          // Continue with cleanup even if close fails
        }
      } else {
        console.log(`Proxy on port ${port} has no server instance to close`);
      }

      // Always clean up the state regardless of close success/failure
      proxyConfig.isRunning = false;
      proxyConfig.server = null;
      console.log(`Proxy on port ${port} stopped successfully`);

      // Create a serializable version of the proxy config for the event
      const serializableConfig = {
        id: proxyConfig.id,
        port: proxyConfig.port,
        targetUrl: proxyConfig.targetUrl,
        name: proxyConfig.name,
        createdAt: proxyConfig.createdAt,
        isRunning: proxyConfig.isRunning,
        stats: proxyConfig.stats,
      };

      this.emit("proxy-stopped", serializableConfig);
      return proxyConfig;
    } catch (error) {
      console.error(`Error stopping proxy on port ${port}:`, error);

      // Even if there's an error, try to clean up the state
      const proxyConfig = this.proxyServers.get(port);
      if (proxyConfig) {
        proxyConfig.isRunning = false;
        proxyConfig.server = null;
      }

      this.emit("error", {
        error: error.message,
        type: "proxy-stop",
        port,
      });

      // Don't throw the error during shutdown - just log it and continue
      console.warn(
        `Continuing with shutdown despite error stopping proxy on port ${port}`
      );
      return proxyConfig;
    }
  }

  // Remove a proxy configuration
  removeProxy(port) {
    try {
      const proxyConfig = this.proxyServers.get(port);
      if (!proxyConfig) {
        throw new Error(`Proxy not found on port ${port}`);
      }

      if (proxyConfig.isRunning) {
        throw new Error(`Cannot remove running proxy. Stop it first.`);
      }

      this.proxyServers.delete(port);
      this.emit("proxy-removed", { port, name: proxyConfig.name });
      return true;
    } catch (error) {
      this.emit("error", {
        error: error.message,
        type: "proxy-removal",
        port,
      });
      throw error;
    }
  }

  // Utility methods
  generateRequestId() {
    return `outgoing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateProxyId() {
    return `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  // Initialization control methods
  setInitializing(isInitializing) {
    this.isInitializing = isInitializing;

    if (isInitializing) {
      // During initialization, block ALL requests to prevent phantom requests
      console.log(
        "🚫 INITIALIZATION MODE: Blocking ALL outgoing requests to prevent phantom requests"
      );
    } else {
      console.log(
        "✅ INITIALIZATION COMPLETE: Outgoing request logging is now enabled"
      );
    }
  }

  // Deduplication helper - check if event was recently processed
  isEventProcessed(eventType, requestId) {
    if (!this.settings.enableDeduplication) {
      return false;
    }

    const eventKey = `${eventType}:${requestId}`;
    const now = Date.now();
    const lastProcessed = this.processedEvents.get(eventKey);

    if (
      lastProcessed &&
      now - lastProcessed < this.settings.deduplicationWindow
    ) {
      console.log(
        `🔄 DEDUPLICATION: Skipping duplicate ${eventType} event for request ${requestId}`
      );
      return true;
    }

    this.processedEvents.set(eventKey, now);

    // Clean up old entries to prevent memory leaks
    if (this.processedEvents.size > 1000) {
      const cutoff = now - this.settings.deduplicationWindow * 2;
      for (const [key, timestamp] of this.processedEvents.entries()) {
        if (timestamp < cutoff) {
          this.processedEvents.delete(key);
        }
      }
    }

    return false;
  }

  // Get a serializable version of a proxy configuration (safe for IPC)
  getSerializableProxy(port) {
    const proxy = this.proxyServers.get(port);
    if (!proxy) return null;

    return {
      id: proxy.id,
      port: proxy.port,
      targetUrl: proxy.targetUrl,
      name: proxy.name,
      createdAt: proxy.createdAt,
      isRunning: proxy.isRunning,
      stats: proxy.stats,
      updatedAt: proxy.updatedAt,
    };
  }

  addInterceptedRequest(request, emitEvent = false) {
    this.interceptedRequests.unshift(request);

    if (this.interceptedRequests.length > this.maxRequestHistory) {
      this.interceptedRequests = this.interceptedRequests.slice(
        0,
        this.maxRequestHistory
      );
    }

    // Only emit events if explicitly requested (prevents phantom requests during loading)
    if (emitEvent) {
      this.emit("outgoing-request", request);
    }

    // Note: Events should be emitted by the caller when appropriate
    // This prevents duplicate events when the same request is processed multiple times
  }

  // Mock Management Methods
  generateMockKey(proxyPort, method, url) {
    return `${proxyPort}:${method}:${url}`;
  }

  addOutgoingMock(proxyPort, method, url, response, isAutoCreated = false) {
    const mockKey = this.generateMockKey(proxyPort, method, url);

    // Check if mock already exists for this key (prevent duplicates)
    const existingMock = this.outgoingMocks.get(mockKey);
    if (existingMock) {
      console.log(
        `🔄 MOCK DEDUPLICATION: Mock already exists for ${method} ${url}, not creating duplicate`
      );
      return { mock: existingMock, created: false };
    }

    const mock = {
      id: `outgoing-mock-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      proxyPort,
      method,
      url,
      statusCode: response.statusCode || 200,
      headers: response.headers || { "Content-Type": "application/json" },
      body: response.body || "{}",
      enabled: response.enabled !== undefined ? response.enabled : true,
      createdAt: new Date().toISOString(),
      name: response.name || `${method} ${url}`,
      tags: response.tags || [],
    };

    this.outgoingMocks.set(mockKey, mock);

    // Only emit outgoing-mock-added for manually created mocks
    // Auto-created mocks will emit outgoing-mock-auto-created instead
    if (!isAutoCreated) {
      console.log(
        "🔥 OutgoingInterceptor: Emitting outgoing-mock-added event for:",
        mock
      );
      this.emit("outgoing-mock-added", mock);
    } else {
      console.log(
        "🔥 OutgoingInterceptor: Skipping outgoing-mock-added event (isAutoCreated = true)"
      );
    }

    return { mock, created: true };
  }

  removeOutgoingMock(proxyPort, method, url) {
    const mockKey = this.generateMockKey(proxyPort, method, url);
    const deleted = this.outgoingMocks.delete(mockKey);
    if (deleted) {
      this.emit("outgoing-mock-removed", { proxyPort, method, url });
    }
    return deleted;
  }

  toggleOutgoingMock(proxyPort, method, url) {
    const mockKey = this.generateMockKey(proxyPort, method, url);
    const mock = this.outgoingMocks.get(mockKey);
    if (mock) {
      mock.enabled = !mock.enabled;
      this.emit("outgoing-mock-toggled", mock);
      return mock;
    }
    return null;
  }

  updateOutgoingMock(proxyPort, method, url, updates) {
    const mockKey = this.generateMockKey(proxyPort, method, url);
    const mock = this.outgoingMocks.get(mockKey);
    if (mock) {
      Object.assign(mock, updates, { updatedAt: new Date().toISOString() });
      this.emit("outgoing-mock-updated", mock);
      return mock;
    }
    return null;
  }

  getOutgoingMocks(proxyPort = null) {
    const allMocks = Array.from(this.outgoingMocks.values());
    if (proxyPort) {
      return allMocks.filter((mock) => mock.proxyPort === proxyPort);
    }
    return allMocks;
  }

  getOutgoingMockByKey(proxyPort, method, url) {
    const mockKey = this.generateMockKey(proxyPort, method, url);
    return this.outgoingMocks.get(mockKey);
  }

  // Testing mode methods
  setTestingMode(enabled) {
    this.testingMode = enabled;
    this.emit("testing-mode-changed", { enabled });
  }

  setMockingEnabled(enabled) {
    this.mockingEnabled = enabled;
    this.emit("mocking-enabled-changed", { enabled });
  }

  get isTestingMode() {
    return this.testingMode;
  }

  shouldMockRequest(proxyPort, method, url) {
    if (!this.testingMode || !this.mockingEnabled) {
      return false;
    }

    const mock = this.getOutgoingMockByKey(proxyPort, method, url);
    if (!mock) {
      return false;
    }

    return true;
  }

  // Configuration methods
  getProxies() {
    try {
      console.log(
        `🔄 Getting proxies from ${this.proxyServers.size} proxy servers`
      );
      const proxies = Array.from(this.proxyServers.values()).map((proxy) => ({
        id: proxy.id,
        port: proxy.port,
        targetUrl: proxy.targetUrl,
        name: proxy.name,
        createdAt: proxy.createdAt,
        isRunning: proxy.isRunning,
        stats: proxy.stats,
      }));
      console.log(`✅ Successfully serialized ${proxies.length} proxies`);
      return proxies;
    } catch (error) {
      console.error("❌ Error getting proxies:", error);
      throw error;
    }
  }

  getProxy(port) {
    return this.proxyServers.get(port);
  }

  updateProxy(port, updates) {
    const proxy = this.proxyServers.get(port);
    if (!proxy) return null;

    if (proxy.isRunning) {
      throw new Error("Cannot update running proxy. Stop it first.");
    }

    const updatedProxy = {
      ...proxy,
      ...updates,
      port: proxy.port,
      id: proxy.id,
      updatedAt: new Date().toISOString(),
    };

    this.proxyServers.set(port, updatedProxy);

    // Create a serializable version of the proxy config for the event
    const serializableConfig = {
      id: updatedProxy.id,
      port: updatedProxy.port,
      targetUrl: updatedProxy.targetUrl,
      name: updatedProxy.name,
      createdAt: updatedProxy.createdAt,
      isRunning: updatedProxy.isRunning,
      stats: updatedProxy.stats,
      updatedAt: updatedProxy.updatedAt,
    };

    this.emit("proxy-updated", serializableConfig);
    return updatedProxy;
  }

  // Data access methods
  getInterceptedRequests() {
    return [...this.interceptedRequests];
  }

  clearInterceptedRequests() {
    this.interceptedRequests = [];
    this.emit("requests-cleared");
  }

  getRequestsForProxy(port) {
    return this.interceptedRequests.filter((request) => {
      return request.proxyPort === port;
    });
  }

  getStats() {
    const totalRequests = this.interceptedRequests.length;
    const successfulRequests = this.interceptedRequests.filter(
      (r) => r.status === "success"
    ).length;
    const failedRequests = this.interceptedRequests.filter(
      (r) => r.status === "failed"
    ).length;
    const pendingRequests = this.interceptedRequests.filter(
      (r) => r.status === "pending"
    ).length;
    const mockedRequests = this.interceptedRequests.filter(
      (r) => r.status === "mocked"
    ).length;

    const runningProxies = Array.from(this.proxyServers.values()).filter(
      (p) => p.isRunning
    ).length;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      pendingRequests,
      mockedRequests,
      totalProxies: this.proxyServers.size,
      runningProxies,
      totalMocks: this.outgoingMocks.size,
    };
  }

  // Connection testing
  async testConnection(targetUrl) {
    try {
      const url = new URL(targetUrl);
      const isHttps = url.protocol === "https:";
      const port = url.port || (isHttps ? 443 : 80);

      return new Promise((resolve) => {
        const net = require("net");
        const socket = new net.Socket();
        const timeout = 5000;

        socket.setTimeout(timeout);

        socket.on("connect", () => {
          socket.destroy();
          resolve({
            success: true,
            message: `Connection successful to ${url.hostname}:${port}`,
          });
        });

        socket.on("error", (error) => {
          socket.destroy();
          resolve({
            success: false,
            error: error.message,
            message: `Failed to connect to ${url.hostname}:${port}: ${error.message}`,
          });
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve({
            success: false,
            error: "Connection timeout",
            message: `Connection to ${url.hostname}:${port} timed out`,
          });
        });

        socket.connect(port, url.hostname);
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Invalid URL: ${error.message}`,
      };
    }
  }

  // Stop all proxies
  async stopAll() {
    const stopPromises = Array.from(this.proxyServers.keys()).map((port) =>
      this.stopProxy(port).catch((error) => {
        // Handle error silently
      })
    );

    await Promise.all(stopPromises);
    this.emit("all-proxies-stopped");
  }

  // Start all configured proxies
  async startAll() {
    const startPromises = Array.from(this.proxyServers.values())
      .filter((proxy) => !proxy.isRunning)
      .map((proxy) =>
        this.startProxy(proxy.port).catch((error) => {
          // Handle error silently
        })
      );

    await Promise.all(startPromises);
    this.emit("all-proxies-started");
  }

  // Export/Import functionality
  exportConfig() {
    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      proxies: this.getProxies(),
      outgoingMocks: this.getOutgoingMocks(),
      stats: this.getStats(),
    };
  }

  importConfig(config) {
    try {
      if (!config.proxies || !Array.isArray(config.proxies)) {
        throw new Error("Invalid configuration format");
      }

      let importedCount = 0;
      for (const proxyConfig of config.proxies) {
        try {
          if (this.proxyServers.has(proxyConfig.port)) {
            continue;
          }

          this.createProxy({
            port: proxyConfig.port,
            targetUrl: proxyConfig.targetUrl,
            name: proxyConfig.name,
          });
          importedCount++;
        } catch (error) {
          // Handle error silently
        }
      }

      // Import outgoing mocks if present
      let importedMocksCount = 0;
      if (config.outgoingMocks && Array.isArray(config.outgoingMocks)) {
        for (const mock of config.outgoingMocks) {
          try {
            const result = this.addOutgoingMock(
              mock.proxyPort,
              mock.method,
              mock.url,
              {
                statusCode: mock.statusCode,
                headers: mock.headers,
                body: mock.body,
                enabled: mock.enabled,
                name: mock.name,
                tags: mock.tags,
              },
              true // Mark as auto-created to prevent UI events during import
            );
            // Count as imported whether it was newly created or already existed
            if (result && result.mock) {
              importedMocksCount++;
            }
          } catch (error) {
            // Handle error silently
          }
        }
      }

      return {
        success: true,
        importedCount,
        importedMocksCount,
        totalCount: config.proxies.length,
        totalMocksCount: config.outgoingMocks?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update interceptor settings
  updateSettings(settings) {
    if (settings.maxRequestHistory !== undefined) {
      this.maxRequestHistory = settings.maxRequestHistory;
      // Apply limit to current requests
      if (this.interceptedRequests.length > this.maxRequestHistory) {
        this.interceptedRequests = this.interceptedRequests.slice(
          0,
          this.maxRequestHistory
        );
      }
    }
    if (settings.maxMockHistory !== undefined) {
      this.maxMockHistory = settings.maxMockHistory;
    }
    if (settings.autoSaveRequestsAsMocks !== undefined) {
      this.settings.autoSaveRequestsAsMocks = settings.autoSaveRequestsAsMocks;
    }
    if (settings.enableDeduplication !== undefined) {
      this.settings.enableDeduplication = settings.enableDeduplication;
    }
    if (settings.deduplicationWindow !== undefined) {
      this.settings.deduplicationWindow = settings.deduplicationWindow;
    }
  }

  // Create mock from request
  createMockFromRequest(request) {
    if (!request || !request.response) {
      throw new Error("Request must have a response to create a mock");
    }

    const result = this.addOutgoingMock(
      request.proxyPort,
      request.method,
      request.url,
      {
        statusCode: request.response.statusCode,
        headers: request.response.headers,
        body: request.response.body,
        name: `${request.method} ${request.url}`,
        enabled: false, // Auto-saved mocks are disabled by default
      },
      true // Mark as auto-created to prevent duplicate events
    );

    return result;
  }
}

module.exports = OutgoingInterceptor;
