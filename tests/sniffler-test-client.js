const { Client } = require("pg");
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");
const redis = require("redis");

// Test client that connects through Sniffler proxies
class SnifflerTestClient {
  constructor() {
    // Connect to Sniffler proxy ports instead of direct database ports
    this.pgClient = new Client({
      host: "localhost",
      port: 15432, // Sniffler PostgreSQL proxy port
      database: "testdb",
      user: "testuser",
      password: "testpass",
    });

    this.mysqlClient = mysql.createConnection({
      host: "localhost",
      port: 13306, // Sniffler MySQL proxy port
      database: "testdb",
      user: "testuser",
      password: "testpass",
    });

    this.mongoClient = new MongoClient(
      "mongodb://admin:adminpass@localhost:37017/testdb"
    );

    this.redisClient = redis.createClient({
      host: "localhost",
      port: 16379, // Sniffler Redis proxy port
      password: "testpass",
    });
  }

  async testPostgreSQL() {
    console.log("Testing PostgreSQL through Sniffler...");
    await this.pgClient.connect();
    const result = await this.pgClient.query("SELECT * FROM users LIMIT 5");
    console.log("PostgreSQL users:", result.rows.length);
    await this.pgClient.end();
  }

  async testMySQL() {
    console.log("Testing MySQL through Sniffler...");
    const [rows] = await this.mysqlClient.execute(
      "SELECT * FROM products LIMIT 5"
    );
    console.log("MySQL products:", rows.length);
    await this.mysqlClient.end();
  }

  async testMongoDB() {
    console.log("Testing MongoDB through Sniffler...");
    await this.mongoClient.connect();
    const db = this.mongoClient.db("testdb");
    const users = await db.collection("users").find({}).limit(5).toArray();
    console.log("MongoDB users:", users.length);
    await this.mongoClient.close();
  }

  async testRedis() {
    console.log("Testing Redis through Sniffler...");
    await this.redisClient.connect();
    await this.redisClient.set("test:key", "test:value");
    const value = await this.redisClient.get("test:key");
    console.log("Redis test value:", value);
    await this.redisClient.quit();
  }

  async runAllTests() {
    try {
      await this.testPostgreSQL();
      await this.testMySQL();
      await this.testMongoDB();
      await this.testRedis();
      console.log("All tests completed! Check Sniffler for captured traffic.");
    } catch (error) {
      console.error("Test error:", error);
    }
  }
}

// Usage
const testClient = new SnifflerTestClient();
testClient.runAllTests();
