/**
 * components/IncidentCard.js
 * Displays a single incident with hypothesis, confidence badge,
 * deploy info, and resolve buttons.
 *
 * Props: incident object, onResolved callback
 */

"use client";

import { useState } from "react";

const CONFIDENCE_STYLES = {
  high: "bg-red-500/20 text-red-400 border border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border border-green-500/30",
};

const CONFIDENCE_DOT = {
  high: "bg-red-400",
  medium: "bg-yellow-400",
  low: "bg-green-400",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentCard({ incident, onResolved }) {
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(!!incident.resolved_at);

  const confidence = incident.confidence_level ?? "low";

  async function handleResolve(confirmed) {
    setResolving(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_correct: confirmed }),
      });
      if (res.ok) {
        setResolved(true);
        onResolved?.();
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-4 transition-opacity ${
      resolved ? "border-gray-700 opacity-60" : "border-gray-700 bg-gray-900"
    }`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
              {incident.service_name}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${CONFIDENCE_STYLES[confidence]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[confidence]}`} />
              {confidence.toUpperCase()}
            </span>
            {resolved && (
              <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{timeAgo(incident.created_at)}</p>
        </div>
      </div>

      {/* Error message */}
      <div className="bg-gray-800 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 mb-1 font-medium">ERROR</p>
        <p className="text-sm text-red-400 font-mono break-all">
          {incident.error_message}
        </p>
      </div>

      {/* AI Hypothesis */}
      {incident.hypothesis_summary && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500 font-medium">🤖 ROOT CAUSE HYPOTHESIS</p>
          <p className="text-sm text-gray-200 leading-relaxed">
            {incident.hypothesis_summary}
          </p>
        </div>
      )}

      {/* Suspect deploy */}
      {incident.hypothesis_deploy_sha && (
        <div className="bg-gray-800 rounded-lg px-4 py-3 flex flex-col gap-1">
          <p className="text-xs text-gray-500 font-medium mb-1">📦 SUSPECT DEPLOY</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              {incident.hypothesis_deploy_sha.slice(0, 7)}
            </span>
            <span className="text-sm text-gray-300">
              by {incident.hypothesis_deploy_author}
            </span>
          </div>
        </div>
      )}

      {/* MTTR */}
      {incident.mttr_minutes && (
        <p className="text-xs text-gray-500">
          ⏱ MTTR: <span className="text-gray-300">{Math.round(incident.mttr_minutes)} min</span>
        </p>
      )}

      {/* Resolve buttons */}
      {!resolved && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleResolve(true)}
            disabled={resolving}
            className="flex-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg py-2 font-medium transition-colors disabled:opacity-50"
          >
            ✓ Hypothesis Correct
          </button>
          <button
            onClick={() => handleResolve(false)}
            disabled={resolving}
            className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg py-2 font-medium transition-colors disabled:opacity-50"
          >
            ✗ Not the cause
          </button>
        </div>
      )}
    </div>
  );
}