/**
 * components/StatsBar.js
 * Displays summary stats at the top of the dashboard.
 * Props: incidents array
 */

export default function StatsBar({ incidents }) {
  const total = incidents.length;
  const resolved = incidents.filter(i => i.resolved_at).length;
  const high = incidents.filter(i => i.confidence_level === "high").length;
  const avgMttr = incidents
    .filter(i => i.mttr_minutes)
    .reduce((sum, i, _, arr) => sum + i.mttr_minutes / arr.length, 0);

  const stats = [
    { label: "Total Incidents", value: total },
    { label: "Resolved", value: resolved },
    { label: "High Confidence", value: high },
    { label: "Avg MTTR", value: avgMttr ? `${Math.round(avgMttr)}m` : "—" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{stat.value}</p>
          <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}