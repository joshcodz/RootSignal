/**
 * src/routes/sentry.route.js
 * Express router for POST /webhooks/sentry.
 * Full pipeline — Steps 1 through 7.
 */

import { Router } from "express";
import { sentryWebhookAuth } from "./sentry.middleware.js";
import { extractSentryError } from "./sentry.validator.js";
import { scoreDeploys } from "../services/correlator.service.js";
import { getRecentDeploys, getDeployDiff, resolveRepo } from "../services/github.service.js";
import { generateHypothesis } from "../services/ai.service.js";
import { postToSlack } from "../services/slack.service.js";
import { saveIncident } from "../services/incident.service.js";
import pool from "../db/client.js";

const router = Router();

/**
 * isDuplicateIssue
 * Checks if we've already processed this Sentry issue ID.
 *
 * @param {string} sentryIssueId
 * @returns {Promise<boolean>}
 */
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

/**
 * POST /webhooks/sentry
 * Full pipeline — validate → deduplicate → GitHub → correlate → AI → Slack → DB
 */
router.post(
  "/webhooks/sentry",
  sentryWebhookAuth,
  async (req, res) => {
    res.status(200).json({ received: true });

    try {
      const payload = req.sentryPayload;

      // Step 1: Validate payload
      const extracted = extractSentryError(payload);
      if (!extracted.valid) {
        console.log(`[sentry-route] Skipping: ${extracted.reason}`);
        return;
      }

      const { sentryIssueId, errorMessage, errorTimestamp, serviceName, stackFiles } =
        extracted.data;

      console.log(`[sentry-route] New error — issue: ${sentryIssueId}, service: ${serviceName}`);

      // Step 2: Deduplicate
      const duplicate = await isDuplicateIssue(sentryIssueId);
      if (duplicate) {
        console.log(`[sentry-route] Duplicate ${sentryIssueId} — skipping`);
        return;
      }

      // Step 3: Fetch GitHub deploys
      const repo = resolveRepo(serviceName);
      if (!repo) {
        console.error(`[sentry-route] No repo mapped for: ${serviceName}`);
        return;
      }
      const deploys = await getRecentDeploys(repo, errorTimestamp);

      // Step 4: Score and pick hypothesis
      const { hypothesis, confidence } = scoreDeploys(deploys, stackFiles, errorTimestamp);
      if (!hypothesis) {
        console.log("[sentry-route] No hypothesis — no deploys in window");
        return;
      }

      const diff = await getDeployDiff(repo, hypothesis.sha);
      hypothesis.filesChanged = diff.files;
      hypothesis.patch = diff.patch;

      // Step 5: AI summary
      const aiResult = await generateHypothesis(errorMessage, hypothesis, confidence);

      // Step 6: Post to Slack
      await postToSlack(aiResult, hypothesis, errorMessage, serviceName);

      // Step 7: Save to Postgres
      await saveIncident({
        sentryIssueId,
        errorMessage,
        errorTimestamp,
        serviceName,
        hypothesis,
        aiResult,
      });

      console.log(`[sentry-route] Pipeline complete ✓ — issue ${sentryIssueId}`);

    } catch (err) {
      console.error("[sentry-route] Pipeline error:", err.message);
    }
  }
);

export default router;