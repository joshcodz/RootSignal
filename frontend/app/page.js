/**
 * app/page.js
 * RootSignal incident dashboard.
 * Fetches incidents from the backend and displays them in a list.
 * Auto-refreshes every 30 seconds.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import IncidentCard from "../components/IncidentCard";
import StatsBar from "../components/StatsBar";

export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents?limit=20");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIncidents(data.incidents ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError("Could not connect to backend — is it running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30_000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            Root<span className="text-red-500">Signal</span>
          </h1>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <p className="text-xs text-gray-600">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={fetchIncidents}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Incident Dashboard</h2>
          <p className="text-gray-500 text-sm">
            AI-powered root cause analysis for production errors
          </p>
        </div>

        {/* Stats */}
        {!loading && !error && <StatsBar incidents={incidents} />}

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading incidents...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-gray-500 text-sm mt-2">
              Make sure the backend is running on{" "}
              {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}
            </p>
          </div>
        )}

        {!loading && !error && incidents.length === 0 && (
          <div className="border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-gray-300 font-medium">No incidents yet</p>
            <p className="text-gray-600 text-sm mt-2">
              Fire a test webhook to see RootSignal in action
            </p>
            <code className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-lg mt-4 inline-block">
              node scripts/test-sentry-webhook.js
            </code>
          </div>
        )}

        {!loading && !error && incidents.length > 0 && (
          <div className="flex flex-col gap-4">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onResolved={fetchIncidents}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}