// HTTP testing utilities
const axios = require("axios");
const http = require("http");
const express = require("express");

class HttpTestHelper {
  constructor() {
    this.servers = new Map();
    this.testApis = {
      api1: "http://localhost:3001",
      api2: "http://localhost:3002",
      api3: "http://localhost:3003",
      api4: "http://localhost:3004",
    };
  }

  // Test API connectivity
  async testApiConnectivity() {
    const results = {};

    for (const [apiName, baseUrl] of Object.entries(this.testApis)) {
      try {
        const response = await axios.get(`${baseUrl}/health`, {
          timeout: 5000,
        });
        results[apiName] = {
          success: true,
          url: baseUrl,
          status: response.status,
          data: response.data,
        };
      } catch (error) {
        results[apiName] = {
          success: false,
          url: baseUrl,
          error: error.message,
        };
      }
    }

    return results;
  }

  // Make HTTP requests through proxy
  async makeProxyRequest(proxyPort, method, path, options = {}) {
    const proxyUrl = `http://localhost:${proxyPort}`;
    const config = {
      method: method.toLowerCase(),
      url: `${proxyUrl}${path}`,
      timeout: options.timeout || 10000,
      validateStatus: () => true, // Don't throw on HTTP error status codes
      ...options,
    };

    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        headers: response.headers,
        data: response.data,
        duration:
          response.config.metadata?.endTime -
            response.config.metadata?.startTime || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Make direct HTTP request to any URL
  async makeRequest(url, method, path, options = {}) {
    const config = {
      method: method.toLowerCase(),
      url: `${url}${path}`,
      timeout: options.timeout || 10000,
      validateStatus: () => true, // Don't throw on HTTP error status codes
      ...options,
    };

    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Make direct API requests (bypassing proxy)
  async makeDirectRequest(apiName, method, path, options = {}) {
    const baseUrl = this.testApis[apiName];
    if (!baseUrl) {
      throw new Error(`Unknown API: ${apiName}`);
    }

    const config = {
      method: method.toLowerCase(),
      url: `${baseUrl}${path}`,
      timeout: options.timeout || 10000,
      validateStatus: () => true,
      ...options,
    };

    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Create a mock HTTP server for testing
  async createMockServer(port, routes = []) {
    const app = express();
    app.use(express.json());

    // Add default health check
    app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Add custom routes
    routes.forEach((route) => {
      const method = route.method.toLowerCase();
      app[method](route.path, (req, res) => {
        if (route.delay) {
          setTimeout(() => {
            res.status(route.status || 200).json(route.response || {});
          }, route.delay);
        } else {
          res.status(route.status || 200).json(route.response || {});
        }
      });
    });

    return new Promise((resolve, reject) => {
      const server = app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          this.servers.set(port, server);
          resolve(server);
        }
      });
    });
  }

  // Stop a mock server
  async stopMockServer(port) {
    const server = this.servers.get(port);
    if (server) {
      return new Promise((resolve) => {
        server.close(() => {
          this.servers.delete(port);
          resolve();
        });
      });
    }
  }

  // Stop all mock servers
  async stopAllMockServers() {
    const stopPromises = Array.from(this.servers.keys()).map((port) =>
      this.stopMockServer(port)
    );
    await Promise.all(stopPromises);
  }

  // Generate test data
  generateTestUser(suffix = "") {
    return {
      name: `Test User ${suffix}`,
      email: `test_user_${suffix}@example.com`,
      age: Math.floor(Math.random() * 50) + 20,
      city: "Test City",
    };
  }

  generateTestProduct(suffix = "") {
    return {
      name: `Test Product ${suffix}`,
      price: Math.floor(Math.random() * 1000) + 10,
      description: `Test product description ${suffix}`,
      category: "test",
    };
  }

  // Validate HTTP response structure
  validateResponse(response, expectedSchema) {
    const errors = [];

    if (expectedSchema.status && response.status !== expectedSchema.status) {
      errors.push(
        `Expected status ${expectedSchema.status}, got ${response.status}`
      );
    }

    if (expectedSchema.headers) {
      for (const [header, value] of Object.entries(expectedSchema.headers)) {
        if (response.headers[header.toLowerCase()] !== value) {
          errors.push(
            `Expected header ${header}: ${value}, got ${
              response.headers[header.toLowerCase()]
            }`
          );
        }
      }
    }

    if (expectedSchema.data) {
      for (const [key, value] of Object.entries(expectedSchema.data)) {
        if (response.data[key] !== value) {
          errors.push(
            `Expected data.${key}: ${value}, got ${response.data[key]}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Test common HTTP methods
  async testAllHttpMethods(proxyPort, basePath = "") {
    const results = {};
    const testData = this.generateTestUser("http_test");

    // GET
    try {
      results.GET = await this.makeProxyRequest(
        proxyPort,
        "GET",
        `${basePath}/users`
      );
    } catch (error) {
      results.GET = { success: false, error: error.message };
    }

    // POST
    try {
      results.POST = await this.makeProxyRequest(
        proxyPort,
        "POST",
        `${basePath}/users`,
        {
          data: testData,
        }
      );
    } catch (error) {
      results.POST = { success: false, error: error.message };
    }

    // PUT
    try {
      results.PUT = await this.makeProxyRequest(
        proxyPort,
        "PUT",
        `${basePath}/users/1`,
        {
          data: { ...testData, name: "Updated Name" },
        }
      );
    } catch (error) {
      results.PUT = { success: false, error: error.message };
    }

    // DELETE
    try {
      results.DELETE = await this.makeProxyRequest(
        proxyPort,
        "DELETE",
        `${basePath}/users/1`
      );
    } catch (error) {
      results.DELETE = { success: false, error: error.message };
    }

    return results;
  }
}

module.exports = HttpTestHelper;
