const { Client } = require("pg");

async function testRealTimeUIUpdates() {
  console.log("🚀 TESTING REAL-TIME UI UPDATES");
  console.log("==================================");
  console.log("");
  console.log("📋 Instructions:");
  console.log("1. Make sure Sniffler is running (npm run dev)");
  console.log("2. Open the UI at http://localhost:8765");
  console.log("3. Go to the 'Requests' tab");
  console.log("4. Watch for new database requests appearing in real-time");
  console.log("");
  console.log(
    "🔄 This test will run 5 database queries with 3-second intervals..."
  );
  console.log("");

  const queries = [
    "SELECT 1 as query_number, 'Real-time test query 1' as description",
    "SELECT 2 as query_number, 'Real-time test query 2' as description",
    "SELECT 3 as query_number, 'Real-time test query 3' as description",
    "SELECT 4 as query_number, 'Real-time test query 4' as description",
    "SELECT 5 as query_number, 'Real-time test query 5' as description",
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      console.log(`⏳ Query ${i + 1}/5: Connecting to database proxy...`);

      const client = new Client({
        host: "localhost",
        port: 4445, // Database proxy port
        user: "postgres",
        password: "postgres",
        database: "postgres",
      });

      await client.connect();

      const startTime = Date.now();
      console.log(`🔍 Query ${i + 1}/5: Executing query...`);
      const result = await client.query(queries[i]);
      const duration = Date.now() - startTime;

      console.log(`✅ Query ${i + 1}/5: Completed in ${duration}ms`);
      console.log(`   Result: ${JSON.stringify(result.rows[0])}`);
      console.log(
        `   👀 CHECK UI: This query should appear in the Requests tab!`
      );

      await client.end();

      if (i < queries.length - 1) {
        console.log(`⏰ Waiting 3 seconds before next query...`);
        console.log("");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`❌ Query ${i + 1}/5 failed:`, error.message);
      console.log("");
    }
  }

  console.log("");
  console.log("🏁 TEST COMPLETE!");
  console.log("==================================");
  console.log("");
  console.log("✅ Expected Results:");
  console.log("• 5 new database requests should appear in the UI Requests tab");
  console.log("• Each request should show method 'DB_QUERY'");
  console.log("• Requests should appear immediately after each query executes");
  console.log("• Database proxy stats should increment");
  console.log("");
  console.log("❌ If requests are NOT appearing in real-time:");
  console.log("• Check browser console for error messages");
  console.log("• Verify database proxy is running on port 4445");
  console.log("• Check main process logs for event emissions");
  console.log("• Ensure UI event listeners are properly set up");
}

// Run the test
testRealTimeUIUpdates().catch((error) => {
  console.error("\n❌ Real-time test failed:", error.message);
  process.exit(1);
});
