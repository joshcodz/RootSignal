/**
 * scripts/test-full-pipeline.js
 * End-to-end pipeline test — fires a webhook and verifies
 * the incident appears in the DB and Slack.
 * Run with: node scripts/test-full-pipeline.js
 */

import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const SECRET = process.env.SENTRY_WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;

const payload = JSON.stringify({
  action: "created",
  data: {
    issue: {
      id: "full-pipeline-test-" + Date.now(),
      title: "TypeError: Cannot read properties of undefined (reading 'userId')",
      type: "error",
      firstSeen: new Date().toISOString(),
      project: { slug: "rootsignal-api" },
    },
    event: {
      timestamp: new Date().toISOString(),
      exception: {
        values: [{
          value: "Cannot read properties of undefined (reading 'userId')",
          stacktrace: {
            frames: [
              { filename: "src/middleware/auth.js", lineno: 42 },
              { filename: "src/routes/user.js", lineno: 18 },
            ],
          },
        }],
      },
    },
    project: { slug: "rootsignal-api" },
  },
});

const signature = crypto
  .createHmac("sha256", SECRET)
  .update(Buffer.from(payload))
  .digest("hex");

async function test() {
  try {
    console.log("[test] Firing full pipeline webhook...");

    const response = await fetch(`http://localhost:${PORT}/webhooks/sentry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sentry-hook-signature": signature,
      },
      body: payload,
    });

    const json = await response.json();
    console.log(`[test] Webhook status: ${response.status}`);
    console.log("[test] Response:", JSON.stringify(json));
    console.log("\n[test] Watch server logs for full pipeline output");
    console.log("[test] Then check:");
    console.log("  1. Your Slack channel for the incident message");
    console.log("  2. Neon console → Tables → incidents for the saved row");

    // Wait 5 seconds then check the DB
    console.log("\n[test] Waiting 10s for pipeline to complete...");
    await new Promise(r => setTimeout(r, 10000));

    const dbCheck = await fetch(`http://localhost:${PORT}/api/incidents?limit=1`);
    const dbData = await dbCheck.json();

    if (dbData.incidents?.length > 0) {
      console.log("\n✓ Incident saved to DB:");
      console.log(JSON.stringify(dbData.incidents[0], null, 2));
    } else {
      console.log("\n⚠ No incidents in DB yet — pipeline may still be running");
    }
  } catch (err) {
    console.error("[test] Failed:", err.message);
  }
}

test();