// Docker database management for UI tests
const { execSync } = require("child_process");
const path = require("path");

class DatabaseManager {
  constructor() {
    this.dockerComposePath = path.join(
      __dirname,
      "../../docker/docker-compose.test.yml"
    );
    this.runningContainers = new Set();
  }

  async startDatabaseContainers() {
    console.log("🐳 Starting database containers for UI tests...");

    try {
      // Start only database containers (not API servers)
      const databases = [
        "postgres-15",
        "postgres-13",
        "mysql-8",
        "mysql-57",
        "mongodb-7",
        "mongodb-5",
        "redis-7",
        "redis-6",
      ];

      for (const db of databases) {
        try {
          console.log(`Starting ${db}...`);
          execSync(
            `docker-compose -f "${this.dockerComposePath}" up -d ${db}`,
            {
              stdio: "pipe",
            }
          );
          this.runningContainers.add(db);
          console.log(`✅ ${db} started`);
        } catch (error) {
          console.warn(`⚠️  Failed to start ${db}: ${error.message}`);
        }
      }

      // Wait for databases to be healthy
      await this.waitForDatabaseHealth();
    } catch (error) {
      console.error("❌ Failed to start database containers:", error.message);
      throw error;
    }
  }

  async waitForDatabaseHealth() {
    console.log("⏳ Waiting for databases to be healthy...");

    const maxWaitTime = 120; // 2 minutes
    const checkInterval = 5; // Check every 5 seconds
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      try {
        const healthyContainers = this.checkContainerHealth();
        console.log(
          `💓 ${healthyContainers.length}/${this.runningContainers.size} containers healthy`
        );

        if (healthyContainers.length === this.runningContainers.size) {
          console.log("✅ All database containers are healthy");
          return;
        }
      } catch (error) {
        console.log(
          `🔍 Checking health... ${maxWaitTime - waitTime}s remaining`
        );
      }

      await this.sleep(checkInterval * 1000);
      waitTime += checkInterval;
    }

