/**
 * app/api/incidents/[id]/route.js
 * Proxies PATCH requests to mark an incident as resolved.
 */

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/api/incidents/${params.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}