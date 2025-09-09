# Sniffler Backend Test Suite

## Overview

This comprehensive backend test suite validates all major functionality of the Sniffler application using real Docker containers and database connections. The tests focus on backend functionality without testing the frontend UI, providing thorough testing of core components, integration with databases, and mocking capabilities.

## 🎯 Test Coverage

### 1. Unit Tests (`tests/unit/`)

- ✅ **Proxy Core Functionality** - Basic proxy creation, configuration, and lifecycle
- ✅ **Database Sniffer** - Protocol parsing, connection management, event handling
- ✅ **Data Manager** - Settings, configuration, mock/request persistence
- ✅ **Mock Management** - Mock creation, updating, enabling/disabling
- ✅ **Request Patterns** - Pattern matching and auto-mock creation

### 2. Integration Tests (`tests/integration/`)

- ✅ **Proxy Integration** - Real HTTP traffic proxying with Docker test APIs
- ✅ **Database Integration** - Real database connections and operations
- ✅ **Mocking Integration** - Complete mock lifecycle with real traffic
- ✅ **Performance Testing** - Concurrent requests, load handling

### 3. Database Testing (`database.integration.test.js`)

- ✅ **PostgreSQL** 15 & 13 - Connection, CRUD operations, query parsing
- ✅ **MySQL** 8.0 & 5.7 - Connection, CRUD operations, query parsing
- ✅ **MongoDB** 7 & 5 - Connection, document operations, command parsing
- ✅ **Redis** 7 & 6 - Connection, key-value operations, command parsing
- ✅ **Multi-Database** - Simultaneous connections, protocol validation

### 4. Proxy Testing (`proxy.integration.test.js`)

- ✅ **HTTP Methods** - GET, POST, PUT, DELETE through proxy
- ✅ **Request Forwarding** - Traffic routing to test APIs
- ✅ **Error Handling** - Target server down, malformed requests
- ✅ **Concurrency** - Multiple simultaneous requests
- ✅ **Request History** - Tracking and limiting request logs

### 5. Mocking Testing (`mocking.integration.test.js`)

- ✅ **Mock Responses** - Custom responses, status codes, headers
- ✅ **Mock Priority** - Mocks override real API responses
- ✅ **Pattern Matching** - URL patterns, wildcard matching
- ✅ **Auto-Mocking** - Automatic mock creation from real responses
- ✅ **Mock Management** - Enable/disable, export/import

## 🐳 Docker Test Environment

The test suite uses a comprehensive Docker environment with:

### Databases

- **PostgreSQL**: 15.0 (port 5432), 13.0 (port 5433)
- **MySQL**: 8.0 (port 3306), 5.7 (port 3307)
- **MongoDB**: 7.0 (port 27017), 5.0 (port 27018)
- **Redis**: 7.0 (port 6379), 6.0 (port 6380)

### Test APIs

- **RESTful API** (port 3001) - Standard REST endpoints
- **GraphQL-like API** (port 3002) - GraphQL-style queries
- **JSON API** (port 3003) - JSON API specification
- **SOAP/XML API** (port 3004) - SOAP/XML responses

All databases come pre-populated with test data and support full CRUD operations.

## 🚀 Running Tests

### Prerequisites

- **Node.js** 16+
- **Docker Desktop** installed and running
- **Windows PowerShell** (for Windows users)

### Quick Start

```bash
# Run all tests
npm test

# Show available test options
npm run test:help

# List all test categories
npm run test:list
```

### Individual Test Categories

```bash
# Unit tests only
npm run test:unit

# Integration tests (all)
npm run test:integration

# Database integration tests
npm run test:database

# Proxy integration tests
npm run test:proxy

# Mocking integration tests
npm run test:mocking
```

### Advanced Usage

```bash
# Run with existing Docker environment
node tests/run-tests.js --no-docker

# Run specific test category
node tests/run-tests.js unit
node tests/run-tests.js database
node tests/run-tests.js proxy

# Enable verbose output
VERBOSE_TESTS=1 npm test

# Run Jest directly
npx jest
npx jest tests/unit --verbose
npx jest tests/integration/database.integration.test.js
```

