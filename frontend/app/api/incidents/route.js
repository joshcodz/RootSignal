/**
 * app/api/incidents/route.js
 * Next.js API route — proxies requests to the Express backend.
 * Keeps the backend URL server-side so it's never exposed to the browser.
 *
 * GET  /api/incidents        — fetch recent incidents
 * PATCH /api/incidents/:id   — mark resolved (handled in [id]/route.js)
 */

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "20";

    const response = await fetch(
      `${BACKEND_URL}/api/incidents?limit=${limit}`,
      { cache: "no-store" }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch incidents", incidents: [] },
      { status: 500 }
    );
  }
}