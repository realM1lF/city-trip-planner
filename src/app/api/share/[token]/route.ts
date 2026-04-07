import { NextResponse } from "next/server";
import { db } from "@/db";
import { tripPlannerStates, trips } from "@/db/schema";
import {
  isPersistedPlannerStateV2,
  normalizePlannerImport,
} from "@/lib/planner-state";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;

  const [row] = await db
    .select({
      name: trips.name,
      stateJson: tripPlannerStates.stateJson,
    })
    .from(trips)
    .innerJoin(tripPlannerStates, eq(tripPlannerStates.tripId, trips.id))
    .where(eq(trips.shareToken, token))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = normalizePlannerImport(row.stateJson);
  if (!state || !isPersistedPlannerStateV2(state)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 500 });
  }

  return NextResponse.json({ name: row.name, state });
}