## 📁 Test Structure

```
tests/
├── run-tests.js              # Main test runner with Docker orchestration
├── jest.config.js            # Jest configuration
├── unit/                     # Unit tests
│   ├── proxy.test.js
│   ├── database-sniffer.test.js
│   ├── data-manager.test.js
│   └── ...
├── integration/              # Integration tests
│   ├── proxy.integration.test.js
│   ├── database.integration.test.js
│   ├── mocking.integration.test.js
│   └── ...
├── utils/                    # Test utilities
│   ├── database-helper.js    # Database connection utilities
│   ├── http-helper.js        # HTTP request utilities
│   └── ...
├── setup/                    # Test environment setup
│   ├── global-setup.js       # Docker container startup
│   ├── global-teardown.js    # Docker container cleanup
│   └── jest-setup.js         # Jest configuration
└── docker/                   # Docker test environment
    ├── docker-compose.test.yml
    ├── init-scripts/         # Database initialization
    └── api-servers/          # Test API implementations
```

## 🛠 Test Utilities

### DatabaseTestHelper

- Multi-database connection management
- CRUD operation execution for all database types
- Connection testing and validation
- Test data cleanup

### HttpTestHelper

- HTTP request utilities for proxy testing
- Mock server creation for testing
- Response validation utilities
- Test data generation

### Test Utilities (Global)

- Port availability checking
- Test port generation
- Sleep utilities for timing
- Mock electron environment

## 📊 Test Results

Tests generate comprehensive output including:

- **Detailed Logs**: Test execution details with color-coded output
- **Coverage Reports**: Code coverage analysis (when enabled)
- **Error Details**: Full stack traces for failures
- **Performance Metrics**: Test execution times

## 🐛 Debugging Tests

### View Test Execution

```bash
# Run with verbose output
VERBOSE_TESTS=1 npm test

# Run specific test file
npx jest tests/unit/proxy.test.js --verbose

# Run with debugging
npx jest --detectOpenHandles --forceExit
```

### Common Issues

**Docker containers not starting:**

- Ensure Docker Desktop is running
- Check for port conflicts (5432, 3306, 27017, etc.)
- Run `docker-compose -f tests/docker/docker-compose.test.yml logs`

**Database connection failures:**

- Wait for containers to be fully ready (health checks)
- Verify database initialization scripts completed
- Check Docker container logs

**Port conflicts during tests:**

- Tests run sequentially (--runInBand) to avoid conflicts
- Each test uses random available ports
- Ensure no other services are using test ports

## 🔧 Configuration

### Jest Configuration

Modify `jest.config.js` for:

- Test timeouts and environment settings
- Coverage collection and reporting
- Test pattern matching
- Setup and teardown scripts

### Docker Environment

Modify `tests/docker/docker-compose.test.yml` for:

- Database versions and configurations
- Port mappings and environment variables
- Health check settings
- Volume mounts and initialization

## 📈 Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Backend Tests
  run: |
    npm ci
    npm test
  env:
    NODE_ENV: test
    CI: true
```

The test runner automatically handles Docker environment setup and cleanup.

## 🎭 Test Philosophy

These tests follow the **backend-focused testing principle**:

- ✅ **Real databases** instead of mocks for integration tests
- ✅ **Actual HTTP traffic** instead of stubs for proxy tests
- ✅ **Core functionality testing** instead of UI testing
- ✅ **Multiple database versions** for parser validation
- ✅ **Comprehensive error scenarios** for robustness
- ✅ **Performance and concurrency** testing under load

## 📞 Support

For test-related issues:

1. Check the console output for detailed error messages
2. Verify Docker environment is healthy with `docker-compose ps`
3. Run individual test categories to isolate issues
4. Check database logs for connection issues

## 🎉 Contributing

When adding new tests:

1. Follow the existing test file naming convention
2. Use the provided helper utilities
3. Add appropriate test categories and descriptions
4. Update this README with new test coverage
5. Ensure tests clean up after themselves

---

**Happy Testing! 🧪**
