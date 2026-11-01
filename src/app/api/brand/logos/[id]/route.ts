import { auth } from "@clerk/nextjs/server";
import { deleteBrandLogo } from "@/lib/brand/operations/delete-logo";
import { makePrimaryBrandAsset } from "@/lib/db/brand";
import { refusalResponse } from "@/lib/http/operation-result";

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
  const removed = await deleteBrandLogo(userId, id);
  if (!removed.ok) return refusalResponse(removed);
  return Response.json({ ok: true });
}
