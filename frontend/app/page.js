/**
 * app/page.js
 * Placeholder home page. Replaced with the full incident dashboard in Step 9.
 */

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-tight">
        Root<span className="text-red-500">Signal</span>
      </h1>
      <p className="text-gray-400 text-lg">
        AI-powered root cause analysis — dashboard coming in Step 9.
      </p>
      <div className="mt-4 px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 font-mono">
        Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}
      </div>
    </main>
  );
}
