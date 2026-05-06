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
import dotenv from "dotenv";
dotenv.config();

// Base GitHub API client
const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  timeout: 10_000,
});

// Inject token per-request so it's always read fresh from env
github.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`;
  return config;
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

    const windowStart = new Date(
      errorTimestamp.getTime() - windowMinutes * 60 * 1000
    );

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

    const deploys = commits.map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      author: commit.commit?.author?.name ?? commit.author?.login ?? "unknown",
      authorUsername: commit.author?.login ?? "unknown",
      message: commit.commit?.message?.split("\n")[0] ?? "",
      timestamp: new Date(commit.commit?.author?.date),
      url: commit.html_url,
      filesChanged: [],
    }));

    console.log(
      `[github] Found ${deploys.length} commit(s) in window for repo ${repo}`
    );

    return deploys;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(
        `[github] Repo "${repo}" not found — check GITHUB_ACCESS_TOKEN has repo scope`
      );
    }
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
    const filenames = files.map((f) => f.filename).filter(Boolean);

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
 * for multi-service setups.
 *
 * @param {string} serviceName - Sentry project slug e.g. "rootsignal-api"
 * @returns {string|null}      - "owner/repo" or null if not found
 */
export function resolveRepo(serviceName) {
  if (process.env.GITHUB_REPO) {
    return process.env.GITHUB_REPO;
  }

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