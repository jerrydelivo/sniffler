// Test script that sends a raw SQL query to trigger database proxy events
const net = require("net");

console.log("Testing database proxy with direct SQL query...");
console.log("Connecting to database proxy on port 4445...");

const socket = new net.Socket();

socket.connect(4445, "localhost", () => {
  console.log("✅ Connected to database proxy");

  // Send a PostgreSQL simple query message directly
  // This bypasses authentication and sends a query that should be intercepted
  const query = "SELECT 1 as test_column;";

  // PostgreSQL Simple Query message format:
  // 'Q' (0x51) + length (4 bytes) + query string + null terminator
  const queryBuffer = Buffer.alloc(5 + query.length + 1);
  queryBuffer.writeUInt8(0x51, 0); // 'Q' - Simple query
  queryBuffer.writeUInt32BE(4 + query.length + 1, 1); // Message length
  queryBuffer.write(query, 5); // Query string
  queryBuffer.writeUInt8(0, 5 + query.length); // Null terminator

  console.log("📤 Sending SQL query directly:", query);
  console.log("📦 Query buffer length:", queryBuffer.length);

  socket.write(queryBuffer);

  // Also try sending just raw text to see if anything gets intercepted
  setTimeout(() => {
    console.log("📤 Sending raw query text...");
    socket.write(query + "\n");
  }, 1000);
});

socket.on("data", (data) => {
  console.log("📥 Received response from proxy:", data.length, "bytes");
  console.log(
    "📄 Response data:",
    data.toString("utf8", 0, Math.min(100, data.length))
  );
});

socket.on("error", (error) => {
  console.log("❌ Database proxy test failed:", error.message);
  if (error.code) {
    console.log("Error code:", error.code);
  }
});

socket.on("close", () => {
  console.log("Connection closed");
  console.log("");
  console.log("🔍 Check the main Electron console for:");
  console.log('  - "🔍 Database query intercepted" messages');
  console.log('  - "📥 Received X bytes from client" messages');
  console.log("  - Any database proxy debug output");
  process.exit(0);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log("⏰ Test timeout");
  socket.destroy();
  process.exit(1);
}, 5000);
