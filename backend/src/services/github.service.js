/**
 * src/services/github.service.js
 * Fetches recent deployments and commit diffs from GitHub REST API.
 * Used by the correlation algorithm (Step 4) to find the deploy
 * most likely responsible for a Sentry error.
 *
 * Inputs:  GITHUB_ACCESS_TOKEN + GITHUB_REPO (owner/repo format) from env
 * Outputs: Array of deploy objects, diff string for a specific SHA
 */

import axios from "axios";

// Base GitHub API client — all requests share these headers
const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  timeout: 10_000,
});

/**
 * getRecentDeploys
 * Fetches the last N commits to the default branch from GitHub,
 * filtered to only those made within `windowMinutes` before the error.
 * We use commits as a proxy for deploys — good enough for most teams.
 *
 * @param {string} repo            - "owner/repo" e.g. "acme/api-service"
 * @param {Date}   errorTimestamp  - When the Sentry error occurred
 * @param {number} windowMinutes   - How far back to look (default: 120 = 2 hours)
 * @param {number} maxResults      - Max commits to return (default: 10)
 * @returns {Promise<Array>}       - Array of deploy objects
 */
export async function getRecentDeploys(
  repo,
  errorTimestamp,
  windowMinutes = 120,
  maxResults = 10
) {
  try {
    if (!repo) {
      throw new Error("repo is required in owner/repo format");
    }

    if (!process.env.GITHUB_ACCESS_TOKEN) {
      throw new Error("GITHUB_ACCESS_TOKEN is not set in environment");
    }

    // Calculate the window start — commits before this are ignored
    const windowStart = new Date(
      errorTimestamp.getTime() - windowMinutes * 60 * 1000
    );

    // Fetch commits up to the error timestamp (not after — future commits can't cause past errors)
    const response = await github.get(`/repos/${repo}/commits`, {
      params: {
        until: errorTimestamp.toISOString(),
        since: windowStart.toISOString(),
        per_page: maxResults,
      },
    });

    const commits = response.data;

    if (!Array.isArray(commits) || commits.length === 0) {
      console.log(
        `[github] No commits found in the ${windowMinutes}-min window before error`
      );
      return [];
    }

    // Normalise into a consistent shape for the scoring algorithm
    const deploys = commits.map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      author: commit.commit?.author?.name ?? commit.author?.login ?? "unknown",
      authorUsername: commit.author?.login ?? "unknown",
      message: commit.commit?.message?.split("\n")[0] ?? "", // first line only
      timestamp: new Date(commit.commit?.author?.date),
      url: commit.html_url,
      filesChanged: [], // populated lazily by getDeployDiff if needed
    }));

    console.log(
      `[github] Found ${deploys.length} commit(s) in window for repo ${repo}`
    );

    return deploys;
  } catch (err) {
    // 404 = repo not found or token has no access
    if (err.response?.status === 404) {
      throw new Error(
        `[github] Repo "${repo}" not found — check GITHUB_ACCESS_TOKEN has repo scope`
      );
    }
    // 401 = bad token
    if (err.response?.status === 401) {
      throw new Error(
        "[github] GitHub token is invalid or expired — check GITHUB_ACCESS_TOKEN"
      );
    }
    throw new Error(`[github] getRecentDeploys failed: ${err.message}`);
  }
}

/**
 * getDeployDiff
 * Fetches the full file diff for a specific commit SHA.
 * Returns the list of changed files + a truncated patch string
 * to send to the AI (Step 5).
 *
 * @param {string} repo   - "owner/repo"
 * @param {string} sha    - Full commit SHA
 * @returns {Promise<{ files: string[], patch: string }>}
 */
export async function getDeployDiff(repo, sha) {
  try {
    if (!repo || !sha) {
      throw new Error("repo and sha are both required");
    }

    const response = await github.get(`/repos/${repo}/commits/${sha}`);
    const commitData = response.data;

    const files = commitData.files ?? [];

    // Extract just the filenames for overlap scoring
    const filenames = files.map((f) => f.filename).filter(Boolean);

    // Build a truncated patch string — Gemini has a context limit
    // Cap each file patch at 300 chars, total at 4000 chars
    const MAX_PATCH_PER_FILE = 300;
    const MAX_TOTAL_PATCH = 4000;

    let totalPatch = "";
    for (const file of files) {
      if (totalPatch.length >= MAX_TOTAL_PATCH) break;
      const patch = file.patch ?? "";
      const entry = `\n--- ${file.filename} ---\n${patch.slice(0, MAX_PATCH_PER_FILE)}`;
      totalPatch += entry;
    }

    console.log(
      `[github] Diff for ${sha.slice(0, 7)}: ${filenames.length} file(s) changed`
    );

    return {
      files: filenames,
      patch: totalPatch.slice(0, MAX_TOTAL_PATCH),
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(
        `[github] Commit "${sha}" not found in repo "${repo}"`
      );
    }
    throw new Error(`[github] getDeployDiff failed: ${err.message}`);
  }
}

/**
 * resolveRepo
 * Maps a Sentry service/project slug to a GitHub "owner/repo" string.
 * Checks GITHUB_REPO env var first, then falls back to GITHUB_REPO_MAP
 * which is a JSON map of slug → repo for multi-service setups.
 *
 * @param {string} serviceName - Sentry project slug e.g. "rootsignal-api"
 * @returns {string|null}      - "owner/repo" or null if not found
 *
 * Example .env entries:
 *   GITHUB_REPO=acme/api-service                          (single repo)
 *   GITHUB_REPO_MAP={"rootsignal-api":"acme/api","web":"acme/web"}  (multi)
 */
export function resolveRepo(serviceName) {
  // Single-repo setup — one token maps to one repo
  if (process.env.GITHUB_REPO) {
    return process.env.GITHUB_REPO;
  }

  // Multi-repo setup — JSON map of service slug → owner/repo
  if (process.env.GITHUB_REPO_MAP) {
    try {
      const map = JSON.parse(process.env.GITHUB_REPO_MAP);
      const repo = map[serviceName];
      if (repo) return repo;
      console.warn(
        `[github] No repo mapping found for service "${serviceName}" in GITHUB_REPO_MAP`
      );
      return null;
    } catch {
      console.error(
        "[github] GITHUB_REPO_MAP is not valid JSON — check your .env"
      );
      return null;
    }
  }

  console.warn(
    "[github] Neither GITHUB_REPO nor GITHUB_REPO_MAP is set — cannot resolve repo"
  );
  return null;
}