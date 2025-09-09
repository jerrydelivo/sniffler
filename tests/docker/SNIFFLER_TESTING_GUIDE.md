# Sniffler Test Environment - Complete Testing Guide

This comprehensive test environment provides everything you need to test Sniffler against multiple database types, versions, and scenarios.

## 🚀 Quick Start

### Single Command Setup

```powershell
# Navigate to the Docker test directory
cd sniffler\tests\docker

# Start everything with one command
.\start-all.ps1 -Wait

# Or with advanced options
.\start-all.ps1 -Build -Clean -Wait -Logs
```

### Options

- `-Build`: Force rebuild of API containers
- `-Clean`: Remove old containers and volumes before starting
- `-Wait`: Wait for all services to be healthy
- `-Logs`: Show container logs after startup

## 🏗️ Infrastructure Overview

### Database Services (10 containers)

| Service             | Port  | Credentials                  | Purpose                   |
| ------------------- | ----- | ---------------------------- | ------------------------- |
| **PostgreSQL 15**   | 5432  | testdb/testuser/testpass     | Latest PostgreSQL testing |
| **PostgreSQL 13**   | 5433  | testdb_v13/testuser/testpass | Compatibility testing     |
| **MySQL 8.0**       | 3306  | testdb/testuser/testpass     | Latest MySQL testing      |
| **MySQL 5.7**       | 3307  | testdb_v57/testuser/testpass | Legacy MySQL testing      |
| **MongoDB 7.0**     | 27017 | admin/adminpass              | Latest MongoDB testing    |
| **MongoDB 5.0**     | 27018 | admin/adminpass              | Compatibility testing     |
| **SQL Server 2022** | 1433  | sa/TestPass123!              | Latest SQL Server testing |
| **SQL Server 2019** | 1434  | sa/TestPass123!              | Compatibility testing     |
| **Redis 7.0**       | 6379  | password: testpass           | Latest Redis testing      |
| **Redis 6.0**       | 6380  | password: testpass           | Legacy Redis testing      |

### Test API Services (4 containers)

| Service        | Port | Type     | Purpose                        |
| -------------- | ---- | -------- | ------------------------------ |
| **Test API 1** | 3001 | RESTful  | Standard REST API testing      |
| **Test API 2** | 3002 | GraphQL  | GraphQL API testing            |
| **Test API 3** | 3003 | JSON API | JSON API specification testing |
| **Test API 4** | 3004 | SOAP/XML | Legacy SOAP/XML testing        |

## 🧪 Test Data

Each database is pre-populated with realistic test data:

### SQL Databases (PostgreSQL, MySQL, SQL Server)

- **users**: 5 test users with realistic data
- **products**: 5 test products with categories
- **orders**: Sample order data linking users and products
- **categories**: Product categories

### MongoDB

- **users** collection: 5 test user documents
- **products** collection: 5 test product documents
- **orders** collection: Sample order documents

### Redis

- Ready for key-value testing with authentication

## 🔧 Sniffler Configuration

### Database Proxy Configuration

Configure Sniffler to intercept and analyze traffic to these test databases:

#### PostgreSQL Testing

```javascript
// Example Sniffler proxy configuration
{
  "proxies": [
    {
      "name": "PostgreSQL 15 Test",
      "type": "postgresql",
      "listen": "localhost:15432",
      "target": "localhost:5432",
      "database": "testdb",
      "enabled": true
    },
    {
      "name": "PostgreSQL 13 Test",
      "type": "postgresql",
      "listen": "localhost:15433",
      "target": "localhost:5433",
      "database": "testdb_v13",
      "enabled": true
    }
  ]
}
```

#### MySQL Testing

```javascript
{
  "proxies": [
    {
      "name": "MySQL 8.0 Test",
      "type": "mysql",
      "listen": "localhost:13306",
      "target": "localhost:3306",
      "database": "testdb",
      "enabled": true
    },
    {
      "name": "MySQL 5.7 Test",
      "type": "mysql",
      "listen": "localhost:13307",
      "target": "localhost:3307",
      "database": "testdb_v57",
      "enabled": true
    }
  ]
}
```

