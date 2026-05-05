/**
 * src/routes/sentry.route.js
 * Express router for POST /webhooks/sentry.
 * Receives validated Sentry payloads and kicks off the RootSignal pipeline.
 */

import { Router } from "express";
import { sentryWebhookAuth } from "./sentry.middleware.js";
import { extractSentryError } from "./sentry.validator.js";
import pool from "../db/client.js";

const router = Router();

async function isDuplicateIssue(sentryIssueId) {
  try {
    const result = await pool.query(
      "SELECT id FROM incidents WHERE sentry_issue_id = $1 LIMIT 1",
      [sentryIssueId]
    );
    return result.rowCount > 0;
  } catch (err) {
    console.error("[sentry-route] Duplicate check failed:", err.message);
    return false;
  }
}

router.post(
  "/webhooks/sentry",
  sentryWebhookAuth,
  async (req, res) => {
    res.status(200).json({ received: true });

    try {
      const payload = req.sentryPayload;

      const extracted = extractSentryError(payload);
      if (!extracted.valid) {
        console.log(`[sentry-route] Skipping webhook: ${extracted.reason}`);
        return;
      }

      const { sentryIssueId, errorMessage, errorTimestamp, serviceName, stackFiles } =
        extracted.data;

      console.log(`[sentry-route] New error received — issue: ${sentryIssueId}, service: ${serviceName}`);

      const duplicate = await isDuplicateIssue(sentryIssueId);
      if (duplicate) {
        console.log(`[sentry-route] Duplicate issue ${sentryIssueId} — skipping`);
        return;
      }

      // TODO Step 3: const deploys = await fetchRecentDeploys(serviceName, errorTimestamp);
      // TODO Step 4: const hypothesis = scoreDeploys(deploys, stackFiles, errorTimestamp);
      // TODO Step 5: const summary = await generateHypothesis(errorMessage, hypothesis);
      // TODO Step 6: await postToSlack(summary, hypothesis, errorMessage, serviceName);
      // TODO Step 7: await saveIncident({ sentryIssueId, errorMessage, errorTimestamp, serviceName, ...summary });

      console.log("[sentry-route] Pipeline placeholder reached ✓", {
        sentryIssueId,
        errorMessage,
        errorTimestamp,
        serviceName,
        stackFilesCount: stackFiles.length,
      });
    } catch (err) {
      console.error("[sentry-route] Pipeline error:", err.message);
    }
  }
);

export default router;