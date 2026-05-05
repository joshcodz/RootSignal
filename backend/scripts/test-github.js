/**
 * scripts/test-github.js
 * Tests the GitHub service against your real repo.
 * Run with: node scripts/test-github.js
 */

import dotenv from "dotenv";
dotenv.config();

import { getRecentDeploys, getDeployDiff, resolveRepo } from "../src/services/github.service.js";

async function test() {
  try {
    const serviceName = "rootsignal-api";
    const repo = resolveRepo(serviceName);

    if (!repo) {
      console.error("Set GITHUB_REPO in your .env file first");
      process.exit(1);
    }

    console.log(`\n[test] Using repo: ${repo}`);
    console.log("[test] Fetching commits from last 2 hours...\n");

    const errorTimestamp = new Date();
    const deploys = await getRecentDeploys(repo, errorTimestamp);

    if (deploys.length === 0) {
      console.log("[test] No commits found in the last 2 hours.");
      console.log("       Try pushing a commit first, or this is expected on quiet repos.");
      return;
    }

    console.log(`[test] Found ${deploys.length} commit(s):\n`);
    deploys.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d.shortSha} — ${d.author} — "${d.message}"`);
      console.log(`     ${d.timestamp.toISOString()}`);
    });

    const latest = deploys[0];
    console.log(`\n[test] Fetching diff for latest commit: ${latest.shortSha}...`);
    const diff = await getDeployDiff(repo, latest.sha);

    console.log(`[test] Files changed: ${diff.files.join(", ") || "none"}`);
    console.log(`[test] Patch preview:\n${diff.patch.slice(0, 300)}...\n`);
    console.log("✓ GitHub service working correctly");
  } catch (err) {
    console.error("[test] Failed:", err.message);
  }
}

test();