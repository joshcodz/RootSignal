/**
 * scripts/test-healthz.js
 * Verifies the /healthz endpoint is responding correctly.
 * Run with: node scripts/test-healthz.js (from backend folder)
 */

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3000;

async function test() {
  try {
    const response = await fetch(`http://localhost:${PORT}/healthz`);
    const data = await response.json();

    console.log(`[test] Status: ${response.status}`);
    console.log("[test] Response:", JSON.stringify(data, null, 2));

    if (response.status === 200 && data.status === "ok") {
      console.log("\n✓ /healthz working correctly — ready for UptimeRobot");
    } else {
      console.log("\n✗ /healthz returned unexpected response");
    }
  } catch (err) {
    console.error("[test] Failed:", err.message);
    console.log("Make sure server is running: npm run dev");
  }
}

test();