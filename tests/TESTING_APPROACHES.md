# Sniffler Testing Approaches

## Approach 1: Use Existing Test Servers (Recommended)

You already have test servers in `test-servers/` directory. Simply modify their database connection configs to point to Sniffler proxy ports:

### Current Setup:

```
Test Server (3100) → Database (5432)
```

### With Sniffler:

```
Test Server (3100) → Sniffler Proxy (15432) → Database (5432)
```

### Configuration Change:

In your test servers, change connection from:

```javascript
// Before
host: 'localhost', port: 5432

// After (through Sniffler)
host: 'localhost', port: 15432  // Sniffler proxy port
```

## Approach 2: Create Simple Test Client

Use the provided `sniffler-test-client.js` that connects to all databases through Sniffler proxies.

```bash
cd sniffler/tests
node sniffler-test-client.js
```

## Approach 3: Direct Database Tools Through Sniffler

Use database tools directly through Sniffler proxies:

```bash
# PostgreSQL through Sniffler proxy
psql -h localhost -p 15432 -U testuser -d testdb

# MySQL through Sniffler proxy
mysql -h localhost -P 13306 -u testuser -ptestpass testdb

# Connect any application to proxy ports instead of direct ports
```

## Sniffler Proxy Configuration

Your Sniffler config should look like:

```json
{
  "proxies": [
    {
      "name": "PostgreSQL Test",
      "type": "postgresql",
      "listen": "localhost:15432",
      "target": "localhost:5432"
    },
    {
      "name": "MySQL Test",
      "type": "mysql",
      "listen": "localhost:13306",
      "target": "localhost:3306"
    },
    {
      "name": "MongoDB Test",
      "type": "mongodb",
      "listen": "localhost:37017",
      "target": "localhost:27017"
    },
    {
      "name": "Redis Test",
      "type": "redis",
      "listen": "localhost:16379",
      "target": "localhost:6379"
    }
  ]
}
```

## Testing Workflow

1. **Start Docker containers**: `.\start-all.ps1 -Wait`
2. **Start Sniffler** with proxy configuration
3. **Run test client** or modify existing servers to use proxy ports
4. **Monitor traffic** in Sniffler dashboard
5. **Analyze captured queries, connections, performance metrics**

The beauty is you don't need a complex server - any database client connecting through Sniffler proxies will generate traffic for analysis!
