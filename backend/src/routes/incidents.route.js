/**
 * src/routes/incidents.route.js
 * REST API routes for the incidents dashboard.
 * Used by the Next.js frontend in Step 9.
 *
 * GET  /api/incidents        — fetch recent incidents
 * PATCH /api/incidents/:id   — mark incident as resolved
 */

import { Router } from "express";
import { getIncidents, markIncidentResolved } from "../services/incident.service.js";

const router = Router();

/**
 * GET /api/incidents
 * Returns the 20 most recent incidents for the dashboard.
 */
router.get("/api/incidents", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "limit must be between 1 and 100" });
    }

    const incidents = await getIncidents(limit);
    res.status(200).json({ incidents });
  } catch (err) {
    console.error("[incidents-route] GET failed:", err.message);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

/**
 * PATCH /api/incidents/:id
 * Marks an incident as resolved.
 * Body: { confirmed_correct: true | false }
 */
router.patch("/api/incidents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid incident ID" });
    }

    const { confirmed_correct } = req.body;

    if (typeof confirmed_correct !== "boolean") {
      return res
        .status(400)
        .json({ error: "confirmed_correct must be a boolean" });
    }

    const updated = await markIncidentResolved(id, confirmed_correct);
    res.status(200).json({ incident: updated });
  } catch (err) {
    console.error("[incidents-route] PATCH failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;