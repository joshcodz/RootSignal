/**
 * db/client.js
 * Creates and exports a singleton Postgres connection pool using Neon.
 * All database queries across the app should import `pool` from here.
 *
 * Input:  process.env.DATABASE_URL (Neon connection string)
 * Output: pg.Pool instance
 */

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL; pg will use it automatically when sslmode=require is in the URL
  ssl: {
    rejectUnauthorized: false,
  },
  // Conservative pool sizing for Render free tier (512 MB RAM)
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Fail fast on startup if the DB is unreachable
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

/**
 * testConnection
 * Fires a lightweight query to verify the DB is reachable at boot time.
 * Throws if the connection fails so the process exits with a clear error.
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[DB] Connected to Neon Postgres ✓");
  } catch (err) {
    throw new Error(`[DB] Could not connect to Neon Postgres: ${err.message}`);
  }
}

export default pool;
