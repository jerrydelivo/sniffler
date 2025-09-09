/**
 * Database URL Parser Utility
 * Parses database connection strings and extracts connection details
 */

/**
 * Parse a database URL and extract connection details
 * @param {string} url - The database URL to parse
 * @returns {object} Parsed connection details or null if invalid
 */
function parseDatabaseUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    // Handle different URL formats
    let parsedUrl;

    // Try to parse as URL
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      // If URL parsing fails, try to handle special cases
      return null;
    }

    const protocol = parsedUrl.protocol.replace(":", "");
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port;
    const username = parsedUrl.username;
    const password = parsedUrl.password;
    const pathname = parsedUrl.pathname.replace("/", ""); // Remove leading slash
    const searchParams = new URLSearchParams(parsedUrl.search);

    // Map protocol names to Sniffler protocol names
    const protocolMap = {
      mongodb: "mongodb",
      mongo: "mongodb",
      postgresql: "postgresql",
      postgres: "postgresql",
      mysql: "mysql",
      sqlserver: "sqlserver",
      mssql: "sqlserver",
      redis: "redis",
      rediss: "redis", // Redis with SSL
    };

    const snifflerProtocol = protocolMap[protocol.toLowerCase()];
    if (!snifflerProtocol) {
      return null;
    }

    // Get default ports for protocols
    const defaultPorts = {
      mongodb: 27017,
      postgresql: 5432,
      mysql: 3306,
      sqlserver: 1433,
      redis: 6379,
    };

    const parsedPort = port
      ? parseInt(port, 10)
      : defaultPorts[snifflerProtocol];

    // Generate a default proxy name
    const databaseName = pathname || "database";
    const proxyName = `${
      snifflerProtocol.charAt(0).toUpperCase() + snifflerProtocol.slice(1)
    } Proxy (${databaseName})`;

    // Get suggested proxy port (add 10000 to target port to avoid conflicts)
    const suggestedProxyPort = parsedPort + 10000;

    const result = {
      protocol: snifflerProtocol,
      targetHost: hostname,
      targetPort: parsedPort,
      suggestedProxyPort,
      name: proxyName,
      database: databaseName,
      username,
      password,
      originalUrl: url,
      connectionDetails: {
        authSource: searchParams.get("authSource"),
        ssl: searchParams.get("ssl") === "true" || protocol === "rediss",
        // Add other common parameters
        retryWrites: searchParams.get("retryWrites"),
        w: searchParams.get("w"),
        readPreference: searchParams.get("readPreference"),
      },
    };

    return result;
  } catch (error) {
    console.warn("Failed to parse database URL:", error);
    return null;
  }
}

/**
 * Generate example URLs for different database types
 * @returns {object} Example URLs for each protocol
 */
function getExampleDatabaseUrls() {
  return {
    mongodb:
      "mongodb://username:password@localhost:27017/database?authSource=admin",
    postgresql: "postgresql://username:password@localhost:5432/database",
    mysql: "mysql://username:password@localhost:3306/database",
    sqlserver: "sqlserver://username:password@localhost:1433/database",
    redis: "redis://username:password@localhost:6379/0",
  };
}

/**
 * Validate if a URL looks like a database connection string
 * @param {string} url - The URL to validate
 * @returns {boolean} True if it looks like a database URL
 */
function isValidDatabaseUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const supportedProtocols = [
    "mongodb:",
    "mongo:",
    "postgresql:",
    "postgres:",
    "mysql:",
    "sqlserver:",
    "mssql:",
    "redis:",
    "rediss:",
  ];

  return supportedProtocols.some((protocol) =>
    url.toLowerCase().startsWith(protocol)
  );
}

/**
 * Generate a proxy connection string based on the original URL and proxy port
 * @param {string} originalUrl - Original database URL
 * @param {number} proxyPort - The proxy port to use
 * @returns {string|null} Modified connection string for the proxy
 */
function generateProxyConnectionString(originalUrl, proxyPort) {
  const parsed = parseDatabaseUrl(originalUrl);
  if (!parsed) {
    return null;
  }

  try {
    const url = new URL(originalUrl);
    url.port = proxyPort.toString();
    return url.toString();
  } catch (error) {
    return null;
  }
}

// ES6 exports for React
export {
  parseDatabaseUrl,
  getExampleDatabaseUrls,
  isValidDatabaseUrl,
  generateProxyConnectionString,
};
