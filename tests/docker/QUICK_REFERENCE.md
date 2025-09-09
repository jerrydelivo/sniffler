# Sniffler Test Environment - Quick Reference

## 🚀 One-Command Startup

```powershell
cd sniffler\tests\docker
.\start-all.ps1 -Wait
```

## 📊 What You Get

### 14 Containers Running

- **10 Database Containers**: PostgreSQL (2), MySQL (2), MongoDB (2), SQL Server (2), Redis (2)
- **4 API Containers**: REST, GraphQL, JSON API, SOAP/XML

### All Services Include

- ✅ Pre-populated test data
- ✅ Health checks configured
- ✅ Persistent volumes
- ✅ Proper networking

## 🔗 Connection Details

| Service         | Port  | Credentials                  |
| --------------- | ----- | ---------------------------- |
| PostgreSQL 15   | 5432  | testdb/testuser/testpass     |
| PostgreSQL 13   | 5433  | testdb_v13/testuser/testpass |
| MySQL 8.0       | 3306  | testdb/testuser/testpass     |
| MySQL 5.7       | 3307  | testdb_v57/testuser/testpass |
| MongoDB 7.0     | 27017 | admin/adminpass              |
| MongoDB 5.0     | 27018 | admin/adminpass              |
| SQL Server 2022 | 1433  | sa/TestPass123!              |
| SQL Server 2019 | 1434  | sa/TestPass123!              |
| Redis 7.0       | 6379  | password: testpass           |
| Redis 6.0       | 6380  | password: testpass           |
| Test API 1      | 3001  | RESTful API                  |
| Test API 2      | 3002  | GraphQL API                  |
| Test API 3      | 3003  | JSON API                     |
| Test API 4      | 3004  | SOAP/XML API                 |

## 🎯 For Sniffler Testing

### 1. Configure Sniffler Proxies

Set up Sniffler to proxy between your applications and these databases:

```
Application → Sniffler Proxy → Test Database
     ↓              ↓              ↓
   Port X      Port Y (Sniffler)  Port Z (Container)
```

### 2. Example Proxy Configuration

```javascript
// PostgreSQL
{
  "listen": "localhost:15432",  // Your app connects here
  "target": "localhost:5432",   // Sniffler forwards to this
  "type": "postgresql"
}
```

### 3. Test Your Application

Point your application to Sniffler proxy ports instead of direct database ports.

## 🛠️ Management Commands

```powershell
# Health check all services
.\health-check.ps1

# Stop all services
.\stop-all.ps1

# Full cleanup and restart
.\stop-all.ps1 -Clean
.\start-all.ps1 -Build -Wait

# View logs
docker-compose -f docker-compose.test.yml logs
```

## 📚 Full Documentation

- **[SNIFFLER_TESTING_GUIDE.md](./SNIFFLER_TESTING_GUIDE.md)** - Complete testing guide
- **[README.md](./README.md)** - Infrastructure overview
