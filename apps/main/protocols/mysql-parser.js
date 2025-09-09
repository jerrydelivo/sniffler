class MySQLParser {
  constructor() {
    this.commandTypes = {
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
      0x16: "COM_STMT_PREPARE",
      0x17: "COM_STMT_EXECUTE",
      0x18: "COM_STMT_SEND_LONG_DATA",
      0x19: "COM_STMT_CLOSE",
      0x1a: "COM_STMT_RESET",
      0x1b: "COM_SET_OPTION",
      0x1c: "COM_STMT_FETCH",
      0x1d: "COM_DAEMON",
      0x1e: "COM_BINLOG_DUMP_GTID",
      0x1f: "COM_RESET_CONNECTION",
    };

    this.fieldTypes = {
      0x00: "DECIMAL",
      0x01: "TINY",
      0x02: "SHORT",
      0x03: "LONG",
      0x04: "FLOAT",
      0x05: "DOUBLE",
      0x06: "NULL",
      0x07: "TIMESTAMP",
      0x08: "LONGLONG",
      0x09: "INT24",
      0x0a: "DATE",
      0x0b: "TIME",
      0x0c: "DATETIME",
      0x0d: "YEAR",
      0x0e: "NEWDATE",
      0x0f: "VARCHAR",
      0x10: "BIT",
      0xf6: "NEWDECIMAL",
      0xf7: "ENUM",
      0xf8: "SET",
      0xf9: "TINY_BLOB",
      0xfa: "MEDIUM_BLOB",
      0xfb: "LONG_BLOB",
      0xfc: "BLOB",
      0xfd: "VAR_STRING",
      0xfe: "STRING",
      0xff: "GEOMETRY",
    };
  }

  parseQueries(buffer) {
    // Parse multiple MySQL packets from a buffer
    const queries = [];
    let offset = 0;

    while (offset < buffer.length) {
      // MySQL packet format: length (3 bytes) + sequence (1 byte) + payload
      if (offset + 4 > buffer.length) {
        // Not enough data for packet header
        break;
      }

      // Read packet length (3 bytes, little-endian)
      const packetLength = buffer.readUIntLE(offset, 3);
      const totalPacketSize = packetLength + 4; // +4 for header

      if (offset + totalPacketSize > buffer.length) {
        // Not enough data for complete packet
        break;
      }

      // Extract and parse the complete packet
      const packetData = buffer.slice(offset, offset + totalPacketSize);
      const query = this.parseQuery(packetData);
      if (query) {
        queries.push(query);
      }

      offset += totalPacketSize;
    }

    return queries;
  }

  parseQuery(data) {
    try {
      if (data.length < 4) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isQuery: false,
        };
      }

      // MySQL packet header: 3 bytes length + 1 byte sequence
      const packetLength = data.readUIntLE(0, 3);
      const sequenceId = data[3];

      if (data.length < 5) {
        return {
          type: "header-only",
          packetLength,
          sequenceId,
          isQuery: false,
          protocol: "mysql",
        };
      }

      const commandType = data[4];
      const commandName = this.commandTypes[commandType] || "Unknown Command";
      const payload = data.slice(5);

      let sql = "";
      let parameters = [];
      let statementId = null;

      if (commandType === 0x03) {
        // COM_QUERY
        sql = payload.toString("utf8").trim();
      } else if (commandType === 0x16) {
        // COM_STMT_PREPARE
        sql = payload.toString("utf8").trim();
      } else if (commandType === 0x17) {
        // COM_STMT_EXECUTE
        if (payload.length >= 4) {
          statementId = payload.readUInt32LE(0);
          // Parse parameters (simplified)
          parameters = this.parseExecuteParameters(payload.slice(4));
        }
      }

      const isQuery =
        [0x03, 0x16, 0x17].includes(commandType) &&
        sql &&
        sql.trim().length > 0;

      // Extract SQL command type if we have SQL
      let queryType = commandName;
      if (sql && sql.trim().length > 0) {
        queryType = this.extractSQLCommandType(sql) || commandName;
      }

      return {
        type: queryType,
        commandType: `0x${commandType.toString(16).padStart(2, "0")}`,
        packetLength,
        sequenceId,
        payload:
          payload.length > 500
            ? payload.toString("utf8").substring(0, 500) + "..."
            : payload.toString("utf8"),
        sql: sql || null,
        parameters,
        statementId,
        isQuery,
        protocol: "mysql",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isQuery: false,
        protocol: "mysql",
      };
    }
  }

  parseResponse(data) {
    try {
      if (data.length < 4) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isError: false,
        };
      }

      const packetLength = data.readUIntLE(0, 3);
      const sequenceId = data[3];

      if (data.length < 5) {
        return {
          type: "header-only",
          packetLength,
          sequenceId,
          isError: false,
          protocol: "mysql",
        };
      }

      const firstByte = data[4];
      let responseType = "Unknown";
      let isError = false;
      let isOK = false;
      let fields = [];
      let rows = [];
      let errorInfo = null;
      let affectedRows = 0;
      let insertId = 0;

      // Determine response type based on first byte of payload
      if (firstByte === 0x00) {
        responseType = "OK Packet";
        isOK = true;
        const okInfo = this.parseOKPacket(data.slice(4));
        affectedRows = okInfo.affectedRows;
        insertId = okInfo.insertId;
      } else if (firstByte === 0xff) {
        responseType = "Error Packet";
        isError = true;
        errorInfo = this.parseErrorPacket(data.slice(4));
      } else if (firstByte === 0xfe && packetLength < 9) {
        responseType = "EOF Packet";
      } else if (firstByte >= 0x01 && firstByte <= 0xfa) {
        // Result Set - first packet contains column count
        responseType = "Result Set Header";
        const columnCount = this.readLengthEncodedInteger(data.slice(4));
        fields = [{ columnCount }];
      } else {
        responseType = "Unknown Response";
      }

      return {
        type: responseType,
        packetLength,
        sequenceId,
        isError,
        isOK,
        fields,
        rows,
        errorInfo,
        affectedRows,
        insertId,
        protocol: "mysql",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isError: true,
        protocol: "mysql",
      };
    }
  }

  parseOKPacket(data) {
    try {
      let offset = 1; // Skip OK flag (0x00)

      const affectedRows = this.readLengthEncodedInteger(data.slice(offset));
      offset += this.getLengthEncodedIntegerSize(affectedRows);

      const insertId = this.readLengthEncodedInteger(data.slice(offset));
      offset += this.getLengthEncodedIntegerSize(insertId);

      let statusFlags = 0;
      let warnings = 0;

      if (offset + 2 <= data.length) {
        statusFlags = data.readUInt16LE(offset);
        offset += 2;
      }

      if (offset + 2 <= data.length) {
        warnings = data.readUInt16LE(offset);
        offset += 2;
      }

      let info = "";
      if (offset < data.length) {
        info = data.slice(offset).toString("utf8");
      }

      return {
        affectedRows,
        insertId,
        statusFlags,
        warnings,
        info,
      };
    } catch (error) {
      return { affectedRows: 0, insertId: 0, error: error.message };
    }
  }

  parseErrorPacket(data) {
    try {
      let offset = 1; // Skip error flag (0xff)

      const errorCode = data.readUInt16LE(offset);
      offset += 2;

      let sqlState = "";
      let message = "";

      if (offset < data.length && data[offset] === 0x23) {
        // '#' marker for SQL state
        offset++; // Skip '#'
        sqlState = data.slice(offset, offset + 5).toString("utf8");
        offset += 5;
      }

      if (offset < data.length) {
        message = data.slice(offset).toString("utf8");
      }

      return {
        errorCode,
        sqlState,
        message,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  parseExecuteParameters(data) {
    try {
      const parameters = [];
      // This is a simplified implementation
      // Real parameter parsing would need to handle different data types
      return parameters;
    } catch (error) {
      return [];
    }
  }

  readLengthEncodedInteger(data) {
    if (data.length === 0) return 0;

    const firstByte = data[0];

    if (firstByte < 0xfb) {
      return firstByte;
    } else if (firstByte === 0xfc) {
      return data.length >= 3 ? data.readUInt16LE(1) : 0;
    } else if (firstByte === 0xfd) {
      return data.length >= 4 ? data.readUIntLE(1, 3) : 0;
    } else if (firstByte === 0xfe) {
      return data.length >= 9 ? Number(data.readBigUInt64LE(1)) : 0;
    }

    return 0;
  }

  getLengthEncodedIntegerSize(value) {
    if (value < 0xfb) {
      return 1;
    } else if (value < 0x10000) {
      return 3;
    } else if (value < 0x1000000) {
      return 4;
    } else {
      return 9;
    }
  }

  generateMockResponse(mock, originalQuery) {
    try {
      const response = mock.response;

      if (response.isError) {
        return this.generateErrorPacket(response.errorInfo || response.error);
      }

      if (response.rows && response.rows.length > 0) {
        // Generate result set response using actual field metadata
        return this.generateResultSet(response);
      } else {
        // Generate OK packet for non-SELECT queries
        return this.generateOKPacket(response);
      }
    } catch (error) {
      // console.error("Error generating MySQL mock response:", error);
      return this.generateErrorPacket({
        message: "Mock generation failed",
        errorCode: 1064,
      });
    }
  }

  generateOKPacket(response) {
    const affectedRows = response.affectedRows || 1;
    const insertId = response.insertId || 0;
    const statusFlags = 0x0002; // AUTOCOMMIT
    const warnings = 0;

    const buffers = [];

    // Packet header will be added later
    buffers.push(Buffer.from([0x00])); // OK flag
    buffers.push(this.writeLengthEncodedInteger(affectedRows));
    buffers.push(this.writeLengthEncodedInteger(insertId));

    const statusBuffer = Buffer.allocUnsafe(2);
    statusBuffer.writeUInt16LE(statusFlags, 0);
    buffers.push(statusBuffer);

    const warningsBuffer = Buffer.allocUnsafe(2);
    warningsBuffer.writeUInt16LE(warnings, 0);
    buffers.push(warningsBuffer);

    const payload = Buffer.concat(buffers);
    return this.addPacketHeader(payload, 1);
  }

  generateErrorPacket(errorInfo) {
    const errorCode = errorInfo.errorCode || 1064;
    const sqlState = errorInfo.sqlState || "42000";
    const message = errorInfo.message || "Mock error";

    const buffers = [];

    buffers.push(Buffer.from([0xff])); // Error flag

    const errorCodeBuffer = Buffer.allocUnsafe(2);
    errorCodeBuffer.writeUInt16LE(errorCode, 0);
    buffers.push(errorCodeBuffer);

    buffers.push(Buffer.from("#" + sqlState + message, "utf8"));

    const payload = Buffer.concat(buffers);
    return this.addPacketHeader(payload, 1);
  }

  generateResultSet(response) {
    const buffers = [];
    const fields = response.fields || this.inferFields(response.rows[0]);

    // Column count packet
    const columnCountBuffer = this.writeLengthEncodedInteger(fields.length);
    buffers.push(this.addPacketHeader(columnCountBuffer, 1));

    // Column definition packets
    fields.forEach((field, index) => {
      const fieldPacket = this.generateFieldPacket(field);
      buffers.push(this.addPacketHeader(fieldPacket, index + 2));
    });

    // EOF packet after field definitions
    buffers.push(
      this.addPacketHeader(
        Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]),
        fields.length + 2
      )
    );

    // Row data packets
    response.rows.forEach((row, index) => {
      const rowPacket = this.generateRowPacket(row, fields);
      buffers.push(this.addPacketHeader(rowPacket, fields.length + 3 + index));
    });

    // Final EOF packet
    const finalSeq = fields.length + 3 + response.rows.length;
    buffers.push(
      this.addPacketHeader(
        Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]),
        finalSeq
      )
    );

    return Buffer.concat(buffers);
  }

  generateFieldPacket(field) {
    const buffers = [];

    // Catalog (usually "def")
    buffers.push(this.writeLengthEncodedString("def"));

    // Schema
    buffers.push(this.writeLengthEncodedString(field.schema || ""));

    // Table
    buffers.push(this.writeLengthEncodedString(field.table || ""));

    // Original table
    buffers.push(this.writeLengthEncodedString(field.table || ""));

    // Name
    buffers.push(this.writeLengthEncodedString(field.name));

    // Original name
    buffers.push(this.writeLengthEncodedString(field.name));

    // Length of fixed-length fields
    buffers.push(this.writeLengthEncodedInteger(0x0c));

    // Character set (utf8_general_ci = 33)
    const charsetBuffer = Buffer.allocUnsafe(2);
    charsetBuffer.writeUInt16LE(33, 0);
    buffers.push(charsetBuffer);

    // Column length
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32LE(255, 0);
    buffers.push(lengthBuffer);

    // Type (VARCHAR = 0xfd)
    buffers.push(Buffer.from([0xfd]));

    // Flags
    const flagsBuffer = Buffer.allocUnsafe(2);
    flagsBuffer.writeUInt16LE(0, 0);
    buffers.push(flagsBuffer);

    // Decimals
    buffers.push(Buffer.from([0x00]));

    // Filler
    buffers.push(Buffer.from([0x00, 0x00]));

    return Buffer.concat(buffers);
  }

  generateRowPacket(row, fields) {
    const buffers = [];

    fields.forEach((field) => {
      const value = row[field.name];
      if (value === null || value === undefined) {
        buffers.push(Buffer.from([0xfb])); // NULL value
      } else {
        const valueStr = String(value);
        buffers.push(this.writeLengthEncodedString(valueStr));
      }
    });

    return Buffer.concat(buffers);
  }

  inferFields(firstRow) {
    if (!firstRow) return [];

    return Object.keys(firstRow).map((name) => ({
      name,
      type: "VARCHAR",
    }));
  }

  writeLengthEncodedInteger(value) {
    if (value < 0xfb) {
      return Buffer.from([value]);
    } else if (value < 0x10000) {
      const buffer = Buffer.allocUnsafe(3);
      buffer[0] = 0xfc;
      buffer.writeUInt16LE(value, 1);
      return buffer;
    } else if (value < 0x1000000) {
      const buffer = Buffer.allocUnsafe(4);
      buffer[0] = 0xfd;
      buffer.writeUIntLE(value, 1, 3);
      return buffer;
    } else {
      const buffer = Buffer.allocUnsafe(9);
      buffer[0] = 0xfe;
      buffer.writeBigUInt64LE(BigInt(value), 1);
      return buffer;
    }
  }

  writeLengthEncodedString(str) {
    const stringBuffer = Buffer.from(str, "utf8");
    const lengthBuffer = this.writeLengthEncodedInteger(stringBuffer.length);
    return Buffer.concat([lengthBuffer, stringBuffer]);
  }

  addPacketHeader(payload, sequenceId) {
    const header = Buffer.allocUnsafe(4);

    // Write length (3 bytes, little endian)
    header.writeUIntLE(payload.length, 0, 3);

    // Write sequence ID
    header[3] = sequenceId;

    return Buffer.concat([header, payload]);
  }

  extractSQLCommandType(sql) {
    if (!sql || typeof sql !== "string") return null;

    const trimmed = sql.trim().toUpperCase();
    const firstWord = trimmed.split(/\s+/)[0];

    // Map SQL commands to standardized types
    const commandMap = {
      SELECT: "SELECT",
      INSERT: "INSERT",
      UPDATE: "UPDATE",
      DELETE: "DELETE",
      CREATE: "CREATE",
      DROP: "DROP",
      ALTER: "ALTER",
      SHOW: "SHOW",
      DESCRIBE: "DESCRIBE",
      DESC: "DESCRIBE",
      EXPLAIN: "EXPLAIN",
      CALL: "CALL",
      SET: "SET",
      USE: "USE",
    };

    return commandMap[firstWord] || null;
  }
}

module.exports = MySQLParser;