    throw new Error(
      `Databases did not become healthy within ${maxWaitTime} seconds`
    );
  }

  checkContainerHealth() {
    try {
      const result = execSync(
        `docker-compose -f "${this.dockerComposePath}" ps --format "json"`,
        { encoding: "utf8", stdio: "pipe" }
      );

      const containers = result
        .trim()
        .split("\n")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((container) => container !== null)
        .filter((container) => this.runningContainers.has(container.Service));

      return containers.filter(
        (container) =>
          container.State.includes("healthy") ||
          (container.State.includes("running") &&
            !container.State.includes("starting"))
      );
    } catch (error) {
      return [];
    }
  }

  async stopDatabaseContainers() {
    console.log("🛑 Stopping database containers...");

    try {
      for (const container of this.runningContainers) {
        try {
          execSync(
            `docker-compose -f "${this.dockerComposePath}" stop ${container}`,
            {
              stdio: "pipe",
            }
          );
          console.log(`✅ Stopped ${container}`);
        } catch (error) {
          console.warn(`⚠️  Failed to stop ${container}: ${error.message}`);
        }
      }

      this.runningContainers.clear();
    } catch (error) {
      console.error("❌ Failed to stop database containers:", error.message);
    }
  }

  async createTestDatabase(protocol, dbName = "ui_test_db") {
    console.log(`📊 Creating test database: ${dbName} (${protocol})`);

    try {
      switch (protocol) {
        case "postgresql":
          await this.createPostgresDatabase(dbName);
          break;
        case "mysql":
          await this.createMysqlDatabase(dbName);
          break;
        case "mongodb":
          await this.createMongoDatabase(dbName);
          break;
        case "redis":
          // Redis doesn't need database creation
          break;
        default:
          throw new Error(`Unsupported database protocol: ${protocol}`);
      }

      console.log(`✅ Test database ${dbName} created`);
    } catch (error) {
      console.error(`❌ Failed to create test database: ${error.message}`);
      throw error;
    }
  }

  async createPostgresDatabase(dbName) {
    const createDbQuery = `CREATE DATABASE ${dbName};`;
    execSync(
      `docker exec sniffler-postgres-15 psql -U testuser -d postgres -c "${createDbQuery}"`,
      {
        stdio: "pipe",
      }
    );

    // Create test table
    const createTableQuery = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (name, email) VALUES 
        ('Alice Johnson', 'alice@test.com'),
        ('Bob Smith', 'bob@test.com');
    `;

    execSync(
      `docker exec sniffler-postgres-15 psql -U testuser -d ${dbName} -c "${createTableQuery}"`,
      {
        stdio: "pipe",
      }
    );
  }

  async createMysqlDatabase(dbName) {
    const createDbQuery = `CREATE DATABASE ${dbName};`;
    execSync(
      `docker exec sniffler-mysql-8 mysql -u testuser -ptestpass -e "${createDbQuery}"`,
      {
        stdio: "pipe",
      }
    );

    // Create test table
    const createTableQuery = `
      USE ${dbName};
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (name, email) VALUES 
        ('Alice Johnson', 'alice@test.com'),
        ('Bob Smith', 'bob@test.com');
    `;

    execSync(
      `docker exec sniffler-mysql-8 mysql -u testuser -ptestpass -e "${createTableQuery}"`,
      {
        stdio: "pipe",
      }
    );
  }

  async createMongoDatabase(dbName) {
    const mongoScript = `
      use ${dbName};
      db.users.insertMany([
        { name: 'Alice Johnson', email: 'alice@test.com', createdAt: new Date() },
        { name: 'Bob Smith', email: 'bob@test.com', createdAt: new Date() }
      ]);
    `;

    execSync(`docker exec sniffler-mongodb-7 mongosh --eval "${mongoScript}"`, {
      stdio: "pipe",
    });
  }

  async cleanupTestDatabase(protocol, dbName = "ui_test_db") {
    try {
      switch (protocol) {
        case "postgresql":
          execSync(
            `docker exec sniffler-postgres-15 psql -U testuser -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`,
            {
              stdio: "pipe",
            }
          );
          break;
        case "mysql":
          execSync(
            `docker exec sniffler-mysql-8 mysql -u testuser -ptestpass -e "DROP DATABASE IF EXISTS ${dbName};"`,
            {
              stdio: "pipe",
            }
          );
          break;
        case "mongodb":
          execSync(
            `docker exec sniffler-mongodb-7 mongosh --eval "use ${dbName}; db.dropDatabase();"`,
            {
              stdio: "pipe",
            }
          );
          break;
        case "redis":
          execSync(`docker exec sniffler-redis-7 redis-cli FLUSHDB`, {
            stdio: "pipe",
          });
          break;
      }
      console.log(`🗑️  Cleaned up test database: ${dbName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup test database: ${error.message}`);
    }
  }

  async getConnectionInfo(protocol) {
    const connections = {
      postgresql: {
        host: "localhost",
        port: 5432,
        user: "testuser",
        password: "testpass",
        database: "ui_test_db",
      },
      mysql: {
        host: "localhost",
        port: 3306,
        user: "testuser",
        password: "testpass",
        database: "ui_test_db",
      },
      mongodb: {
        host: "localhost",
        port: 27017,
        database: "ui_test_db",
      },
      redis: {
        host: "localhost",
        port: 6379,
      },
    };

    return connections[protocol];
  }

  async testDatabaseConnection(protocol) {
    try {
      const info = await this.getConnectionInfo(protocol);

      switch (protocol) {
        case "postgresql":
          execSync(
            `docker exec sniffler-postgres-15 pg_isready -h localhost -p 5432`,
            {
              stdio: "pipe",
            }
          );
          return true;
        case "mysql":
          execSync(
            `docker exec sniffler-mysql-8 mysqladmin ping -h localhost -u testuser -ptestpass`,
            {
              stdio: "pipe",
            }
          );
          return true;
        case "mongodb":
          execSync(
            `docker exec sniffler-mongodb-7 mongosh --eval "db.adminCommand('ismaster')"`,
            {
              stdio: "pipe",
            }
          );
          return true;
        case "redis":
          execSync(`docker exec sniffler-redis-7 redis-cli ping`, {
            stdio: "pipe",
          });
          return true;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global database manager instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  databaseManager,
};
