const { EventEmitter } = require("events");
const net = require("net");

class DatabaseSniffer extends EventEmitter {
  constructor() {
    super();
    this.servers = new Map(); // port -> server instance
    this.connections = new Map(); // connectionId -> connection info
    this.isRunning = false;
  }

  /**
   * Start sniffing database connections on specified port
   * @param {number} port - Port to listen on
   * @param {string} protocol - Database protocol (postgresql, mysql)
   * @param {string} targetHost - Target database host
   * @param {number} targetPort - Target database port
   */
  startSniffing(port, protocol, targetHost = "localhost", targetPort) {
    return new Promise((resolve, reject) => {
      if (this.servers.has(port)) {
        reject(new Error(`Already sniffing on port ${port}`));
        return;
      }

      const server = net.createServer((clientSocket) => {
        const connectionId = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Connect to the actual database
        const serverSocket = net.createConnection(
          {
            host: targetHost,
            port: targetPort,
          },
          () => {
            this.emit("connection-established", {
              connectionId,
              protocol,
              clientAddress: clientSocket.remoteAddress,
              targetHost,
              targetPort,
              timestamp: new Date().toISOString(),
            });
          }
        );

        this.connections.set(connectionId, {
          clientSocket,
          serverSocket,
          protocol,
          startTime: Date.now(),
          queryCount: 0,
          lastActivity: Date.now(),
        });

        // Handle client -> server data (queries)
        clientSocket.on("data", (data) => {
          this.handleClientData(connectionId, data, protocol);
          serverSocket.write(data);
        });

        // Handle server -> client data (responses)
        serverSocket.on("data", (data) => {
          this.handleServerData(connectionId, data, protocol);
          clientSocket.write(data);
        });

        // Handle connection cleanup
        const cleanup = () => {
          this.connections.delete(connectionId);
          this.emit("connection-closed", { connectionId });
        };

        clientSocket.on("close", cleanup);
        clientSocket.on("error", cleanup);
        serverSocket.on("close", cleanup);
        serverSocket.on("error", cleanup);
      });

      server.listen(port, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.servers.set(port, server);
        this.isRunning = true;

        resolve({
          success: true,
          port,
          protocol,
          targetHost,
          targetPort,
        });
      });

      server.on("error", (err) => {
        this.servers.delete(port);
        reject(err);
      });
    });
  }

  /**
   * Stop sniffing on a specific port
   */
  stopSniffing(port) {
    return new Promise((resolve) => {
      const server = this.servers.get(port);
      if (!server) {
        resolve({ success: false, error: "No sniffer running on this port" });
        return;
      }

      server.close(() => {
        this.servers.delete(port);

        // Close all connections for this port
        for (const [connectionId, connection] of this.connections.entries()) {
          if (connection.clientSocket.localPort === port) {
            connection.clientSocket.destroy();
            connection.serverSocket.destroy();
            this.connections.delete(connectionId);
          }
        }

        if (this.servers.size === 0) {
          this.isRunning = false;
        }

        resolve({ success: true, port });
      });
    });
  }

  /**
   * Handle data from client to server (queries)
   */
  handleClientData(connectionId, data, protocol) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();
    connection.queryCount++;

    let parsedQuery = null;

    try {
      switch (protocol) {
        case "postgresql":
          parsedQuery = this.parsePostgreSQLQuery(data);
          break;
        case "mysql":
          parsedQuery = this.parseMySQLQuery(data);
          break;
        default:
          parsedQuery = { raw: data.toString("hex") };
      }
    } catch (error) {
      parsedQuery = {
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
      };
    }

    this.emit("database-query", {
      connectionId,
      protocol,
      direction: "client-to-server",
      timestamp: new Date().toISOString(),
      size: data.length,
      query: parsedQuery,
      queryNumber: connection.queryCount,
    });
  }

  /**
   * Handle data from server to client (responses)
   */
  handleServerData(connectionId, data, protocol) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();

    let parsedResponse = null;

    try {
      switch (protocol) {
        case "postgresql":
          parsedResponse = this.parsePostgreSQLResponse(data);
          break;
        case "mysql":
          parsedResponse = this.parseMySQLResponse(data);
          break;
        default:
          parsedResponse = { raw: data.toString("hex") };
      }
    } catch (error) {
      parsedResponse = {
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
      };
    }

    this.emit("database-response", {
      connectionId,
      protocol,
      direction: "server-to-client",
      timestamp: new Date().toISOString(),
      size: data.length,
      response: parsedResponse,
    });
  }

  /**
   * Basic PostgreSQL protocol parsing
   * Note: This is a simplified implementation for demonstration
   */
  parsePostgreSQLQuery(data) {
    // PostgreSQL uses a message-based protocol
    // First byte is message type, next 4 bytes are length
    if (data.length < 5) {
      return { type: "incomplete", raw: data.toString("hex") };
    }

    const messageType = String.fromCharCode(data[0]);
    const length = data.readUInt32BE(1);

    let content = "";
    if (data.length >= 5) {
      content = data.slice(5).toString("utf8").replace(/\0/g, "");
    }

    const messageTypes = {
      Q: "Simple Query",
      P: "Parse",
      B: "Bind",
      E: "Execute",
      S: "Sync",
      X: "Terminate",
    };

    return {
      type: messageTypes[messageType] || "Unknown",
      messageType,
      length,
      content:
        content.length > 500 ? content.substring(0, 500) + "..." : content,
      isQuery: messageType === "Q",
    };
  }

  /**
   * Basic MySQL protocol parsing
   * Note: This is a simplified implementation for demonstration
   */
  parseMySQLQuery(data) {
    if (data.length < 4) {
      return { type: "incomplete", raw: data.toString("hex") };
    }

    // MySQL packet header: 3 bytes length + 1 byte sequence
    const packetLength = data.readUIntLE(0, 3);
    const sequenceId = data[3];

    if (data.length < 5) {
      return { type: "header-only", packetLength, sequenceId };
    }

    const commandType = data[4];
    const payload = data.slice(5).toString("utf8");

    const commandTypes = {
      0x00: "COM_SLEEP",
      0x01: "COM_QUIT",
      0x02: "COM_INIT_DB",
      0x03: "COM_QUERY",
      0x04: "COM_FIELD_LIST",
      0x05: "COM_CREATE_DB",
      0x06: "COM_DROP_DB",
      0x07: "COM_REFRESH",
      0x08: "COM_SHUTDOWN",
      0x09: "COM_STATISTICS",
      0x0a: "COM_PROCESS_INFO",
      0x0b: "COM_CONNECT",
      0x0c: "COM_PROCESS_KILL",
      0x0d: "COM_DEBUG",
      0x0e: "COM_PING",
      0x0f: "COM_TIME",
      0x10: "COM_DELAYED_INSERT",
      0x11: "COM_CHANGE_USER",
    };

    return {
      type: commandTypes[commandType] || "Unknown Command",
      commandType: `0x${commandType.toString(16).padStart(2, "0")}`,
      packetLength,
      sequenceId,
      payload:
        payload.length > 500 ? payload.substring(0, 500) + "..." : payload,
      isQuery: commandType === 0x03,
    };
  }

  /**
   * Basic PostgreSQL response parsing
   */
  parsePostgreSQLResponse(data) {
    if (data.length < 5) {
      return { type: "incomplete", raw: data.toString("hex") };
    }

    const messageType = String.fromCharCode(data[0]);
    const length = data.readUInt32BE(1);

    const messageTypes = {
      R: "Authentication",
      S: "Parameter Status",
      K: "Backend Key Data",
      Z: "Ready for Query",
      T: "Row Description",
      D: "Data Row",
      C: "Command Complete",
      E: "Error Response",
      N: "Notice Response",
    };

    return {
      type: messageTypes[messageType] || "Unknown Response",
      messageType,
      length,
      isError: messageType === "E",
      isComplete: messageType === "C",
    };
  }

  /**
   * Basic MySQL response parsing
   */
  parseMySQLResponse(data) {
    if (data.length < 4) {
      return { type: "incomplete", raw: data.toString("hex") };
    }

    const packetLength = data.readUIntLE(0, 3);
    const sequenceId = data[3];

    if (data.length < 5) {
      return { type: "header-only", packetLength, sequenceId };
    }

    const firstByte = data[4];

    // Determine response type based on first byte of payload
    let responseType = "Unknown";
    if (firstByte === 0x00) {
      responseType = "OK Packet";
    } else if (firstByte === 0xff) {
      responseType = "Error Packet";
    } else if (firstByte === 0xfe && packetLength < 9) {
      responseType = "EOF Packet";
    } else {
      responseType = "Result Set";
    }

    return {
      type: responseType,
      packetLength,
      sequenceId,
      isError: firstByte === 0xff,
      isOK: firstByte === 0x00,
    };
  }

  /**
   * Get statistics for all active connections
   */
  getStatistics() {
    const stats = {
      totalConnections: this.connections.size,
      activeServers: this.servers.size,
      connectionDetails: [],
    };

    for (const [connectionId, connection] of this.connections.entries()) {
      stats.connectionDetails.push({
        connectionId,
        protocol: connection.protocol,
        duration: Date.now() - connection.startTime,
        queryCount: connection.queryCount,
        lastActivity: connection.lastActivity,
        clientAddress: connection.clientSocket.remoteAddress,
      });
    }

    return stats;
  }

  /**
   * Stop all sniffers
   */
  async stopAll() {
    const promises = [];
    for (const port of this.servers.keys()) {
      promises.push(this.stopSniffing(port));
    }
    await Promise.all(promises);
    this.isRunning = false;
    return { success: true };
  }
}

module.exports = DatabaseSniffer;
