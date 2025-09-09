class RedisParser {
  constructor() {
    this.commandTypes = {
      // String commands
      GET: "READ",
      SET: "WRITE",
      MGET: "READ",
      MSET: "WRITE",
      INCR: "WRITE",
      DECR: "WRITE",
      INCRBY: "WRITE",
      DECRBY: "WRITE",
      APPEND: "WRITE",
      STRLEN: "READ",
      SETEX: "WRITE",
      SETNX: "WRITE",
      GETSET: "WRITE",
      GETRANGE: "READ",
      SETRANGE: "WRITE",

      // Hash commands
      HGET: "READ",
      HSET: "WRITE",
      HMGET: "READ",
      HMSET: "WRITE",
      HGETALL: "READ",
      HDEL: "WRITE",
      HEXISTS: "READ",
      HKEYS: "READ",
      HVALS: "READ",
      HLEN: "READ",
      HINCRBY: "WRITE",
      HINCRBYFLOAT: "WRITE",

      // List commands
      LPUSH: "WRITE",
      RPUSH: "WRITE",
      LPOP: "WRITE",
      RPOP: "WRITE",
      LLEN: "READ",
      LRANGE: "READ",
      LINDEX: "READ",
      LSET: "WRITE",
      LREM: "WRITE",
      LTRIM: "WRITE",
      LINSERT: "WRITE",
      BLPOP: "READ",
      BRPOP: "READ",

      // Set commands
      SADD: "WRITE",
      SREM: "WRITE",
      SMEMBERS: "READ",
      SISMEMBER: "READ",
      SCARD: "READ",
      SPOP: "WRITE",
      SRANDMEMBER: "READ",
      SMOVE: "WRITE",
      SDIFF: "READ",
      SINTER: "READ",
      SUNION: "READ",

      // Sorted Set commands
      ZADD: "WRITE",
      ZREM: "WRITE",
      ZRANGE: "READ",
      ZRANGEBYSCORE: "READ",
      ZREVRANGE: "READ",
      ZSCORE: "READ",
      ZCARD: "READ",
      ZCOUNT: "READ",
      ZRANK: "READ",
      ZREVRANK: "READ",
      ZINCRBY: "WRITE",

      // Key commands
      DEL: "WRITE",
      EXISTS: "READ",
      EXPIRE: "WRITE",
      EXPIREAT: "WRITE",
      TTL: "READ",
      PTTL: "READ",
      PERSIST: "WRITE",
      KEYS: "READ",
      SCAN: "READ",
      TYPE: "READ",
      RENAME: "WRITE",
      RENAMENX: "WRITE",

      // Connection commands
      PING: "CONNECTION",
      ECHO: "CONNECTION",
      AUTH: "CONNECTION",
      SELECT: "CONNECTION",
      QUIT: "CONNECTION",

      // Server commands
      INFO: "SERVER",
      CONFIG: "SERVER",
      FLUSHDB: "SERVER",
      FLUSHALL: "SERVER",
      DBSIZE: "SERVER",
      LASTSAVE: "SERVER",
      SAVE: "SERVER",
      BGSAVE: "SERVER",
      SHUTDOWN: "SERVER",
      TIME: "SERVER",

      // Transaction commands
      MULTI: "TRANSACTION",
      EXEC: "TRANSACTION",
      DISCARD: "TRANSACTION",
      WATCH: "TRANSACTION",
      UNWATCH: "TRANSACTION",

      // Pub/Sub commands
      PUBLISH: "PUBSUB",
      SUBSCRIBE: "PUBSUB",
      UNSUBSCRIBE: "PUBSUB",
      PSUBSCRIBE: "PUBSUB",
      PUNSUBSCRIBE: "PUBSUB",
    };

    this.responseTypes = {
      "+": "Simple String",
      "-": "Error",
      ":": "Integer",
      $: "Bulk String",
      "*": "Array",
    };
  }

  parseQueries(buffer) {
    // Parse multiple Redis commands from a buffer using RESP protocol
    const commands = [];
    let offset = 0;

    while (offset < buffer.length) {
      try {
        const result = this.parseRESP(buffer, offset);
        if (!result) break;

        const { value, bytesRead } = result;
        if (bytesRead === 0) break;

        if (value && Array.isArray(value) && value.length > 0) {
          const command = this.parseCommand(value);
          if (command) {
            commands.push(command);
          }
        }

        offset += bytesRead;
      } catch (error) {
        // If we can't parse, try to skip to next command
        const nextCRLF = buffer.indexOf("\r\n", offset);
        if (nextCRLF === -1) break;
        offset = nextCRLF + 2;
      }
    }

    return commands;
  }

  parseQuery(data) {
    try {
      if (!data || data.length === 0) {
        return {
          type: "empty",
          raw: "",
          isQuery: false,
          protocol: "redis",
        };
      }

      // Parse RESP format
      const result = this.parseRESP(data, 0);
      if (!result || !result.value) {
        return {
          type: "incomplete",
          raw: data.toString().substring(0, 200),
          isQuery: false,
          protocol: "redis",
        };
      }

      const { value } = result;

      // Redis commands are typically arrays where first element is the command
      if (Array.isArray(value) && value.length > 0) {
        return this.parseCommand(value);
      }

      return {
        type: "unknown",
        raw: data.toString().substring(0, 200),
        isQuery: false,
        protocol: "redis",
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString().substring(0, 200),
        isQuery: false,
        protocol: "redis",
      };
    }
  }

  parseCommand(commandArray) {
    if (!Array.isArray(commandArray) || commandArray.length === 0) {
      return null;
    }

    const command = String(commandArray[0]).toUpperCase();
    const args = commandArray.slice(1).map((arg) => String(arg));
    const commandType = this.commandTypes[command] || "UNKNOWN";

    // Create a readable command representation
    let readableCommand = command;
    if (args.length > 0) {
      // Limit the display of long values
      const displayArgs = args.map((arg) => {
        if (arg.length > 50) {
          return arg.substring(0, 50) + "...";
        }
        return arg;
      });
      readableCommand = `${command} ${displayArgs.join(" ")}`;
    }

    // Create a SQL-like representation for compatibility
    let sql = readableCommand;
    if (args.length > 0) {
      const key = args[0];
      switch (command) {
        case "GET":
          sql = `SELECT value FROM redis WHERE key = '${key}'`;
          break;
        case "SET":
          const value = args[1] || "";
          sql = `INSERT INTO redis (key, value) VALUES ('${key}', '${value}')`;
          break;
        case "DEL":
          sql = `DELETE FROM redis WHERE key = '${key}'`;
          break;
        case "HGET":
          const field = args[1] || "";
          sql = `SELECT ${field} FROM redis WHERE key = '${key}'`;
          break;
        case "HSET":
          const hfield = args[1] || "";
          const hvalue = args[2] || "";
          sql = `UPDATE redis SET ${hfield} = '${hvalue}' WHERE key = '${key}'`;
          break;
        case "LPUSH":
        case "RPUSH":
          sql = `INSERT INTO redis_list (key, value) VALUES ('${key}', '${args
            .slice(1)
            .join(", ")}')`;
          break;
        case "LPOP":
        case "RPOP":
          sql = `DELETE FROM redis_list WHERE key = '${key}' LIMIT 1`;
          break;
        case "LRANGE":
          const start = args[1] || "0";
          const end = args[2] || "-1";
          sql = `SELECT * FROM redis_list WHERE key = '${key}' LIMIT ${start}, ${end}`;
          break;
        default:
          sql = readableCommand;
      }
    }

    const isQuery = ![
      "PING",
      "ECHO",
      "AUTH",
      "SELECT",
      "QUIT",
      "INFO",
      "CONFIG",
    ].includes(command);

    return {
      type: commandType,
      command: command,
      args: args,
      readableCommand: readableCommand,
      sql: sql, // For compatibility with other parsers
      isQuery: isQuery,
      protocol: "redis",
      raw: commandArray.join(" ").substring(0, 200),
    };
  }

  parseResponse(data) {
    try {
      if (!data || data.length === 0) {
        return {
          type: "empty",
          raw: "",
          isError: false,
          protocol: "redis",
        };
      }

      const result = this.parseRESP(data, 0);
      if (!result) {
        return {
          type: "incomplete",
          raw: data.toString().substring(0, 200),
          isError: false,
          protocol: "redis",
        };
      }

      const { value } = result;
      const firstChar = String.fromCharCode(data[0]);
      const responseType = this.responseTypes[firstChar] || "Unknown";

      let isError = false;
      let errorInfo = null;

      if (firstChar === "-") {
        isError = true;
        errorInfo = {
          message: String(value),
          type: "redis_error",
        };
      }

      return {
        type: responseType,
        value: value,
        isError: isError,
        errorInfo: errorInfo,
        protocol: "redis",
        raw: data.toString().substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString().substring(0, 200),
        isError: true,
        protocol: "redis",
      };
    }
  }

  parseRESP(buffer, offset = 0) {
    if (offset >= buffer.length) {
      return null;
    }

    const type = String.fromCharCode(buffer[offset]);

    switch (type) {
      case "+": // Simple String
        return this.parseSimpleString(buffer, offset);
      case "-": // Error
        return this.parseError(buffer, offset);
      case ":": // Integer
        return this.parseInteger(buffer, offset);
      case "$": // Bulk String
        return this.parseBulkString(buffer, offset);
      case "*": // Array
        return this.parseArray(buffer, offset);
      default:
        // Try to parse as inline command (for testing)
        return this.parseInlineCommand(buffer, offset);
    }
  }

  parseSimpleString(buffer, offset) {
    const start = offset + 1; // Skip the '+'
    const end = buffer.indexOf("\r\n", start);

    if (end === -1) {
      return null; // Incomplete
    }

    const value = buffer.slice(start, end).toString("utf8");
    return {
      value: value,
      bytesRead: end - offset + 2, // Include \r\n
    };
  }

  parseError(buffer, offset) {
    const start = offset + 1; // Skip the '-'
    const end = buffer.indexOf("\r\n", start);

    if (end === -1) {
      return null; // Incomplete
    }

    const value = buffer.slice(start, end).toString("utf8");
    return {
      value: value,
      bytesRead: end - offset + 2, // Include \r\n
    };
  }

  parseInteger(buffer, offset) {
    const start = offset + 1; // Skip the ':'
    const end = buffer.indexOf("\r\n", start);

    if (end === -1) {
      return null; // Incomplete
    }

    const value = parseInt(buffer.slice(start, end).toString("utf8"), 10);
    return {
      value: value,
      bytesRead: end - offset + 2, // Include \r\n
    };
  }

  parseBulkString(buffer, offset) {
    const start = offset + 1; // Skip the '$'
    const lengthEnd = buffer.indexOf("\r\n", start);

    if (lengthEnd === -1) {
      return null; // Incomplete
    }

    const length = parseInt(
      buffer.slice(start, lengthEnd).toString("utf8"),
      10
    );

    if (length === -1) {
      // Null bulk string
      return {
        value: null,
        bytesRead: lengthEnd - offset + 2,
      };
    }

    const dataStart = lengthEnd + 2;
    const dataEnd = dataStart + length;

    if (dataEnd + 2 > buffer.length) {
      return null; // Incomplete
    }

    const value = buffer.slice(dataStart, dataEnd).toString("utf8");
    return {
      value: value,
      bytesRead: dataEnd - offset + 2, // Include final \r\n
    };
  }

  parseArray(buffer, offset) {
    const start = offset + 1; // Skip the '*'
    const countEnd = buffer.indexOf("\r\n", start);

    if (countEnd === -1) {
      return null; // Incomplete
    }

    const count = parseInt(buffer.slice(start, countEnd).toString("utf8"), 10);

    if (count === -1) {
      // Null array
      return {
        value: null,
        bytesRead: countEnd - offset + 2,
      };
    }

    const elements = [];
    let currentOffset = countEnd + 2;

    for (let i = 0; i < count; i++) {
      const element = this.parseRESP(buffer, currentOffset);
      if (!element) {
        return null; // Incomplete
      }

      elements.push(element.value);
      currentOffset += element.bytesRead;
    }

    return {
      value: elements,
      bytesRead: currentOffset - offset,
    };
  }

  parseInlineCommand(buffer, offset) {
    // Parse inline commands (used in testing scenarios)
    const end = buffer.indexOf("\r\n", offset);

    if (end === -1) {
      return null; // Incomplete
    }

    const line = buffer.slice(offset, end).toString("utf8");
    const parts = line.split(" ").filter((part) => part.length > 0);

    return {
      value: parts,
      bytesRead: end - offset + 2,
    };
  }

  generateMockResponse(mock, originalQuery) {
    try {
      const response = mock.response;

      if (response.isError) {
        return this.generateErrorResponse(response.errorInfo || response.error);
      }

      // Generate response based on the original command
      const command = originalQuery.command;

      if (response.value !== undefined) {
        return this.generateValueResponse(response.value);
      } else if (response.values && Array.isArray(response.values)) {
        return this.generateArrayResponse(response.values);
      } else if (response.rows && Array.isArray(response.rows)) {
        // Convert SQL-style response to Redis format
        return this.generateArrayResponse(response.rows);
      } else {
        // Default success response
        return this.generateSuccessResponse(command);
      }
    } catch (error) {
      return this.generateErrorResponse({
        message: "Mock generation failed: " + error.message,
      });
    }
  }

  generateSuccessResponse(command) {
    switch (command) {
      case "SET":
      case "HSET":
      case "LPUSH":
      case "RPUSH":
      case "SADD":
      case "ZADD":
        return this.encodeSimpleString("OK");
      case "DEL":
      case "HDEL":
      case "LREM":
      case "SREM":
      case "ZREM":
        return this.encodeInteger(1);
      case "INCR":
      case "DECR":
      case "INCRBY":
      case "DECRBY":
      case "HINCRBY":
      case "ZINCRBY":
        return this.encodeInteger(1);
      default:
        return this.encodeSimpleString("OK");
    }
  }

  generateValueResponse(value) {
    if (value === null || value === undefined) {
      return this.encodeNull();
    } else if (typeof value === "number") {
      return this.encodeInteger(value);
    } else if (typeof value === "string") {
      return this.encodeBulkString(value);
    } else {
      return this.encodeBulkString(JSON.stringify(value));
    }
  }

  generateArrayResponse(values) {
    return this.encodeArray(values);
  }

  generateErrorResponse(errorInfo) {
    const message = errorInfo.message || "ERR mock error";
    return this.encodeError(message);
  }

  // RESP encoding methods
  encodeSimpleString(str) {
    return Buffer.from(`+${str}\r\n`, "utf8");
  }

  encodeError(str) {
    return Buffer.from(`-${str}\r\n`, "utf8");
  }

  encodeInteger(num) {
    return Buffer.from(`:${num}\r\n`, "utf8");
  }

  encodeBulkString(str) {
    if (str === null || str === undefined) {
      return Buffer.from("$-1\r\n", "utf8");
    }
    const data = Buffer.from(str, "utf8");
    return Buffer.concat([
      Buffer.from(`$${data.length}\r\n`, "utf8"),
      data,
      Buffer.from("\r\n", "utf8"),
    ]);
  }

  encodeNull() {
    return Buffer.from("$-1\r\n", "utf8");
  }

  encodeArray(arr) {
    if (arr === null || arr === undefined) {
      return Buffer.from("*-1\r\n", "utf8");
    }

    const buffers = [Buffer.from(`*${arr.length}\r\n`, "utf8")];

    for (const item of arr) {
      if (typeof item === "number") {
        buffers.push(this.encodeInteger(item));
      } else if (typeof item === "string") {
        buffers.push(this.encodeBulkString(item));
      } else if (item === null || item === undefined) {
        buffers.push(this.encodeNull());
      } else {
        buffers.push(this.encodeBulkString(JSON.stringify(item)));
      }
    }

    return Buffer.concat(buffers);
  }
}

module.exports = RedisParser;
