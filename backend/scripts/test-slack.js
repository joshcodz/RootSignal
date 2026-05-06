/**
 * scripts/test-slack.js
 * Tests the Slack service by posting a mock incident message.
 * Run with: node scripts/test-slack.js
 */

import dotenv from "dotenv";
dotenv.config();

import { postToSlack } from "../src/services/slack.service.js";

const mockAiResult = {
  summary: "The error was likely caused by the recent auth middleware refactor that changed how sessions are accessed. The deploy is suspicious because it modified req.session.user to req.user?.session, which may not be set by the new session handler. The likely mechanism of failure is that req.user is undefined at the point of access, causing the TypeError.",
  confidence: "high",
  whatToCheckFirst: "Check the value of req.user in the auth middleware to confirm it is being populated by the session handler before being accessed.",
};

const mockHypothesis = {
  sha: "abc123def456abc123def456",
  shortSha: "abc123d",
  author: "Joshua K Biju",
  message: "refactor: update auth middleware to use new session handler",
  timestamp: new Date(Date.now() - 15 * 60 * 1000),
  filesChanged: ["src/middleware/auth.js", "src/services/session.js"],
  url: "https://github.com/joshcodz/RootSignal/commit/abc123d",
};

async function test() {
  try {
    console.log("[test] Posting mock incident to Slack...\n");
    await postToSlack(
      mockAiResult,
      mockHypothesis,
      "TypeError: Cannot read properties of undefined (reading 'userId')",
      "rootsignal-api"
    );
    console.log("✓ Check your Slack channel for the message");
  } catch (err) {
    console.error("[test] Failed:", err.message);
  }
}

test();