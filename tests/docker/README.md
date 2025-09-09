# Sniffler Docker Test Environment

Complete testing infrastructure for Sniffler with multiple database types and versions.

## 🚀 Quick Start

```powershell
# Start everything with one command
.\start-all.ps1

# Start with wait for all services to be healthy
.\start-all.ps1 -Wait

# Full startup with cleanup and rebuild
.\start-all.ps1 -Clean -Build -Wait
```

## 📚 Documentation

- **[SNIFFLER_TESTING_GUIDE.md](./SNIFFLER_TESTING_GUIDE.md)** - Complete testing guide
- **[docker-compose.test.yml](./docker-compose.test.yml)** - Infrastructure definition

## 🛠️ Available Scripts

| Script          | Purpose                       |
| --------------- | ----------------------------- |
| `start-all.ps1` | Start entire test environment |
| `stop-all.ps1`  | Stop test environment         |

## 🏗️ Infrastructure

### Databases (10 containers)

- PostgreSQL 15 & 13
- MySQL 8.0 & 5.7
- MongoDB 7.0 & 5.0
- SQL Server 2022 & 2019
- Redis 7.0 & 6.0

### Test APIs (4 containers)

- RESTful API (port 3001)
- GraphQL API (port 3002)
- JSON API (port 3003)
- SOAP/XML API (port 3004)

## 📊 Service Status

```powershell
# Check all services
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs

# Stop all services
.\stop-all.ps1
```

See the [complete testing guide](./SNIFFLER_TESTING_GUIDE.md) for detailed instructions.
