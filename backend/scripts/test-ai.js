/**
 * scripts/test-ai.js
 * Tests the AI service directly without needing a full webhook.
 * Run with: node scripts/test-ai.js
 */

import dotenv from "dotenv";
dotenv.config();

import { generateHypothesis } from "../src/services/ai.service.js";

const mockHypothesis = {
  sha: "abc123def456",
  shortSha: "abc123d",
  author: "Joshua K Biju",
  message: "refactor: update auth middleware to use new session handler",
  timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
  filesChanged: ["src/middleware/auth.js", "src/services/session.js"],
  patch: `--- src/middleware/auth.js ---
@@ -12,7 +12,7 @@
-  const session = req.session.user;
+  const session = req.user?.session;
   if (!session) return res.status(401).json({ error: 'Unauthorized' });`,
};

const mockError =
  "TypeError: Cannot read properties of undefined (reading 'userId')";

async function test() {
  try {
    console.log("[test] Generating AI hypothesis...\n");
    const result = await generateHypothesis(mockError, mockHypothesis, "high");

    console.log("── AI Result ──────────────────────────────────");
    console.log("Summary:\n", result.summary);
    console.log("\nConfidence:", result.confidence);
    console.log("\nWhat to check first:\n", result.whatToCheckFirst);
    console.log("───────────────────────────────────────────────");
    console.log("\n✓ AI service working correctly");
  } catch (err) {
    console.error("[test] Failed:", err.message);
  }
}

test();