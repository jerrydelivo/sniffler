// Database testing utilities
const mysql = require("mysql2/promise");
const { Client: PostgresClient } = require("pg");
const { MongoClient } = require("mongodb");
const redis = require("redis");
const sql = require("mssql");

class DatabaseTestHelper {
  constructor() {
    this.connections = new Map();
  }

  // PostgreSQL connections
  async getPostgresConnection(port = 5432) {
    const key = `postgres_${port}`;
    if (!this.connections.has(key)) {
      const database = port === 5433 ? "testdb_v13" : "testdb";
      const client = new PostgresClient({
        host: "localhost",
        port: port,
        user: "testuser",
        password: "testpass",
        database: database,
      });
      await client.connect();
      this.connections.set(key, client);
    }
    return this.connections.get(key);
  }

  // MySQL connections
  async getMysqlConnection(port = 3306) {
    const key = `mysql_${port}`;
    if (!this.connections.has(key)) {
      const database = port === 3307 ? "testdb_v57" : "testdb";
      const connection = await mysql.createConnection({
        host: "localhost",
        port: port,
        user: "testuser",
        password: "testpass",
        database: database,
      });
      this.connections.set(key, connection);
    }
    return this.connections.get(key);
  }

  // MongoDB connections
  async getMongoConnection(port = 27017) {
    const key = `mongo_${port}`;
    if (!this.connections.has(key)) {
      const dbName = port === 27018 ? "testdb_v5" : "testdb";
      const client = new MongoClient(
        `mongodb://admin:adminpass@localhost:${port}/${dbName}`
      );
      await client.connect();
      this.connections.set(key, client);
    }
    return this.connections.get(key);
  }

  // Redis connections
  async getRedisConnection(port = 6379) {
    const key = `redis_${port}`;
    if (!this.connections.has(key)) {
      const client = redis.createClient({
        socket: {
          host: "localhost",
          port: port,
        },
        password: "testpass",
      });
      await client.connect();
      this.connections.set(key, client);
    }
    return this.connections.get(key);
  }

  // SQL Server connections
  async getSqlServerConnection(port = 1433) {
    const key = `sqlserver_${port}`;
    if (!this.connections.has(key)) {
      const pool = await sql.connect({
        server: "localhost",
        port: port,
        user: "sa",
        password: "TestPass123!",
        database: "testdb",
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      });
      this.connections.set(key, pool);
    }
    return this.connections.get(key);
  }

  // Execute test queries
  async executePostgresQuery(query, params = [], port = 5432) {
    const client = await this.getPostgresConnection(port);
    return await client.query(query, params);
  }

  async executeMysqlQuery(query, params = [], port = 3306) {
    const connection = await this.getMysqlConnection(port);
    return await connection.execute(query, params);
  }

