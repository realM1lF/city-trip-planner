import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tripPlannerStates, trips } from "@/db/schema";
import {
  isPersistedPlannerStateV2,
  normalizePlannerImport,
} from "@/lib/planner-state";
import type { PersistedPlannerStateV2 } from "@/types/trip";
import { and, eq } from "drizzle-orm";

type Ctx = { params: Promise<{ tripId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await ctx.params;

  const [row] = await db
    .select({
      id: trips.id,
      name: trips.name,
      updatedAt: trips.updatedAt,
      stateJson: tripPlannerStates.stateJson,
    })
    .from(trips)
    .innerJoin(tripPlannerStates, eq(tripPlannerStates.tripId, trips.id))
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = normalizePlannerImport(row.stateJson);
  if (!state || !isPersistedPlannerStateV2(state)) {
    return NextResponse.json({ error: "Invalid stored state" }, { status: 500 });
  }

  return NextResponse.json({
    trip: { id: row.id, name: row.name, updatedAt: row.updatedAt },
    state,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await ctx.params;

  const [owned] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string; state?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = body.state
    ? normalizePlannerImport(body.state)
    : null;
  if (!normalized || !isPersistedPlannerStateV2(normalized)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const name = (body.name ?? normalized.trip.name).trim() || "Reise";

  const now = new Date();

  await db
    .update(trips)
    .set({ name, updatedAt: now })
    .where(eq(trips.id, tripId));

  await db
    .update(tripPlannerStates)
    .set({ stateJson: normalized, updatedAt: now })
    .where(eq(tripPlannerStates.tripId, tripId));

  return NextResponse.json({
    trip: { id: tripId, name, updatedAt: now.toISOString() },
    state: normalized,
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await ctx.params;

  const deleted = await db
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning({ id: trips.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
