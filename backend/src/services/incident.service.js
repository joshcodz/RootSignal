/**
 * src/services/incident.service.js
 * Saves incident data to the Neon Postgres incidents table.
 * Also provides a function to fetch incidents for the dashboard (Step 9).
 *
 * Input:  All pipeline data — sentry error, hypothesis deploy, AI result
 * Output: Saved incident row, returned as an object
 */

import pool from "../db/client.js";

/**
 * saveIncident
 * Inserts a new incident row into the incidents table.
 * Uses parameterised queries — no string interpolation ever.
 *
 * @param {object} params
 * @param {string} params.sentryIssueId
 * @param {string} params.errorMessage
 * @param {Date}   params.errorTimestamp
 * @param {string} params.serviceName
 * @param {object} params.hypothesis       - From correlator
 * @param {object} params.aiResult         - From ai.service
 * @returns {Promise<object>}              - The saved incident row
 */
export async function saveIncident({
  sentryIssueId,
  errorMessage,
  errorTimestamp,
  serviceName,
  hypothesis,
  aiResult,
}) {
  try {
    const result = await pool.query(
      `INSERT INTO incidents (
        sentry_issue_id,
        error_message,
        error_timestamp,
        service_name,
        hypothesis_deploy_sha,
        hypothesis_deploy_author,
        hypothesis_summary,
        confidence_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        sentryIssueId,
        errorMessage.slice(0, 1000), // cap length for DB safety
        errorTimestamp,
        serviceName,
        hypothesis.sha,
        hypothesis.author,
        aiResult.summary,
        aiResult.confidence,
      ]
    );

    const saved = result.rows[0];
    console.log(`[incident] Saved incident ID ${saved.id} for issue ${sentryIssueId} ✓`);
    return saved;
  } catch (err) {
    // Log but don't crash — if DB save fails the Slack message was already sent
    console.error(`[incident] Failed to save incident: ${err.message}`);
    throw err;
  }
}

/**
 * getIncidents
 * Fetches the most recent incidents for the dashboard.
 * Ordered by created_at descending — newest first.
 *
 * @param {number} limit  - Max number of incidents to return (default 20)
 * @returns {Promise<Array>}
 */
export async function getIncidents(limit = 20) {
  try {
    const result = await pool.query(
      `SELECT
        id,
        created_at,
        sentry_issue_id,
        error_message,
        error_timestamp,
        service_name,
        hypothesis_deploy_sha,
        hypothesis_deploy_author,
        hypothesis_summary,
        confidence_level,
        confirmed_correct,
        resolved_at,
        mttr_minutes
      FROM incidents
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (err) {
    console.error(`[incident] Failed to fetch incidents: ${err.message}`);
    throw err;
  }
}

/**
 * markIncidentResolved
 * Marks an incident as resolved and calculates MTTR.
 * Called from the dashboard when an engineer confirms resolution.
 *
 * @param {number} id           - Incident ID
 * @param {boolean} confirmed   - Was the hypothesis correct?
 * @returns {Promise<object>}   - Updated incident row
 */
export async function markIncidentResolved(id, confirmed) {
  try {
    const result = await pool.query(
      `UPDATE incidents
       SET
         resolved_at      = NOW(),
         confirmed_correct = $2,
         mttr_minutes     = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
       WHERE id = $1
       RETURNING *`,
      [id, confirmed]
    );

    if (result.rowCount === 0) {
      throw new Error(`Incident ID ${id} not found`);
    }

    const updated = result.rows[0];
    console.log(
      `[incident] Incident ${id} resolved — MTTR: ${Math.round(updated.mttr_minutes)} min ✓`
    );
    return updated;
  } catch (err) {
    console.error(`[incident] Failed to mark resolved: ${err.message}`);
    throw err;
  }
}