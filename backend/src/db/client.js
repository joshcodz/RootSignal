/**
 * db/client.js
 * Creates and exports a singleton Postgres connection pool using Neon.
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
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

/**
 * testConnection
 * Fires a lightweight query to verify the DB is reachable at boot time.
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