// Enhanced database proxy test that sends an actual SQL query
const net = require("net");

console.log("Testing database proxy with SQL query...");
console.log("Connecting to database proxy on port 4445...");

const socket = new net.Socket();

socket.connect(4445, "localhost", () => {
  console.log("✅ Connected to database proxy");

  // Send a simple PostgreSQL startup message
  const startupMessage = Buffer.alloc(28);
  startupMessage.writeInt32BE(28, 0); // Message length
  startupMessage.writeInt32BE(196608, 4); // Protocol version (3.0)
  startupMessage.write("user\0postgres\0database\0postgres\0\0", 8);

  console.log("📤 Sending startup message...");
  socket.write(startupMessage);
});

socket.on("data", (data) => {
  console.log("📥 Received data from proxy:", data.length, "bytes");

  // Check if this is an authentication request
  if (data[0] === 0x52) {
    // 'R' - Authentication
    const authType = data.readInt32BE(5);
    console.log("🔐 Authentication type:", authType);

    if (authType === 3) {
      // Clear text password
      console.log("📤 Sending password...");
      const passwordMsg = Buffer.alloc(13);
      passwordMsg.writeInt8(0x70, 0); // 'p' - Password message
      passwordMsg.writeInt32BE(12, 1); // Message length
      passwordMsg.write("password\0", 5);
      socket.write(passwordMsg);
    }
  } else if (data[0] === 0x5a) {
    // 'Z' - Ready for query
    console.log("✅ Ready for query! Sending SELECT statement...");

    // Send a simple SELECT query
    const query = "SELECT 1 AS test_column;";
    const queryMsg = Buffer.alloc(5 + query.length + 1);
    queryMsg.writeInt8(0x51, 0); // 'Q' - Query message
    queryMsg.writeInt32BE(4 + query.length + 1, 1); // Message length
    queryMsg.write(query + "\0", 5);

    console.log("📤 Sending SQL query:", query);
    socket.write(queryMsg);
  } else if (data[0] === 0x45) {
    // 'E' - Error
    const errorMsg = data.toString("utf8", 5);
    console.log("❌ Database error:", errorMsg);
  }
});

socket.on("error", (error) => {
  console.log("❌ Database proxy test failed:", error.message);
  if (error.code) {
    console.log("Error code:", error.code);
  }
});

socket.on("close", () => {
  console.log("Connection closed");
  process.exit(0);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log("⏰ Test timeout");
  socket.destroy();
  process.exit(1);
}, 5000);
