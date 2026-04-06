import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "missing" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { key },
    { headers: { "Cache-Control": "no-store" } }
  );
}
