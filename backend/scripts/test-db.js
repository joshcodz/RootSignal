import dotenv from "dotenv";
dotenv.config();

import pg from "pg";

console.log("Connecting to:", process.env.DATABASE_URL?.slice(0, 50) + "...");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();
  console.log("Connected!");
  await client.end();
} catch (err) {
  console.log("Failed:", err.message);
  console.log("Error code:", err.code);
}