#### MongoDB Testing

```javascript
{
  "proxies": [
    {
      "name": "MongoDB 7.0 Test",
      "type": "mongodb",
      "listen": "localhost:37017",
      "target": "localhost:27017",
      "database": "testdb",
      "enabled": true
    },
    {
      "name": "MongoDB 5.0 Test",
      "type": "mongodb",
      "listen": "localhost:37018",
      "target": "localhost:27018",
      "database": "testdb_v5",
      "enabled": true
    }
  ]
}
```

#### SQL Server Testing

```javascript
{
  "proxies": [
    {
      "name": "SQL Server 2022 Test",
      "type": "sqlserver",
      "listen": "localhost:11433",
      "target": "localhost:1433",
      "database": "master",
      "enabled": true
    },
    {
      "name": "SQL Server 2019 Test",
      "type": "sqlserver",
      "listen": "localhost:11434",
      "target": "localhost:1434",
      "database": "master",
      "enabled": true
    }
  ]
}
```

#### Redis Testing

```javascript
{
  "proxies": [
    {
      "name": "Redis 7.0 Test",
      "type": "redis",
      "listen": "localhost:16379",
      "target": "localhost:6379",
      "enabled": true
    },
    {
      "name": "Redis 6.0 Test",
      "type": "redis",
      "listen": "localhost:16380",
      "target": "localhost:6380",
      "enabled": true
    }
  ]
}
```

### HTTP Proxy Configuration

For API testing, configure Sniffler to intercept HTTP traffic:

```javascript
{
  "httpProxies": [
    {
      "name": "Test API Suite",
      "listen": "localhost:8001",
      "targets": [
        "localhost:3001",
        "localhost:3002",
        "localhost:3003",
        "localhost:3004"
      ],
      "enabled": true
    }
  ]
}
```

## 🧪 Testing Scenarios

### 1. Basic Database Operations

Test basic CRUD operations through Sniffler proxies:

```sql
-- PostgreSQL/MySQL/SQL Server
SELECT * FROM users;
INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');
UPDATE users SET name = 'Updated User' WHERE id = 1;
DELETE FROM users WHERE id = 1;
```

```javascript
// MongoDB
db.users.find({});
db.users.insertOne({ name: "Test User", email: "test@example.com" });
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { name: "Updated User" } }
);
db.users.deleteOne({ _id: ObjectId("...") });
```

```redis
# Redis
SET test:key "test value"
GET test:key
DEL test:key
```

### 2. Cross-Database Version Testing

Compare how Sniffler handles different database versions:

1. Connect to PostgreSQL 15 through Sniffler proxy (port 15432)
2. Run the same queries on PostgreSQL 13 through Sniffler proxy (port 15433)
3. Compare captured query patterns and performance metrics

### 3. API Traffic Analysis

Test HTTP traffic interception:

```bash
# Test API endpoints through Sniffler proxy
curl http://localhost:8001/api/users      # Routes to API 1
curl http://localhost:8001/graphql        # Routes to API 2
curl http://localhost:8001/json-api/users # Routes to API 3
curl http://localhost:8001/soap           # Routes to API 4
```

### 4. Load Testing

Use the test servers to generate realistic database load:

```powershell
# Start the companion test servers
cd ..\..\..\test-servers
.\start-test-servers.ps1

# Test servers will be available at:
# PostgreSQL Test Server: http://localhost:3100
# MySQL Test Server: http://localhost:3101
# MongoDB Test Server: http://localhost:3102
# SQL Server Test Server: http://localhost:3103
# Redis Test Server: http://localhost:3104
# Orchestrator: http://localhost:3105
```

### 5. Connection Pool Testing

Test how Sniffler handles connection pooling:

