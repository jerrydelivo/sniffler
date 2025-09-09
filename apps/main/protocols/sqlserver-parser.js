class SQLServerParser {
  constructor() {
    this.packetTypes = {
      0x01: "SQL Batch",
      0x02: "Pre-TDS7 Login",
      0x03: "RPC",
      0x04: "Tabular Result",
      0x06: "Attention Signal",
      0x07: "Bulk Load Data",
      0x08: "Federated Authentication Token",
      0x0e: "Transaction Manager Request",
      0x10: "TDS7 Login",
      0x11: "SSPI",
      0x12: "Pre-Login",
    };

    this.tokenTypes = {
      0x81: "TDS_COLMETADATA",
      0xd1: "TDS_ROW",
      0xd3: "TDS_NBCROW",
      0xfd: "TDS_DONE",
      0xfe: "TDS_DONEPROC",
      0xff: "TDS_DONEINPROC",
      0xaa: "TDS_ERROR",
      0xab: "TDS_INFO",
      0xac: "TDS_RETURNVALUE",
      0xa4: "TDS_LOGINACK",
      0xe3: "TDS_ENVCHANGE",
    };

    this.dataTypes = {
      0x00: "NULL",
      0x1f: "NTEXT",
      0x23: "IMAGE",
      0x24: "UNIQUEIDENTIFIER",
      0x26: "INT",
      0x30: "TINYINT",
      0x32: "BIT",
      0x34: "SMALLINT",
      0x38: "BIGINT",
      0x3a: "FLOAT",
      0x3b: "REAL",
      0x3c: "MONEY",
      0x3d: "DATETIME",
      0x3e: "SMALLMONEY",
      0x3f: "SMALLDATETIME",
      0x62: "SQL_VARIANT",
      0x63: "NTEXT",
      0x67: "VARCHAR",
      0x6a: "DECIMAL",
      0x6c: "NUMERIC",
      0x6d: "CHAR",
      0xa5: "BIGVARCHAR",
      0xa7: "BIGCHAR",
      0xad: "BIGBINARY",
      0xaf: "NVARCHAR",
      0xe7: "NVARCHAR",
      0xef: "NCHAR",
      // Add more integer types for literals
      0x7f: "BIGINT",
      0x68: "INT4",
      0x70: "INT8",
    };
  }

  parseQueries(buffer) {
    // Parse multiple SQL Server TDS packets from a buffer
    const queries = [];
    let offset = 0;

    while (offset < buffer.length) {
      // TDS packet format: type (1 byte) + status (1 byte) + length (2 bytes) + spid (2 bytes) + packet id (1 byte) + window (1 byte) + payload
      if (offset + 8 > buffer.length) {
        // Not enough data for TDS packet header
        break;
      }

      // Read packet length (2 bytes, big-endian at offset 2)
      const packetLength = buffer.readUInt16BE(offset + 2);

      if (offset + packetLength > buffer.length) {
        // Not enough data for complete packet
        break;
      }

      // Extract and parse the complete packet
      const packetData = buffer.slice(offset, offset + packetLength);
      const query = this.parseQuery(packetData);
      if (query) {
        queries.push(query);
      }

      offset += packetLength;
    }

    return queries;
  }

  parseQuery(data) {
    try {
      if (data.length < 8) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isQuery: false,
        };
      }

      // TDS packet header
      const type = data.readUInt8(0);
      const status = data.readUInt8(1);
      const length = data.readUInt16BE(2);
      const spid = data.readUInt16BE(4);
      const packetId = data.readUInt8(6);
      const window = data.readUInt8(7);

      const typeName = this.packetTypes[type] || "Unknown Packet";
      let sql = "";
      let parameters = [];
      let loginInfo = null;

      if (data.length > 8) {
        const payload = data.slice(8);

        try {
          if (type === 0x01) {
            // SQL Batch
            sql = this.parseSQLBatch(payload);
          } else if (type === 0x03) {
            // RPC
            const rpcInfo = this.parseRPC(payload);
            console.log(`🔍 RPC Debug:`);
            console.log(`  Procedure: "${rpcInfo.procedure}"`);
            console.log(`  ExtractedSQL: "${rpcInfo.extractedSQL}"`);
            console.log(
              `  Parameters count: ${rpcInfo.parameters?.length || 0}`
            );
            console.log(`  Raw payload length: ${payload.length}`);
            console.log(
              `  Raw payload (first 100 bytes): ${payload
                .subarray(0, 100)
                .toString("hex")}`
            );

            // Use extracted SQL if available, otherwise fall back to procedure name
            // But if procedure is sp_executesql and no SQL extracted, try harder to extract
            if (
              !rpcInfo.extractedSQL &&
              (rpcInfo.procedure === "sp_executesql" ||
                rpcInfo.procedure === "executesql")
            ) {
              console.log(
                `  🔧 Trying to extract SQL from parameters for procedure: ${rpcInfo.procedure}`
              );
              // For sp_executesql, the first parameter usually contains the SQL
              const sqlParam = rpcInfo.parameters?.find(
                (p) => p.value && typeof p.value === "string"
              );
              console.log(`  Found SQL parameter:`, sqlParam);
              sql = sqlParam?.value || rpcInfo.procedure || "UNKNOWN SQL";
            } else {
              sql = rpcInfo.extractedSQL || rpcInfo.procedure;
            }
            console.log(`  Final SQL: "${sql}"`);
            console.log(`🔍 End RPC Debug\n`);
            parameters = rpcInfo.parameters;
          } else if (type === 0x10) {
            // TDS7 Login
            loginInfo = this.parseLogin(payload);
          } else if (type === 0x12) {
            // Pre-Login
            loginInfo = this.parsePreLogin(payload);
          }
        } catch (parseError) {}
      }

      const isQuery = [0x01, 0x03].includes(type);

      // If we extracted actual SQL from RPC, update the type to be more descriptive
      let displayType = typeName;
      if (type === 0x03 && sql && sql.trim().length > 0) {
        // We have actual SQL from RPC, make the type more descriptive
        const sqlType = this.extractQueryType(sql);
        displayType = `RPC (${sqlType})`;
      }

      return {
        type: displayType,
        packetType: type,
        status,
        length,
        spid,
        packetId,
        window,
        sql: sql || null,
        parameters,
        loginInfo,
        isQuery,
        protocol: "sqlserver",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isQuery: false,
        protocol: "sqlserver",
      };
    }
  }

  parseResponse(data) {
    try {
      if (data.length < 8) {
        return {
          type: "incomplete",
          raw: data.toString("hex"),
          isError: false,
        };
      }

      const type = data.readUInt8(0);
      const status = data.readUInt8(1);
      const length = data.readUInt16BE(2);
      const spid = data.readUInt16BE(4);
      const packetId = data.readUInt8(6);
      const window = data.readUInt8(7);

      const typeName = this.packetTypes[type] || "Unknown Response";
      let isError = false;
      let columns = [];
      let rows = [];
      let errorInfo = null;
      let loginAck = null;
      let done = null;

      if (data.length > 8 && type === 0x04) {
        // Tabular Result
        const payload = data.slice(8);
        const parseResult = this.parseTabularResult(payload);

        columns = parseResult.columns;
        rows = parseResult.rows;
        errorInfo = parseResult.errorInfo;
        loginAck = parseResult.loginAck;
        done = parseResult.done;
        isError = parseResult.isError;
      }

      return {
        type: typeName,
        packetType: type,
        status,
        length,
        spid,
        packetId,
        window,
        columns,
        rows,
        errorInfo,
        loginAck,
        done,
        isError,
        protocol: "sqlserver",
        raw: data.toString("hex").substring(0, 200),
      };
    } catch (error) {
      return {
        type: "parse_error",
        error: error.message,
        raw: data.toString("hex").substring(0, 200),
        isError: true,
        protocol: "sqlserver",
      };
    }
  }

  parseSQLBatch(payload) {
    try {
      // SQL Batch format: various headers followed by SQL text
      let offset = 0;

      // Skip ALL_HEADERS if present
      if (payload.length >= 4) {
        const totalHeaderLength = payload.readUInt32LE(offset);
        offset += totalHeaderLength;
      }

      // The rest should be the SQL statement in UTF-16LE
      if (offset < payload.length) {
        const sqlBytes = payload.slice(offset);
        // Convert from UTF-16LE to UTF-8
        let sql = "";
        for (let i = 0; i < sqlBytes.length - 1; i += 2) {
          const charCode = sqlBytes.readUInt16LE(i);
          if (charCode === 0) break;
          sql += String.fromCharCode(charCode);
        }
        return sql.trim();
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  parseRPC(payload) {
    try {
      let offset = 0;
      let procedure = "";
      let parameters = [];

      // Skip ALL_HEADERS if present
      if (payload.length >= 4) {
        const totalHeaderLength = payload.readUInt32LE(offset);
        offset += totalHeaderLength;
      }

      // Procedure name
      if (offset + 2 <= payload.length) {
        const nameLength = payload.readUInt16LE(offset);
        offset += 2;

        if (offset + nameLength * 2 <= payload.length) {
          for (let i = 0; i < nameLength; i++) {
            const charCode = payload.readUInt16LE(offset + i * 2);
            procedure += String.fromCharCode(charCode);
          }
          offset += nameLength * 2;
        }
      }

      // Skip option flags
      offset += 2;

      // Parse parameters (simplified)
      while (offset < payload.length) {
        try {
          const paramInfo = this.parseRPCParameter(payload, offset);
          if (paramInfo.bytesRead === 0) break;

          parameters.push(paramInfo.parameter);
          offset += paramInfo.bytesRead;
        } catch (paramError) {
          break;
        }
      }

      // Try to extract SQL from parameters if procedure is sp_executesql or similar
      let extractedSQL = "";
      if (
        procedure.toLowerCase().includes("sp_executesql") ||
        procedure.toLowerCase().includes("statement")
      ) {
        // Look for SQL in the first parameter
        for (const param of parameters) {
          if (
            param &&
            param.value &&
            typeof param.value === "string" &&
            param.value.length > 0
          ) {
            // Check if this looks like SQL
            const sqlValue = param.value.trim();
            if (
              sqlValue.match(
                /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|EXEC|CALL)/i
              )
            ) {
              extractedSQL = sqlValue;
              break;
            }
          }
        }
      }

      // If no explicit procedure, try to extract SQL from the raw payload
      if (!extractedSQL && payload.length > 20) {
        extractedSQL = this.extractSQLFromRPCPayload(payload);
      }

      return {
        procedure,
        parameters,
        extractedSQL: extractedSQL || "",
      };
    } catch (error) {
      return { procedure: "", parameters: [], extractedSQL: "" };
    }
  }

  // Helper method to extract SQL from RPC payload when procedure parsing fails
  extractSQLFromRPCPayload(payload) {
    try {
      console.log(
        `🔧 Extracting SQL from RPC payload, length: ${payload.length}`
      );

      // Simplified approach: look for SQL keywords in UTF-16LE anywhere in the payload
      const sqlPatterns = [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "DROP",
        "ALTER",
        "EXEC",
      ];

      // Convert each pattern to UTF-16LE hex for searching
      const hexPatterns = sqlPatterns.map((pattern) => {
        let hex = "";
        for (let i = 0; i < pattern.length; i++) {
          const charCode = pattern.charCodeAt(i);
          hex += charCode.toString(16).padStart(2, "0") + "00";
        }
        return { pattern, hex: hex.toLowerCase() };
      });

      const payloadHex = payload.toString("hex").toLowerCase();
      console.log(`Payload hex: ${payloadHex}`);

      // Find SQL pattern in the hex
      for (const { pattern, hex } of hexPatterns) {
        const index = payloadHex.indexOf(hex);
        if (index !== -1) {
          console.log(`Found ${pattern} pattern at hex index ${index}`);

          // Convert hex index to byte offset
          const byteOffset = index / 2;

          // Extract the SQL starting from this position
          let sql = "";
          for (let i = byteOffset; i < payload.length - 1; i += 2) {
            const charCode = payload.readUInt16LE(i);
            if (charCode === 0) break; // Null terminator
            if (
              charCode < 32 &&
              charCode !== 9 &&
              charCode !== 10 &&
              charCode !== 13
            )
              break; // Non-printable
            if (charCode > 127 && charCode < 160) break; // Control characters
            sql += String.fromCharCode(charCode);

            // Stop if we've read a reasonable amount
            if (sql.length > 500) break;
          }

          // Clean up the SQL
          sql = sql.trim();

          // Find a reasonable endpoint (semicolon, whitespace followed by non-SQL, etc.)
          const cleanSql = sql.split(/[^\w\s\*\(\),\.=<>!-]/)[0].trim();

          if (cleanSql.length > pattern.length) {
            console.log(`🎉 Extracted SQL: "${cleanSql}"`);
            return cleanSql;
          }
        }
      }

      console.log(`❌ No SQL patterns found`);
      return "";
    } catch (error) {
      console.log(`❌ Error extracting SQL: ${error.message}`);
      return "";
    }
  }

  parseRPCParameter(payload, offset) {
    try {
      if (offset >= payload.length) {
        return { parameter: null, bytesRead: 0 };
      }

      let currentOffset = offset;

      // Parameter name length
      if (currentOffset + 1 > payload.length) {
        return { parameter: null, bytesRead: 0 };
      }

      const nameLength = payload.readUInt8(currentOffset);
      currentOffset += 1;

      // Parameter name
      let name = "";
      if (nameLength > 0) {
        if (currentOffset + nameLength * 2 > payload.length) {
          return { parameter: null, bytesRead: 0 };
        }

        for (let i = 0; i < nameLength; i++) {
          const charCode = payload.readUInt16LE(currentOffset + i * 2);
          name += String.fromCharCode(charCode);
        }
        currentOffset += nameLength * 2;
      }

      // Parameter flags
      if (currentOffset + 1 > payload.length) {
        return { parameter: null, bytesRead: 0 };
      }

      const flags = payload.readUInt8(currentOffset);
      currentOffset += 1;

      // Data type
      if (currentOffset + 1 > payload.length) {
        return { parameter: null, bytesRead: 0 };
      }

      const dataType = payload.readUInt8(currentOffset);
      currentOffset += 1;

      // Parse value based on data type (simplified)
      let value = null;
      const parseResult = this.parseParameterValue(
        payload,
        currentOffset,
        dataType
      );
      value = parseResult.value;
      currentOffset += parseResult.bytesRead;

      return {
        parameter: { name, dataType, value },
        bytesRead: currentOffset - offset,
      };
    } catch (error) {
      return { parameter: null, bytesRead: 0 };
    }
  }

  parseParameterValue(payload, offset, dataType) {
    try {
      // Simplified parameter value parsing
      switch (dataType) {
        case 0x26: // INT
          if (offset + 4 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readInt32LE(offset), bytesRead: 4 };

        case 0x30: // TINYINT
          if (offset + 1 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readUInt8(offset), bytesRead: 1 };

        case 0x34: // SMALLINT
          if (offset + 2 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readInt16LE(offset), bytesRead: 2 };

        case 0x38: // BIGINT
          if (offset + 8 > payload.length) return { value: null, bytesRead: 0 };
          return {
            value: Number(payload.readBigInt64LE(offset)),
            bytesRead: 8,
          };

        case 0xe7: // NVARCHAR
          if (offset + 2 > payload.length) return { value: null, bytesRead: 0 };
          const strLength = payload.readUInt16LE(offset);
          if (strLength === 0xffff) return { value: null, bytesRead: 2 }; // NULL

          if (offset + 2 + strLength > payload.length)
            return { value: null, bytesRead: 0 };

          let str = "";
          for (let i = 0; i < strLength; i += 2) {
            if (offset + 2 + i + 1 < payload.length) {
              const charCode = payload.readUInt16LE(offset + 2 + i);
              str += String.fromCharCode(charCode);
            }
          }
          return { value: str, bytesRead: 2 + strLength };

        default:
          // For unknown types, try to skip a reasonable amount
          return { value: null, bytesRead: 1 };
      }
    } catch (error) {
      return { value: null, bytesRead: 0 };
    }
  }

  parseLogin(payload) {
    try {
      // TDS7 Login packet structure (simplified)
      let offset = 0;

      if (payload.length < 36) return null;

      const loginInfo = {
        length: payload.readUInt32LE(offset),
        tdsVersion: payload.readUInt32LE(offset + 4),
        packetSize: payload.readUInt32LE(offset + 8),
        clientVersion: payload.readUInt32LE(offset + 12),
        clientPID: payload.readUInt32LE(offset + 16),
        connectionID: payload.readUInt32LE(offset + 20),
      };

      // Parse variable-length data (simplified)
      // In a real implementation, you would parse all the offset/length pairs

      return loginInfo;
    } catch (error) {
      return null;
    }
  }

  parsePreLogin(payload) {
    try {
      const preLoginInfo = {};
      let offset = 0;

      // Pre-login packet contains option/value pairs
      while (offset < payload.length - 1) {
        if (offset + 5 > payload.length) break;

        const option = payload.readUInt8(offset);
        const valueOffset = payload.readUInt16BE(offset + 1);
        const valueLength = payload.readUInt16BE(offset + 3);
        offset += 5;

        if (option === 0xff) break; // Terminator

        if (valueOffset + valueLength <= payload.length) {
          const value = payload.slice(valueOffset, valueOffset + valueLength);
          preLoginInfo[`option_${option}`] = value.toString("hex");
        }
      }

      return preLoginInfo;
    } catch (error) {
      return null;
    }
  }

  parseTabularResult(payload) {
    let offset = 0;
    let columns = [];
    let rows = [];
    let errorInfo = null;
    let loginAck = null;
    let done = null;
    let isError = false;

    try {
      while (offset < payload.length) {
        if (offset + 1 > payload.length) break;

        const tokenType = payload.readUInt8(offset);
        offset += 1;

        switch (tokenType) {
          case 0x81: // TDS_COLMETADATA
            const colResult = this.parseColumnMetadata(payload, offset);
            columns = colResult.columns;
            offset += colResult.bytesRead;
            break;

          case 0xd1: // TDS_ROW
            const rowResult = this.parseRow(payload, offset, columns);
            if (rowResult.row) rows.push(rowResult.row);
            offset += rowResult.bytesRead;
            break;

          case 0xaa: // TDS_ERROR
            const errorResult = this.parseError(payload, offset);
            errorInfo = errorResult.error;
            isError = true;
            offset += errorResult.bytesRead;
            break;

          case 0xa4: // TDS_LOGINACK
            const loginResult = this.parseLoginAck(payload, offset);
            loginAck = loginResult.loginAck;
            offset += loginResult.bytesRead;
            break;

          case 0xfd: // TDS_DONE
          case 0xfe: // TDS_DONEPROC
          case 0xff: // TDS_DONEINPROC
            const doneResult = this.parseDone(payload, offset);
            done = doneResult.done;
            offset += doneResult.bytesRead;
            break;

          default:
            // Skip unknown token
            offset += 1;
            break;
        }
      }
    } catch (error) {}

    return { columns, rows, errorInfo, loginAck, done, isError };
  }

  parseColumnMetadata(payload, offset) {
    try {
      let currentOffset = offset;
      let columns = [];

      if (currentOffset + 2 > payload.length) {
        return { columns: [], bytesRead: 0 };
      }

      const columnCount = payload.readUInt16LE(currentOffset);
      currentOffset += 2;

      for (let i = 0; i < columnCount && currentOffset < payload.length; i++) {
        const colResult = this.parseColumnDefinition(payload, currentOffset);
        if (colResult.bytesRead === 0) break;

        columns.push(colResult.column);
        currentOffset += colResult.bytesRead;
      }

      return { columns, bytesRead: currentOffset - offset };
    } catch (error) {
      return { columns: [], bytesRead: 1 };
    }
  }

  parseColumnDefinition(payload, offset) {
    try {
      let currentOffset = offset;

      // This is a simplified version - real column definitions are complex
      if (currentOffset + 1 > payload.length) {
        return { column: null, bytesRead: 0 };
      }

      const dataType = payload.readUInt8(currentOffset);
      currentOffset += 1;

      // Handle different data type formats
      // For some data types, additional type info follows
      if (dataType === 0xe7 || dataType === 0xef) {
        // NVARCHAR/NCHAR
        // Skip max length (2 bytes) and collation (5 bytes)
        if (currentOffset + 7 <= payload.length) {
          currentOffset += 7;
        }
      } else if (dataType === 0x6a || dataType === 0x6c) {
        // DECIMAL/NUMERIC
        // Skip precision and scale
        if (currentOffset + 2 <= payload.length) {
          currentOffset += 2;
        }
      }

      // Column name length
      if (currentOffset + 1 > payload.length) {
        return { column: null, bytesRead: 0 };
      }

      const nameLength = payload.readUInt8(currentOffset);
      currentOffset += 1;

      // Column name
      let name = "";
      if (nameLength > 0) {
        if (currentOffset + nameLength * 2 > payload.length) {
          return { column: null, bytesRead: 0 };
        }

        for (let i = 0; i < nameLength; i++) {
          const charCode = payload.readUInt16LE(currentOffset + i * 2);
          name += String.fromCharCode(charCode);
        }
        currentOffset += nameLength * 2;
      }

      const column = {
        name: name || `col_${dataType}`,
        dataType,
        dataTypeName: this.dataTypes[dataType] || "UNKNOWN",
      };

      return { column, bytesRead: currentOffset - offset };
    } catch (error) {
      return { column: null, bytesRead: 1 };
    }
  }

  parseRow(payload, offset, columns) {
    try {
      let currentOffset = offset;
      let row = {};

      if (!columns || columns.length === 0) {
        return { row: null, bytesRead: 1 };
      }

      for (const column of columns) {
        if (currentOffset >= payload.length) break;

        const valueResult = this.parseColumnValue(
          payload,
          currentOffset,
          column.dataType
        );
        row[column.name] = valueResult.value;
        currentOffset += valueResult.bytesRead;
      }

      return { row, bytesRead: currentOffset - offset };
    } catch (error) {
      return { row: null, bytesRead: 1 };
    }
  }

  parseColumnValue(payload, offset, dataType) {
    try {
      // Simplified column value parsing
      switch (dataType) {
        case 0x26: // INT
          if (offset + 4 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readInt32LE(offset), bytesRead: 4 };

        case 0x30: // TINYINT
          if (offset + 1 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readUInt8(offset), bytesRead: 1 };

        case 0x38: // BIGINT
          if (offset + 8 > payload.length) return { value: null, bytesRead: 0 };
          return {
            value: Number(payload.readBigInt64LE(offset)),
            bytesRead: 8,
          };

        case 0x34: // SMALLINT
          if (offset + 2 > payload.length) return { value: null, bytesRead: 0 };
          return { value: payload.readInt16LE(offset), bytesRead: 2 };

        case 0xe7: // NVARCHAR
          if (offset + 2 > payload.length) return { value: null, bytesRead: 0 };
          const strLength = payload.readUInt16LE(offset);
          if (strLength === 0xffff) return { value: null, bytesRead: 2 };

          if (offset + 2 + strLength > payload.length)
            return { value: null, bytesRead: 0 };

          let str = "";
          for (let i = 0; i < strLength; i += 2) {
            if (offset + 2 + i + 1 < payload.length) {
              const charCode = payload.readUInt16LE(offset + 2 + i);
              str += String.fromCharCode(charCode);
            }
          }
          return { value: str, bytesRead: 2 + strLength };

        default:
          return { value: null, bytesRead: 1 };
      }
    } catch (error) {
      return { value: null, bytesRead: 1 };
    }
  }

  parseError(payload, offset) {
    try {
      let currentOffset = offset;

      if (currentOffset + 2 > payload.length) {
        return { error: null, bytesRead: 0 };
      }

      const length = payload.readUInt16LE(currentOffset);
      currentOffset += 2;

      if (currentOffset + length > payload.length) {
        return { error: null, bytesRead: 2 };
      }

      const errorData = payload.slice(currentOffset, currentOffset + length);
      let errorOffset = 0;

      const error = {};

      if (errorOffset + 4 <= errorData.length) {
        error.number = errorData.readUInt32LE(errorOffset);
        errorOffset += 4;
      }

      if (errorOffset + 1 <= errorData.length) {
        error.state = errorData.readUInt8(errorOffset);
        errorOffset += 1;
      }

      if (errorOffset + 1 <= errorData.length) {
        error.class = errorData.readUInt8(errorOffset);
        errorOffset += 1;
      }

      // Message text (simplified)
      if (errorOffset + 2 <= errorData.length) {
        const msgLength = errorData.readUInt16LE(errorOffset);
        errorOffset += 2;

        if (errorOffset + msgLength * 2 <= errorData.length) {
          let message = "";
          for (let i = 0; i < msgLength; i++) {
            const charCode = errorData.readUInt16LE(errorOffset + i * 2);
            message += String.fromCharCode(charCode);
          }
          error.message = message;
        }
      }

      return { error, bytesRead: 2 + length };
    } catch (error) {
      return { error: null, bytesRead: 1 };
    }
  }

  parseLoginAck(payload, offset) {
    try {
      // Simplified login acknowledgment parsing
      return { loginAck: { success: true }, bytesRead: 4 };
    } catch (error) {
      return { loginAck: null, bytesRead: 1 };
    }
  }

  parseDone(payload, offset) {
    try {
      if (offset + 8 > payload.length) {
        return { done: null, bytesRead: 0 };
      }

      const status = payload.readUInt16LE(offset);
      const curCmd = payload.readUInt16LE(offset + 2);
      const rowCount = payload.readUInt32LE(offset + 4);

      const done = {
        status,
        curCmd,
        rowCount,
        more: (status & 0x0001) !== 0,
        error: (status & 0x0002) !== 0,
        inTransaction: (status & 0x0004) !== 0,
        count: (status & 0x0010) !== 0,
      };

      return { done, bytesRead: 8 };
    } catch (error) {
      return { done: null, bytesRead: 1 };
    }
  }

  generateMockResponse(mock, originalQuery) {
    try {
      const response = mock.response;

      if (response.isError) {
        return this.generateErrorResponse(
          response.errorInfo || response.error,
          originalQuery
        );
      }

      if (response.rows && response.rows.length > 0) {
        return this.generateResultSetResponse(response, originalQuery);
      } else {
        return this.generateDoneResponse(response, originalQuery);
      }
    } catch (error) {
      // console.error("Error generating SQL Server mock response:", error);
      return this.generateErrorResponse(
        { message: "Mock generation failed" },
        originalQuery
      );
    }
  }

  generateResultSetResponse(response, originalQuery) {
    const buffers = [];
    const rows = response.rows;

    if (rows.length === 0) {
      return this.generateDoneResponse(response, originalQuery);
    }

    // Use actual column metadata if available, otherwise infer from first row
    let columns;
    if (response.columns && response.columns.length > 0) {
      columns = response.columns;
    } else {
      // Infer columns from first row
      columns = Object.keys(rows[0]).map((name) => ({
        name,
        dataType: 0xe7, // NVARCHAR
        dataTypeName: "NVARCHAR",
      }));
    }

    // Generate column metadata
    const colMetaBuffer = this.generateColumnMetadata(columns);
    buffers.push(colMetaBuffer);

    // Generate rows
    rows.forEach((row) => {
      const rowBuffer = this.generateRowData(row, columns);
      buffers.push(rowBuffer);
    });

    // Generate DONE token
    const doneBuffer = this.generateDoneToken(rows.length);
    buffers.push(doneBuffer);

    const payload = Buffer.concat(buffers);
    return this.wrapInTDSPacket(payload, 0x04); // Tabular Result
  }

  generateDoneResponse(response, originalQuery) {
    const rowCount = response.rowCount || response.affectedRows || 1;
    const doneBuffer = this.generateDoneToken(rowCount);
    return this.wrapInTDSPacket(doneBuffer, 0x04); // Tabular Result
  }

  generateErrorResponse(errorInfo, originalQuery) {
    const errorBuffer = this.generateErrorToken(errorInfo);
    const doneBuffer = this.generateDoneToken(0, true); // Error done
    const payload = Buffer.concat([errorBuffer, doneBuffer]);
    return this.wrapInTDSPacket(payload, 0x04); // Tabular Result
  }

  generateColumnMetadata(columns) {
    const buffers = [];

    // Token type
    buffers.push(Buffer.from([0x81])); // TDS_COLMETADATA

    // Column count
    const countBuffer = Buffer.allocUnsafe(2);
    countBuffer.writeUInt16LE(columns.length, 0);
    buffers.push(countBuffer);

    // Column definitions
    columns.forEach((column) => {
      const colBuffer = this.generateColumnDefinition(column);
      buffers.push(colBuffer);
    });

    return Buffer.concat(buffers);
  }

  generateColumnDefinition(column) {
    const buffers = [];

    // Data type
    buffers.push(Buffer.from([column.dataType]));

    // For NVARCHAR, add max length
    if (column.dataType === 0xe7) {
      const maxLenBuffer = Buffer.allocUnsafe(2);
      maxLenBuffer.writeUInt16LE(4000, 0); // Max length
      buffers.push(maxLenBuffer);
    }

    // Column name length
    const nameLength = Buffer.from([column.name.length]);
    buffers.push(nameLength);

    // Column name in UTF-16LE
    const nameBuffer = Buffer.alloc(column.name.length * 2);
    for (let i = 0; i < column.name.length; i++) {
      nameBuffer.writeUInt16LE(column.name.charCodeAt(i), i * 2);
    }
    buffers.push(nameBuffer);

    return Buffer.concat(buffers);
  }

  generateRowData(row, columns) {
    const buffers = [];

    // Token type
    buffers.push(Buffer.from([0xd1])); // TDS_ROW

    // Column values
    columns.forEach((column) => {
      const value = row[column.name];
      const valueBuffer = this.generateColumnValueData(value, column.dataType);
      buffers.push(valueBuffer);
    });

    return Buffer.concat(buffers);
  }

  generateColumnValueData(value, dataType) {
    if (value === null || value === undefined) {
      // NULL value for NVARCHAR
      if (dataType === 0xe7) {
        const nullBuffer = Buffer.allocUnsafe(2);
        nullBuffer.writeUInt16LE(0xffff, 0);
        return nullBuffer;
      }
      return Buffer.alloc(0);
    }

    switch (dataType) {
      case 0xe7: // NVARCHAR
        const strValue = String(value);
        const lengthBuffer = Buffer.allocUnsafe(2);
        lengthBuffer.writeUInt16LE(strValue.length * 2, 0);

        const valueBuffer = Buffer.alloc(strValue.length * 2);
        for (let i = 0; i < strValue.length; i++) {
          valueBuffer.writeUInt16LE(strValue.charCodeAt(i), i * 2);
        }

        return Buffer.concat([lengthBuffer, valueBuffer]);

      case 0x26: // INT
        const intBuffer = Buffer.allocUnsafe(4);
        intBuffer.writeInt32LE(parseInt(value), 0);
        return intBuffer;

      default:
        // Default to string representation
        const defaultStr = String(value);
        const defaultLenBuffer = Buffer.allocUnsafe(2);
        defaultLenBuffer.writeUInt16LE(defaultStr.length * 2, 0);

        const defaultValueBuffer = Buffer.alloc(defaultStr.length * 2);
        for (let i = 0; i < defaultStr.length; i++) {
          defaultValueBuffer.writeUInt16LE(defaultStr.charCodeAt(i), i * 2);
        }

        return Buffer.concat([defaultLenBuffer, defaultValueBuffer]);
    }
  }

  generateDoneToken(rowCount, isError = false) {
    const buffers = [];

    // Token type
    buffers.push(Buffer.from([0xfd])); // TDS_DONE

    // Status
    let status = 0x0000;
    if (isError) status |= 0x0002; // Error
    if (rowCount > 0) status |= 0x0010; // Count valid

    const statusBuffer = Buffer.allocUnsafe(2);
    statusBuffer.writeUInt16LE(status, 0);
    buffers.push(statusBuffer);

    // Current command
    const curCmdBuffer = Buffer.allocUnsafe(2);
    curCmdBuffer.writeUInt16LE(0, 0);
    buffers.push(curCmdBuffer);

    // Row count
    const rowCountBuffer = Buffer.allocUnsafe(4);
    rowCountBuffer.writeUInt32LE(rowCount, 0);
    buffers.push(rowCountBuffer);

    return Buffer.concat(buffers);
  }

  generateErrorToken(errorInfo) {
    const buffers = [];

    // Token type
    buffers.push(Buffer.from([0xaa])); // TDS_ERROR

    const message = errorInfo.message || "Mock error";

    // Error number
    const numberBuffer = Buffer.allocUnsafe(4);
    numberBuffer.writeUInt32LE(errorInfo.number || 50000, 0);

    // State
    const stateBuffer = Buffer.from([errorInfo.state || 1]);

    // Class (severity)
    const classBuffer = Buffer.from([errorInfo.class || 16]);

    // Message length
    const msgLenBuffer = Buffer.allocUnsafe(2);
    msgLenBuffer.writeUInt16LE(message.length, 0);

    // Message in UTF-16LE
    const msgBuffer = Buffer.alloc(message.length * 2);
    for (let i = 0; i < message.length; i++) {
      msgBuffer.writeUInt16LE(message.charCodeAt(i), i * 2);
    }

    // Build the error data
    const errorData = Buffer.concat([
      numberBuffer,
      stateBuffer,
      classBuffer,
      msgLenBuffer,
      msgBuffer,
    ]);

    // Length of error data
    const lengthBuffer = Buffer.allocUnsafe(2);
    lengthBuffer.writeUInt16LE(errorData.length, 0);

    buffers.push(lengthBuffer);
    buffers.push(errorData);

    return Buffer.concat(buffers);
  }

  wrapInTDSPacket(payload, packetType) {
    const header = Buffer.allocUnsafe(8);

    // Packet type
    header.writeUInt8(packetType, 0);

    // Status (End of Message)
    header.writeUInt8(0x01, 1);

    // Length (header + payload)
    header.writeUInt16BE(8 + payload.length, 2);

    // SPID
    header.writeUInt16BE(0, 4);

    // Packet ID
    header.writeUInt8(1, 6);

    // Window
    header.writeUInt8(0, 7);

    return Buffer.concat([header, payload]);
  }

  extractQueryType(query) {
    if (!query || typeof query !== "string") return "UNKNOWN";

    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith("SELECT")) return "SELECT";
    if (normalizedQuery.startsWith("INSERT")) return "INSERT";
    if (normalizedQuery.startsWith("UPDATE")) return "UPDATE";
    if (normalizedQuery.startsWith("DELETE")) return "DELETE";
    if (normalizedQuery.startsWith("CREATE")) return "CREATE";
    if (normalizedQuery.startsWith("DROP")) return "DROP";
    if (normalizedQuery.startsWith("ALTER")) return "ALTER";
    if (normalizedQuery.startsWith("EXEC")) return "EXEC";
    if (normalizedQuery.startsWith("CALL")) return "CALL";

    return "OTHER";
  }
}

module.exports = SQLServerParser;
