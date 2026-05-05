/**
 * db/migrate.js
 * Creates the incidents and teams tables if they don't already exist.
 * Run once with: npm run migrate
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 *
 * Input:  DATABASE_URL env var (via db/client.js)
 * Output: Tables created in Neon Postgres, process exits 0 on success
 */

import pool, { testConnection } from "./client.js";
import dotenv from "dotenv";

dotenv.config();

const CREATE_TEAMS_TABLE = `
  CREATE TABLE IF NOT EXISTS teams (
    id               SERIAL PRIMARY KEY,
    name             TEXT        NOT NULL,
    github_repo      TEXT        NOT NULL,
    slack_channel_id TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const CREATE_INCIDENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS incidents (
    id                       SERIAL PRIMARY KEY,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    sentry_issue_id          TEXT         NOT NULL UNIQUE,
    error_message            TEXT         NOT NULL,
    error_timestamp          TIMESTAMPTZ  NOT NULL,
    service_name             TEXT         NOT NULL,
    hypothesis_deploy_sha    TEXT,
    hypothesis_deploy_author TEXT,
    hypothesis_summary       TEXT,
    confidence_level         TEXT         CHECK (confidence_level IN ('high', 'medium', 'low')),
    confirmed_correct        BOOLEAN      DEFAULT NULL,
    resolved_at              TIMESTAMPTZ  DEFAULT NULL,
    mttr_minutes             INTEGER      DEFAULT NULL
  );
`;

const CREATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_incidents_sentry_issue
    ON incidents (sentry_issue_id);
`;

async function migrate() {
  try {
    await testConnection();

    console.log("[migrate] Creating teams table...");
    await pool.query(CREATE_TEAMS_TABLE);

    console.log("[migrate] Creating incidents table...");
    await pool.query(CREATE_INCIDENTS_TABLE);

    console.log("[migrate] Creating indexes...");
    await pool.query(CREATE_INDEX);

    console.log("[migrate] All migrations complete ✓");
  } catch (err) {
    console.error("[migrate] Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
