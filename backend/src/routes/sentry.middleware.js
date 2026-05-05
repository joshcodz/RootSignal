/**
 * src/routes/sentry.middleware.js
 * Verifies that incoming webhook requests genuinely came from Sentry.
 * Sentry signs each request with HMAC-SHA256 using your webhook secret.
 *
 * Input:  Raw request body (Buffer) + sentry-hook-signature header
 * Output: Calls next() if valid, returns 401 if signature is missing or wrong
 */

import crypto from "crypto";

function verifySentrySignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

export function sentryWebhookAuth(req, res, next) {
  try {
    const secret = process.env.SENTRY_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[sentry-auth] SENTRY_WEBHOOK_SECRET is not set");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers["sentry-hook-signature"];

    if (!signature) {
      console.warn("[sentry-auth] Missing sentry-hook-signature header");
      return res.status(401).json({ error: "Missing signature header" });
    }

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      console.warn("[sentry-auth] Empty or non-buffer body");
      return res.status(400).json({ error: "Invalid request body" });
    }

    const isValid = verifySentrySignature(rawBody, signature, secret);

    if (!isValid) {
      console.warn("[sentry-auth] Signature mismatch — possible spoofed request");
      return res.status(401).json({ error: "Invalid signature" });
    }

    req.sentryPayload = JSON.parse(rawBody.toString("utf8"));
    next();
  } catch (err) {
    console.error("[sentry-auth] Verification error:", err.message);
    return res.status(400).json({ error: "Could not verify webhook signature" });
  }
}