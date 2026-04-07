import { NextRequest, NextResponse } from "next/server";
import { fetchDayWeatherOpenMeteo } from "@/lib/open-meteo";

/**
 * Proxy zu Open-Meteo – vermeidet Client-Probleme (CORS, Parser auf unknown HTML).
 */
export async function GET(req: NextRequest) {
  const latRaw = req.nextUrl.searchParams.get("lat");
  const lngRaw = req.nextUrl.searchParams.get("lng");
  const dateRaw = req.nextUrl.searchParams.get("date");

  if (!latRaw || !lngRaw || !dateRaw) {
    return NextResponse.json(
      { error: "lat, lng und date (YYYY-MM-DD) sind erforderlich." },
      { status: 400 }
    );
  }

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const date = dateRaw.trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Ungültige Parameter." }, { status: 400 });
  }

  try {
    const snapshot = await fetchDayWeatherOpenMeteo(lat, lng, date);
    return NextResponse.json({ snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: `Wetterdienst: ${msg}` },
      { status: 502 }
    );
  }
}
