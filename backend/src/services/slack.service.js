/**
 * src/services/slack.service.js
 * Posts a formatted Block Kit message to Slack when a new incident is detected.
 * Uses Slack's Block Kit for rich formatting — buttons, sections, context blocks.
 *
 * Input:  aiResult, hypothesis deploy, error details, service name
 * Output: Slack message posted to SLACK_CHANNEL_ID
 */

import dotenv from "dotenv";
dotenv.config();

/**
 * getConfidenceEmoji
 * Returns an emoji for the confidence level for visual scanning in Slack.
 *
 * @param {string} confidence - "high" | "medium" | "low"
 * @returns {string}
 */
function getConfidenceEmoji(confidence) {
  const map = { high: "🔴", medium: "🟡", low: "🟢" };
  return map[confidence] ?? "⚪";
}

/**
 * buildSlackBlocks
 * Constructs the Slack Block Kit payload for a root cause hypothesis message.
 * Block Kit reference: https://api.slack.com/block-kit
 *
 * @param {object} aiResult     - { summary, confidence, whatToCheckFirst }
 * @param {object} hypothesis   - The highest scoring deploy from correlator
 * @param {string} errorMessage - From Sentry
 * @param {string} serviceName  - Sentry project slug
 * @returns {Array}             - Array of Slack Block Kit blocks
 */
function buildSlackBlocks(aiResult, hypothesis, errorMessage, serviceName) {
  const confidenceEmoji = getConfidenceEmoji(aiResult.confidence);
  const minutesAgo = Math.round(
    (Date.now() - hypothesis.timestamp.getTime()) / (1000 * 60)
  );

  return [
    // ── Header ──────────────────────────────────────────────────────────────
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 RootSignal — New Incident Detected`,
        emoji: true,
      },
    },

    // ── Error summary ────────────────────────────────────────────────────────
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Service:*\n\`${serviceName}\``,
        },
        {
          type: "mrkdwn",
          text: `*Confidence:*\n${confidenceEmoji} ${aiResult.confidence.toUpperCase()}`,
        },
      ],
    },

    // ── Error message ────────────────────────────────────────────────────────
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Error:*\n\`\`\`${errorMessage.slice(0, 300)}\`\`\``,
      },
    },

    { type: "divider" },

    // ── AI hypothesis ────────────────────────────────────────────────────────
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🤖 Root Cause Hypothesis:*\n${aiResult.summary}`,
      },
    },

    // ── What to check first ──────────────────────────────────────────────────
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔍 What to check first:*\n${aiResult.whatToCheckFirst}`,
      },
    },

    { type: "divider" },

    // ── Suspect deploy ───────────────────────────────────────────────────────
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📦 Suspect Deploy:*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Commit:*\n<${hypothesis.url}|\`${hypothesis.shortSha}\`>`,
        },
        {
          type: "mrkdwn",
          text: `*Author:*\n${hypothesis.author}`,
        },
        {
          type: "mrkdwn",
          text: `*Message:*\n${hypothesis.message.slice(0, 100)}`,
        },
        {
          type: "mrkdwn",
          text: `*Deployed:*\n${minutesAgo} min before error`,
        },
      ],
    },

    // ── Files changed ────────────────────────────────────────────────────────
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Files changed:* ${
            hypothesis.filesChanged?.length
              ? hypothesis.filesChanged.slice(0, 5).join(", ")
              : "none"
          }`,
        },
      ],
    },

    { type: "divider" },

    // ── Action buttons ───────────────────────────────────────────────────────
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Commit", emoji: true },
          url: hypothesis.url,
          style: "primary",
        },
      ],
    },

    // ── Footer ───────────────────────────────────────────────────────────────
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Powered by RootSignal • ${new Date().toUTCString()}_`,
        },
      ],
    },
  ];
}

/**
 * postToSlack
 * Sends the Block Kit message to the configured Slack channel.
 * Uses Slack's chat.postMessage API with the bot token.
 *
 * @param {object} aiResult     - { summary, confidence, whatToCheckFirst }
 * @param {object} hypothesis   - The highest scoring deploy
 * @param {string} errorMessage - From Sentry
 * @param {string} serviceName  - Sentry project slug
 * @returns {Promise<void>}
 */
export async function postToSlack(aiResult, hypothesis, errorMessage, serviceName) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN is not set");
    }
    if (!process.env.SLACK_CHANNEL_ID) {
      throw new Error("SLACK_CHANNEL_ID is not set");
    }

    const blocks = buildSlackBlocks(aiResult, hypothesis, errorMessage, serviceName);

    const body = {
      channel: process.env.SLACK_CHANNEL_ID,
      text: `🚨 RootSignal: New incident in ${serviceName} — ${aiResult.confidence} confidence hypothesis generated`,
      blocks,
    };

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    console.log(`[slack] Message posted to channel ${process.env.SLACK_CHANNEL_ID} ✓`);
  } catch (err) {
    // Log but don't crash the pipeline — Slack failing shouldn't stop the DB save
    console.error(`[slack] Failed to post message: ${err.message}`);
  }
}