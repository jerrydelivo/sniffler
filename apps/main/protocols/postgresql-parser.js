class PostgreSQLParser {
  constructor() {
    this.messageTypes = {
      // Client messages
      Q: "Simple Query",
      P: "Parse",
      B: "Bind",
      E: "Execute",
      D: "Describe",
      S: "Sync",
      H: "Flush",
      C: "Close",
      X: "Terminate",
      p: "Password Message",
      F: "Function Call",

      // Server messages
      R: "Authentication",
      S: "Parameter Status",
      K: "Backend Key Data",
      Z: "Ready for Query",
      T: "Row Description",
      D: "Data Row",
      C: "Command Complete",
      E: "Error Response",
      N: "Notice Response",
      1: "Parse Complete",
      2: "Bind Complete",
      3: "Close Complete",
      A: "Notification Response",
      G: "Copy In Response",
      H: "Copy Out Response",
      W: "Copy Both Response",
      d: "Copy Data",
      c: "Copy Done",
      f: "Copy Fail",
      I: "Empty Query Response",
      n: "No Data",
      s: "Portal Suspended",
      t: "Parameter Description",
      V: "Function Call Response",
    };
  }

  parseQueries(buffer) {
    // Parse multiple queries from a buffer
    const queries = [];
    let offset = 0;

    while (offset < buffer.length) {
      // Try to extract a complete message
      if (offset + 4 > buffer.length) {
        // Not enough data for a complete message
        break;
      }

      let messageLength;
      let messageStart = offset;

      // Check if this looks like a startup message (length at the beginning)
      const possibleLength = buffer.readUInt32BE(offset);
      if (
        possibleLength === buffer.length - offset &&
        offset + 8 <= buffer.length
      ) {
        const protocolVersion = buffer.readUInt32BE(offset + 4);
        if (protocolVersion === 196608) {
          // Protocol 3.0
          messageLength = possibleLength;
          messageStart = offset;
        }
      }

      // If not a startup message, look for regular message format
      if (!messageLength && offset + 5 <= buffer.length) {
        // Regular message: type (1 byte) + length (4 bytes) + data
        messageLength = buffer.readUInt32BE(offset + 1) + 1; // +1 for message type
        messageStart = offset;
      }

      if (!messageLength || messageStart + messageLength > buffer.length) {
        // Not enough data for complete message
        break;
      }

      // Extract and parse the complete message
      const messageData = buffer.slice(
        messageStart,
        messageStart + messageLength
      );
      const query = this.parseQuery(messageData);
      if (query) {
        queries.push(query);
      }

      offset = messageStart + messageLength;
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

      // Check if this is a startup message (starts with length, not message type)
      const possibleLength = data.readUInt32BE(0);
      if (possibleLength === data.length && data.length >= 8) {
        const protocolVersion = data.readUInt32BE(4);
        if (protocolVersion === 196608) {
          // Protocol 3.0
          return {
            type: "StartupMessage",
            messageType: null,
            length: possibleLength,
            protocolVersion: "3.0",
            isQuery: false, // Startup messages are not queries but need forwarding
            isStartup: true,
            protocol: "postgresql",
            raw: data.toString("hex").substring(0, 200),
          };
        }
      }

      if (data.length < 5) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isQuery: false,
        };
      }

      const messageType = String.fromCharCode(data[0]);
      const length = data.readUInt32BE(1);

      let content = "";
      let sql = "";
      let parameters = [];

      if (data.length >= 5) {
        const payload = data.slice(5);
        content = payload.toString("utf8");

        // Extract SQL from different message types
        if (messageType === "Q") {
          // Simple Query - SQL is the entire payload (minus null terminator)
          sql = content.replace(/\0$/, "").trim();
        } else if (messageType === "P") {
          // Parse - extract statement name and SQL
          // Format: statement_name\0sql_query\0param_count\0param_types...
          const nullIndex = content.indexOf("\0");
          if (nullIndex !== -1) {
            const afterStatementName = content.substring(nullIndex + 1);
            const nextNullIndex = afterStatementName.indexOf("\0");
            if (nextNullIndex !== -1) {
              sql = afterStatementName.substring(0, nextNullIndex).trim();
            } else {
              sql = afterStatementName.trim();
            }
          } else {
            // Fallback: try to extract SQL from the entire content
            const cleanContent = content.replace(/[^\x20-\x7E]/g, " ").trim();
            if (
              /^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER|EXPLAIN|SHOW)/i.test(
                cleanContent
              )
            ) {
              sql = cleanContent;
            }
          }
        } else if (messageType === "B") {
          // Bind - extract portal name, statement name, and parameters
          const bindParts = content.split("\0");
          // Parse parameter values (simplified)
          parameters = this.extractParametersFromBind(payload);
        }
      }

      const isQuery =
        (messageType === "Q" && sql && sql.trim().length > 0) ||
        messageType === "E" ||
        (messageType === "P" && sql && sql.trim().length > 0);
      const isQueryPart = ["P", "B"].includes(messageType);
      const typeName = this.messageTypes[messageType] || "Unknown";

      // Determine SQL query type based on SQL content
      let sqlQueryType = "Unknown";
      if (sql && sql.trim()) {
        sqlQueryType = this.determineSQLQueryType(sql);
      }

      return {
        type: typeName,
        sqlQueryType: sqlQueryType,
        messageType,
        length,
        content:
          content.length > 500 ? content.substring(0, 500) + "..." : content,
        sql: sql || null,
        parameters,
        isQuery,
        isQueryPart,
        protocol: "postgresql",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isQuery: false,
        protocol: "postgresql",
      };
    }
  }

  parseResponse(data) {
    try {
      if (data.length < 5) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isError: false,
        };
      }

      const messageType = String.fromCharCode(data[0]);
      const length = data.readUInt32BE(1);
      const typeName = this.messageTypes[messageType] || "Unknown Response";

      let fields = [];
      let rows = [];
      let errorInfo = null;
      let commandTag = null;

      if (messageType === "T") {
        // Row Description - parse field information
        fields = this.parseRowDescription(data.slice(5));
      } else if (messageType === "D") {
        // Data Row - parse row data
        rows = this.parseDataRow(data.slice(5));
      } else if (messageType === "C") {
        // Command Complete - extract command tag
        commandTag = data.slice(5).toString("utf8").replace(/\0/g, "").trim();
      } else if (messageType === "E") {
        // Error Response - parse error fields
        errorInfo = this.parseErrorResponse(data.slice(5));
      }

      return {
        type: typeName,
        messageType,
        length,
        isError:
          messageType === "E" || this.detectErrorInResponse(data, messageType),
        isComplete: messageType === "C",
        isReady: messageType === "Z",
        fields,
        rows,
        errorInfo,
        commandTag,
        protocol: "postgresql",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isError: true,
        protocol: "postgresql",
      };
    }
  }

  detectErrorInResponse(data, messageType) {
    try {
      // Convert the data to string to look for error messages
      const dataStr = data.toString("utf8", 5); // Skip the header

      // Common PostgreSQL error patterns
      const errorPatterns = [
        /table .* doesn't exist/i,
        /relation .* does not exist/i,
        /column .* does not exist/i,
        /syntax error/i,
        /permission denied/i,
        /connection failed/i,
        /timeout/i,
        /error/i,
      ];

      // Check if any error pattern matches
      for (const pattern of errorPatterns) {
        if (pattern.test(dataStr)) {
          return true;
        }
      }

      // Also check for unknown message types that might contain errors
      if (messageType === "*" || !this.messageTypes[messageType]) {
        // Try to parse as string and look for error indicators
        const fullStr = data.toString("utf8");
        return /error|fail|invalid|denied|timeout|not exist|doesn't exist/i.test(
          fullStr
        );
      }

      return false;
    } catch (error) {
      // If we can't parse it, assume it might be an error
      return true;
    }
  }

  parseRowDescription(data) {
    try {
      const fields = [];
      let offset = 0;

      if (data.length < 2) return fields;

      const fieldCount = data.readUInt16BE(offset);
      offset += 2;

      for (let i = 0; i < fieldCount && offset < data.length; i++) {
        // Field name (null-terminated string)
        let nameEnd = offset;
        while (nameEnd < data.length && data[nameEnd] !== 0) nameEnd++;

        if (nameEnd >= data.length) break;

        const name = data.slice(offset, nameEnd).toString("utf8");
        offset = nameEnd + 1;

        if (offset + 18 > data.length) break;

        const tableOid = data.readUInt32BE(offset);
        const columnNumber = data.readUInt16BE(offset + 4);
        const typeOid = data.readUInt32BE(offset + 6);
        const typeSize = data.readInt16BE(offset + 10);
        const typeModifier = data.readInt32BE(offset + 12);
        const formatCode = data.readUInt16BE(offset + 16);

        fields.push({
          name,
          tableOid,
          columnNumber,
          typeOid,
          typeSize,
          typeModifier,
          formatCode,
        });

        offset += 18;
      }

      return fields;
    } catch (error) {
      return [];
    }
  }

  parseDataRow(data) {
    try {
      const values = [];
      let offset = 0;

      if (data.length < 2) return values;

      const columnCount = data.readUInt16BE(offset);
      offset += 2;

      for (let i = 0; i < columnCount && offset < data.length; i++) {
        if (offset + 4 > data.length) break;

        const valueLength = data.readInt32BE(offset);
        offset += 4;

        if (valueLength === -1) {
          // NULL value
          values.push(null);
        } else if (valueLength >= 0 && offset + valueLength <= data.length) {
          const value = data
            .slice(offset, offset + valueLength)
            .toString("utf8");
          values.push(value);
          offset += valueLength;
        } else {
          break;
        }
      }

      return values;
    } catch (error) {
      return [];
    }
  }

  parseErrorResponse(data) {
    try {
      const errorInfo = {};
      let offset = 0;

      while (offset < data.length) {
        const fieldType = String.fromCharCode(data[offset]);
        if (fieldType === "\0") break;

        offset++;

        // Find the end of the field value (null-terminated)
        let valueEnd = offset;
        while (valueEnd < data.length && data[valueEnd] !== 0) valueEnd++;

        if (valueEnd >= data.length) break;

        const value = data.slice(offset, valueEnd).toString("utf8");

        // Map field types to readable names
        const fieldMap = {
          S: "severity",
          C: "code",
          M: "message",
          D: "detail",
          H: "hint",
          P: "position",
          p: "internal_position",
          q: "internal_query",
          W: "where",
          s: "schema",
          t: "table",
          c: "column",
          d: "datatype",
          n: "constraint",
          F: "file",
          L: "line",
          R: "routine",
        };

        const fieldName = fieldMap[fieldType] || fieldType;
        errorInfo[fieldName] = value;

        offset = valueEnd + 1;
      }

      return errorInfo;
    } catch (error) {
      return { error: error.message };
    }
  }

  extractParametersFromBind(data) {
    try {
      const parameters = [];
      let offset = 0;

      // Skip portal name and statement name (null-terminated strings)
      while (offset < data.length && data[offset] !== 0) offset++;
      offset++; // Skip null terminator
      while (offset < data.length && data[offset] !== 0) offset++;
      offset++; // Skip null terminator

      if (offset + 2 > data.length) return parameters;

      // Parameter format codes count
      const formatCodeCount = data.readUInt16BE(offset);
      offset += 2 + formatCodeCount * 2; // Skip format codes

      if (offset + 2 > data.length) return parameters;

      // Parameter values count
      const parameterCount = data.readUInt16BE(offset);
      offset += 2;

      for (let i = 0; i < parameterCount && offset < data.length; i++) {
        if (offset + 4 > data.length) break;

        const paramLength = data.readInt32BE(offset);
        offset += 4;

        if (paramLength === -1) {
          parameters.push(null);
        } else if (paramLength >= 0 && offset + paramLength <= data.length) {
          const paramValue = data
            .slice(offset, offset + paramLength)
            .toString("utf8");
          parameters.push(paramValue);
          offset += paramLength;
        } else {
          break;
        }
      }

      return parameters;
    } catch (error) {
      return [];
    }
  }

  generateMockResponse(mock, originalQuery) {
    try {
      const response = mock.response;

      if (response.isError) {
        // Generate error response
        return this.generateErrorResponse(response.errorInfo || response.error);
      }

      // Generate successful response sequence
      const buffers = [];

      // If we have fields and row data, send RowDescription first
      if (response.fields && response.fields.length > 0) {
        buffers.push(this.generateRowDescription(response.fields));

        // Send data rows using the actual field structure
        if (response.rows && response.rows.length > 0) {
          // Handle both array-of-arrays and single-array row data formats
          if (Array.isArray(response.rows[0])) {
            // Multiple rows as array of arrays
            for (const row of response.rows) {
              buffers.push(this.generateDataRow(row, response.fields));
            }
          } else {
            // Single row as array of values
            buffers.push(this.generateDataRow(response.rows, response.fields));
          }
        }
      } else if (response.rows && response.rows.length > 0) {
        // Fallback: infer fields from row data if no field metadata available
        const firstRow = response.rows[0];
        const fields = Object.keys(firstRow).map((name) => ({
          name,
          type: "text",
        }));
        buffers.push(this.generateRowDescription(fields));

        // Send data rows
        for (const row of response.rows) {
          buffers.push(this.generateDataRow(row, fields));
        }
      }

      // Send CommandComplete
      const commandTag =
        response.commandTag || this.generateCommandTag(originalQuery, response);
      buffers.push(this.generateCommandComplete(commandTag));

      // Send ReadyForQuery
      buffers.push(this.generateReadyForQuery());

      return Buffer.concat(buffers);
    } catch (error) {
      // console.error("Error generating PostgreSQL mock response:", error);
      return this.generateErrorResponse("Mock generation failed");
    }
  }

  generateRowDescription(fields) {
    const buffers = [Buffer.from("T")]; // Message type
    const fieldBuffers = [];

    fieldBuffers.push(Buffer.allocUnsafe(2));
    fieldBuffers[0].writeUInt16BE(fields.length, 0); // Field count

    fields.forEach((field) => {
      const nameBuffer = Buffer.from(field.name + "\0", "utf8");
      const fieldInfo = Buffer.allocUnsafe(18);

      // Use actual field metadata if available, otherwise defaults
      fieldInfo.writeUInt32BE(field.tableOid || 0, 0); // Table OID
      fieldInfo.writeUInt16BE(field.columnNumber || 0, 4); // Column number
      fieldInfo.writeUInt32BE(field.typeOid || 25, 6); // Type OID (default to 25 = text)
      fieldInfo.writeInt16BE(field.typeSize || -1, 10); // Type size
      fieldInfo.writeInt32BE(field.typeModifier || -1, 12); // Type modifier
      fieldInfo.writeUInt16BE(field.formatCode || 0, 16); // Format code (text)

      fieldBuffers.push(nameBuffer, fieldInfo);
    });

    const contentBuffer = Buffer.concat(fieldBuffers);
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(contentBuffer.length + 4, 0);

    return Buffer.concat([buffers[0], lengthBuffer, contentBuffer]);
  }

  generateDataRow(row, fields) {
    const buffers = [Buffer.from("D")]; // Message type
    const valueBuffers = [];

    valueBuffers.push(Buffer.allocUnsafe(2));
    valueBuffers[0].writeUInt16BE(fields.length, 0); // Column count

    fields.forEach((field) => {
      const value = row[field.name];
      if (value === null || value === undefined) {
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeInt32BE(-1, 0); // NULL value
        valueBuffers.push(lengthBuffer);
      } else {
        const valueStr = String(value);
        const valueBuffer = Buffer.from(valueStr, "utf8");
        const lengthBuffer = Buffer.allocUnsafe(4);
        lengthBuffer.writeUInt32BE(valueBuffer.length, 0);
        valueBuffers.push(lengthBuffer, valueBuffer);
      }
    });

    const contentBuffer = Buffer.concat(valueBuffers);
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(contentBuffer.length + 4, 0);

    return Buffer.concat([buffers[0], lengthBuffer, contentBuffer]);
  }

  generateCommandComplete(commandTag) {
    const tagBuffer = Buffer.from(commandTag + "\0", "utf8");
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(tagBuffer.length + 4, 0);

    return Buffer.concat([Buffer.from("C"), lengthBuffer, tagBuffer]);
  }

  generateReadyForQuery() {
    const statusBuffer = Buffer.from("I"); // Idle status
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(5, 0);

    return Buffer.concat([Buffer.from("Z"), lengthBuffer, statusBuffer]);
  }

  generateErrorResponse(errorInfo) {
    const fields = [];

    // Add severity
    fields.push(
      Buffer.from("S"),
      Buffer.from((errorInfo.severity || "ERROR") + "\0", "utf8")
    );

    // Add code
    fields.push(
      Buffer.from("C"),
      Buffer.from((errorInfo.code || "P0001") + "\0", "utf8")
    );

    // Add message
    fields.push(
      Buffer.from("M"),
      Buffer.from((errorInfo.message || "Mock error") + "\0", "utf8")
    );

    // End of fields
    fields.push(Buffer.from("\0"));

    const contentBuffer = Buffer.concat(fields);
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(contentBuffer.length + 4, 0);

    return Buffer.concat([Buffer.from("E"), lengthBuffer, contentBuffer]);
  }

  generateCommandTag(originalQuery, response) {
    if (response.commandTag) {
      return response.commandTag;
    }

    // Generate appropriate command tag based on query type
    if (originalQuery.sql) {
      const sql = originalQuery.sql.toUpperCase().trim();
      if (sql.startsWith("SELECT")) {
        const rowCount = response.rows ? response.rows.length : 0;
        return `SELECT ${rowCount}`;
      } else if (sql.startsWith("INSERT")) {
        return "INSERT 0 1";
      } else if (sql.startsWith("UPDATE")) {
        return "UPDATE 1";
      } else if (sql.startsWith("DELETE")) {
        return "DELETE 1";
      }
    }

    return "SELECT 0";
  }

  // Determine SQL query type based on SQL content
  determineSQLQueryType(sql) {
    if (!sql || typeof sql !== "string") {
      return "Unknown";
    }

    const cleanSQL = sql.trim().toUpperCase();

    if (cleanSQL.startsWith("SELECT")) {
      return "SELECT";
    } else if (cleanSQL.startsWith("INSERT")) {
      return "INSERT";
    } else if (cleanSQL.startsWith("UPDATE")) {
      return "UPDATE";
    } else if (cleanSQL.startsWith("DELETE")) {
      return "DELETE";
    } else if (cleanSQL.startsWith("CREATE")) {
      return "CREATE";
    } else if (cleanSQL.startsWith("DROP")) {
      return "DROP";
    } else if (cleanSQL.startsWith("ALTER")) {
      return "ALTER";
    } else if (cleanSQL.startsWith("WITH")) {
      return "WITH";
    } else if (cleanSQL.startsWith("EXPLAIN")) {
      return "EXPLAIN";
    } else if (cleanSQL.startsWith("SHOW")) {
      return "SHOW";
    } else {
      return "Other";
    }
  }
}

module.exports = PostgreSQLParser;
