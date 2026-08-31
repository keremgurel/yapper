import { auth } from "@clerk/nextjs/server";
import { makePrimaryBrandAsset, removeBrandAsset } from "@/lib/db/brand";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";

export const runtime = "nodejs";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await makePrimaryBrandAsset(userId, id))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await removeBrandAsset(userId, id))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  drainR2AfterResponse();
  return Response.json({ ok: true });
}