  async executeMongoOperation(
    operation,
    collection = "test_collection",
    port = 27017
  ) {
    const client = await this.getMongoConnection(port);
    const dbName = port === 27018 ? "testdb_v5" : "testdb";
    const db = client.db(dbName);
    const coll = db.collection(collection);

    switch (operation.type) {
      case "find":
        return await coll.find(operation.query || {}).toArray();
      case "insertOne":
        return await coll.insertOne(operation.document);
      case "updateOne":
        return await coll.updateOne(operation.filter, operation.update);
      case "deleteOne":
        return await coll.deleteOne(operation.filter);
      case "deleteMany":
        return await coll.deleteMany(operation.filter);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  async executeRedisCommand(command, args = [], port = 6379) {
    const client = await this.getRedisConnection(port);
    return await client.sendCommand([command, ...args]);
  }

  async executeSqlServerQuery(query, port = 1433) {
    const pool = await this.getSqlServerConnection(port);
    const result = await pool.request().query(query);
    return result;
  }

  // Test database connectivity
  async testDatabaseConnectivity() {
    const results = {};

    // Test PostgreSQL
    try {
      await this.executePostgresQuery("SELECT 1 as test", [], 5432);
      results.postgres_15 = { success: true, port: 5432 };
    } catch (error) {
      results.postgres_15 = {
        success: false,
        error: error.message,
        port: 5432,
      };
    }

    try {
      await this.executePostgresQuery("SELECT 1 as test", [], 5433);
      results.postgres_13 = { success: true, port: 5433 };
    } catch (error) {
      results.postgres_13 = {
        success: false,
        error: error.message,
        port: 5433,
      };
    }

    // Test MySQL
    try {
      await this.executeMysqlQuery("SELECT 1 as test", [], 3306);
      results.mysql_8 = { success: true, port: 3306 };
    } catch (error) {
      results.mysql_8 = { success: false, error: error.message, port: 3306 };
    }

    try {
      await this.executeMysqlQuery("SELECT 1 as test", [], 3307);
      results.mysql_57 = { success: true, port: 3307 };
    } catch (error) {
      results.mysql_57 = { success: false, error: error.message, port: 3307 };
    }

    // Test MongoDB
    try {
      await this.executeMongoOperation(
        { type: "find", query: {} },
        "test_collection",
        27017
      );
      results.mongo_7 = { success: true, port: 27017 };
    } catch (error) {
      results.mongo_7 = { success: false, error: error.message, port: 27017 };
    }

    try {
      await this.executeMongoOperation(
        { type: "find", query: {} },
        "test_collection",
        27018
      );
      results.mongo_5 = { success: true, port: 27018 };
    } catch (error) {
      results.mongo_5 = { success: false, error: error.message, port: 27018 };
    }

    // Test Redis
    try {
      await this.executeRedisCommand("PING", [], 6379);
      results.redis_7 = { success: true, port: 6379 };
    } catch (error) {
      results.redis_7 = { success: false, error: error.message, port: 6379 };
    }

    try {
      await this.executeRedisCommand("PING", [], 6380);
      results.redis_6 = { success: true, port: 6380 };
    } catch (error) {
      results.redis_6 = { success: false, error: error.message, port: 6380 };
    }

    return results;
  }

  // Clean up test data
  async cleanupTestData() {
    try {
      // Clean PostgreSQL
      await this.executePostgresQuery(
        "DELETE FROM users WHERE email LIKE 'test_%'",
        [],
        5432
      );
      await this.executePostgresQuery(
        "DELETE FROM users WHERE email LIKE 'test_%'",
        [],
        5433
      );

      // Clean MySQL
      await this.executeMysqlQuery(
        "DELETE FROM users WHERE email LIKE 'test_%'",
        [],
        3306
      );
      await this.executeMysqlQuery(
        "DELETE FROM users WHERE email LIKE 'test_%'",
        [],
        3307
      );

      // Clean MongoDB
      await this.executeMongoOperation(
        {
          type: "deleteMany",
          filter: { email: { $regex: "^test_" } },
        },
        "users",
        27017
      );
      await this.executeMongoOperation(
        {
          type: "deleteMany",
          filter: { email: { $regex: "^test_" } },
        },
        "users",
        27018
      );

      // Clean Redis
      const redisClient7 = await this.getRedisConnection(6379);
      const redisClient6 = await this.getRedisConnection(6380);

      const keys7 = await redisClient7.keys("test_*");
      const keys6 = await redisClient6.keys("test_*");

      if (keys7.length > 0) {
        await redisClient7.del(keys7);
      }
      if (keys6.length > 0) {
        await redisClient6.del(keys6);
      }
    } catch (error) {
      console.warn("Warning: Failed to cleanup test data:", error.message);
    }
  }

  // Close all connections
  async closeAllConnections() {
    for (const [key, connection] of this.connections) {
      try {
        if (key.startsWith("postgres_")) {
          await connection.end();
        } else if (key.startsWith("mysql_")) {
          await connection.end();
        } else if (key.startsWith("mongo_")) {
          await connection.close();
        } else if (key.startsWith("redis_")) {
          await connection.quit();
        } else if (key.startsWith("sqlserver_")) {
          await connection.close();
        }
      } catch (error) {
        console.warn(`Failed to close connection ${key}:`, error.message);
      }
    }
    this.connections.clear();
  }
}

module.exports = DatabaseTestHelper;
