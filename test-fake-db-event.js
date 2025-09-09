// Test script to emit fake database query events to see if UI is listening
const { EventEmitter } = require("events");

// Simulate what the main process should do
console.log("🧪 Testing database query event emission...");

// This simulates what index.js should be doing when it receives database-query events
function simulateMainProcessEventHandling() {
  console.log("📡 Simulating main process receiving database-query event...");

  // Simulate a database query event
  const fakeQuery = {
    id: "test-query-123",
    connectionId: "conn-456",
    timestamp: new Date().toISOString(),
    proxyPort: 4445,
    proxyName: "Postgres",
    protocol: "postgresql",
    query: "SELECT * FROM test_table;",
    parameters: [],
    type: "SELECT",
    status: "executing",
    duration: null,
    response: null,
    error: null,
    startTime: Date.now(),
  };

  console.log("🔍 Fake database query event created:", fakeQuery);

  // This is what the main process event listener should do
  console.log(
    "🔍 Database query intercepted:",
    fakeQuery.id,
    fakeQuery.type,
    fakeQuery.query?.substring(0, 50) + "..."
  );

  // This is what should be sent to the UI
  console.log(
    '📤 Should send to UI via IPC: "database-proxy-query"',
    fakeQuery
  );

  console.log(
    "✅ Test complete - if UI shows 0 requests, the issue is in IPC communication or UI event handling"
  );
}

simulateMainProcessEventHandling();
