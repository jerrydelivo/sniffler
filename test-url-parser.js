/**
 * Simple test for database URL parser
 */

const {
  parseDatabaseUrl,
  isValidDatabaseUrl,
  generateProxyConnectionString,
} = require("./apps/renderer/src/utils/databaseUrlParser.js");

// Test MongoDB URLs
const mongoUrl =
  "mongodb://admin:adminpass@localhost:27017/testdb?authSource=admin";
const mongoUrl2 =
  "mongodb://admin:adminpass@localhost:27018/testdb_v5?authSource=admin";

console.log("Testing MongoDB URL parsing:");
console.log("URL:", mongoUrl);
console.log("Parsed:", parseDatabaseUrl(mongoUrl));
console.log("Is valid:", isValidDatabaseUrl(mongoUrl));

console.log("\nTesting proxy connection string generation:");
const parsed = parseDatabaseUrl(mongoUrl);
if (parsed) {
  const proxyUrl = generateProxyConnectionString(
    mongoUrl,
    parsed.suggestedProxyPort
  );
  console.log("Original:", mongoUrl);
  console.log("Proxy URL:", proxyUrl);
}

// Test PostgreSQL
const pgUrl = "postgresql://testuser:testpass@localhost:5432/testdb";
console.log("\nTesting PostgreSQL URL:");
console.log("Parsed:", parseDatabaseUrl(pgUrl));

// Test MySQL
const mysqlUrl = "mysql://testuser:testpass@localhost:3306/testdb";
console.log("\nTesting MySQL URL:");
console.log("Parsed:", parseDatabaseUrl(mysqlUrl));
