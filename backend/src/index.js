/**
 * src/index.js
 * RootSignal Express server entry point.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./db/client.js";
import sentryRouter from "./routes/sentry.route.js";
import incidentsRouter from "./routes/incidents.route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  if (req.path === "/webhooks/sentry") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST", "PATCH"],
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use(sentryRouter);
app.use(incidentsRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`[server] RootSignal running on port ${PORT} ✓`);
    });
  } catch (err) {
    console.error("[server] Boot failed:", err.message);
    process.exit(1);
  }
}

boot();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[server] SIGINT received, shutting down...");
  process.exit(0);
});