import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tripPlannerStates, trips } from "@/db/schema";
import { createInitialTrip } from "@/lib/trip-defaults";
import { normalizePlannerImport } from "@/lib/planner-state";
import type { PersistedPlannerStateV2 } from "@/types/trip";
import { desc, eq } from "drizzle-orm";

function defaultStateV2(): PersistedPlannerStateV2 {
  const trip = createInitialTrip();
  return {
    version: 2,
    trip,
    activeDayId: trip.days[0]!.id,
    travelMode: "WALKING",
    optimizeWaypoints: false,
    routeLegDurationsByDayId: {},
    multiModeLegSecondsByDayId: {},
  };
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: trips.id,
      name: trips.name,
      updatedAt: trips.updatedAt,
    })
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.updatedAt));

  return NextResponse.json({ trips: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; state?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const normalized = body.state
    ? normalizePlannerImport(body.state)
    : null;
  const state: PersistedPlannerStateV2 = normalized ?? defaultStateV2();

  const name = (body.name ?? state.trip.name).trim() || "Neue Reise";

  const [tripRow] = await db
    .insert(trips)
    .values({ userId, name })
    .returning({ id: trips.id, name: trips.name, updatedAt: trips.updatedAt });

  if (!tripRow) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  await db.insert(tripPlannerStates).values({
    tripId: tripRow.id,
    stateJson: state,
    updatedAt: new Date(),
  });

  return NextResponse.json({
    trip: tripRow,
    state,
  });
}