1. Configure multiple applications to connect through the same Sniffler proxy
2. Monitor connection reuse and pooling behavior
3. Test connection limits and failover scenarios

### 6. Transaction Testing

Test transaction handling across database types:

```sql
-- SQL databases
BEGIN;
UPDATE users SET email = 'new@example.com' WHERE id = 1;
UPDATE products SET price = 99.99 WHERE id = 1;
COMMIT;
-- Or ROLLBACK;
```

### 7. Performance Monitoring

Use Sniffler to monitor and analyze:

- Query execution times
- Connection patterns
- Resource usage
- Error rates
- Slow query identification

## 🔍 Monitoring and Debugging

### Container Health Checks

```powershell
# Check all container status
docker-compose -f docker-compose.test.yml ps

# Check specific container logs
docker logs sniffler-test-postgres-15
docker logs sniffler-test-mysql-8
docker logs sniffler-test-mongo-7

# Follow logs in real-time
docker-compose -f docker-compose.test.yml logs -f
```

### Database Connectivity Tests

```powershell
# Test PostgreSQL
docker exec sniffler-test-postgres-15 psql -U testuser -d testdb -c "SELECT COUNT(*) FROM users;"

# Test MySQL
docker exec sniffler-test-mysql-8 mysql -u testuser -ptestpass testdb -e "SELECT COUNT(*) FROM products;"

# Test MongoDB
docker exec sniffler-test-mongo-7 mongosh --eval "db.users.countDocuments()" testdb

# Test Redis
docker exec sniffler-test-redis-7 redis-cli -a testpass ping
```

### API Health Checks

```powershell
# Test all APIs
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

## 🛑 Cleanup and Management

### Stop All Services

```powershell
# Stop all containers
docker-compose -f docker-compose.test.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.test.yml down -v

# Full cleanup including images
docker-compose -f docker-compose.test.yml down -v --rmi all
```

### Restart Individual Services

```powershell
# Restart specific database
docker-compose -f docker-compose.test.yml restart postgres-15

# Restart all databases of a type
docker-compose -f docker-compose.test.yml restart postgres-15 postgres-13
```

### Update Test Data

```powershell
# Rebuild with fresh data
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

## 🎯 Sniffler Test Checklist

### Database Protocol Testing

- [ ] PostgreSQL query interception and parsing
- [ ] MySQL query interception and parsing
- [ ] MongoDB command interception and parsing
- [ ] SQL Server query interception and parsing
- [ ] Redis command interception and parsing

### Version Compatibility Testing

- [ ] PostgreSQL 15 vs 13 compatibility
- [ ] MySQL 8.0 vs 5.7 compatibility
- [ ] MongoDB 7.0 vs 5.0 compatibility
- [ ] SQL Server 2022 vs 2019 compatibility
- [ ] Redis 7.0 vs 6.0 compatibility

### Performance Testing

- [ ] Query execution time tracking
- [ ] Connection pool monitoring
- [ ] Resource usage analysis
- [ ] Concurrent connection handling
- [ ] Load balancing behavior

### Security Testing

- [ ] Authentication passthrough
- [ ] SSL/TLS handling
- [ ] Credential masking in logs
- [ ] Access control enforcement

### Error Handling Testing

- [ ] Connection failure recovery
- [ ] Query timeout handling
- [ ] Invalid query handling
- [ ] Database unavailability scenarios

### Integration Testing

- [ ] ORM compatibility (Prisma, TypeORM, etc.)
- [ ] Framework integration (Express, FastAPI, etc.)
- [ ] Container orchestration (Docker Compose, Kubernetes)
- [ ] CI/CD pipeline integration

## 🎉 Happy Testing!

This environment provides everything you need to thoroughly test Sniffler across multiple database types, versions, and scenarios. The infrastructure is designed to be reliable, reproducible, and comprehensive.

For additional support or questions, refer to the Sniffler documentation or create an issue in the project repository.
