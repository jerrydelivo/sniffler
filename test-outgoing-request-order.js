const axios = require("axios");

async function testOutgoingRequestOrder() {
  console.log("🧪 Testing outgoing request order...");

  // Proxy is running on port 4444, targeting https://jsonplaceholder.typicode.com
  const proxyUrl = "http://localhost:4444";

  try {
    // Make several requests with delays to ensure different timestamps
    console.log("📡 Making request 1...");
    await axios.get(`${proxyUrl}/posts/1`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("📡 Making request 2...");
    await axios.get(`${proxyUrl}/posts/2`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("📡 Making request 3...");
    await axios.get(`${proxyUrl}/posts/3`);

    console.log("✅ All requests completed successfully");
    console.log(
      "📋 Check the Sniffler UI to verify request order (newest should be at top)"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testOutgoingRequestOrder();
