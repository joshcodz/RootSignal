/**
 * scripts/test-sentry-webhook.js
 * Sends a fake Sentry webhook with a valid HMAC signature for local testing.
 * Run with: node scripts/test-sentry-webhook.js
 */

import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.SENTRY_WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;

if (!SECRET) {
  console.error("Set SENTRY_WEBHOOK_SECRET in backend/.env first");
  process.exit(1);
}

const payload = JSON.stringify({
  action: "created",
  data: {
    issue: {
      id: "test-issue-" + Date.now(),
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
              { filename: "src/services/auth.js", lineno: 42 },
              { filename: "src/routes/user.js", lineno: 18 },
              { filename: "src/index.js", lineno: 7 },
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

async function sendTestWebhook() {
  try {
    const response = await fetch(`http://localhost:${PORT}/webhooks/sentry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sentry-hook-signature": signature,
      },
      body: payload,
    });

    const json = await response.json();
    console.log(`[test] Status: ${response.status}`);
    console.log("[test] Response:", JSON.stringify(json, null, 2));

    if (response.status === 200) {
      console.log("\n✓ Webhook accepted — check server logs for pipeline output");
    } else {
      console.log("\n✗ Webhook rejected — check the error above");
    }
  } catch (err) {
    console.error("[test] Request failed:", err.message);
    console.log("Make sure the server is running: npm run dev");
  }
}

sendTestWebhook();