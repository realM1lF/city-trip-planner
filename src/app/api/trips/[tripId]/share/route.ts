import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { slugForTripShareTitle } from "@/lib/trip-share-slug";
import { and, eq } from "drizzle-orm";

type Ctx = { params: Promise<{ tripId: string }> };

async function allocateUniqueShareKey(baseName: string): Promise<string> {
  const base = slugForTripShareTitle(baseName);
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db
      .select({ id: trips.id })
      .from(trips)
      .where(eq(trips.shareToken, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await ctx.params;

  const [row] = await db
    .select({
      id: trips.id,
      shareToken: trips.shareToken,
      name: trips.name,
    })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let token = row.shareToken;
  if (!token) {
    token = await allocateUniqueShareKey(row.name);
    await db.update(trips).set({ shareToken: token }).where(eq(trips.id, tripId));
  }

  const origin = publicOriginFromRequest(req);
  const shareUrl = `${origin}/share/${encodeURIComponent(token)}`;

  return NextResponse.json({ shareToken: token, shareUrl });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await ctx.params;

  const updated = await db
    .update(trips)
    .set({ shareToken: null })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning({ id: trips.id });

  if (!updated.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
