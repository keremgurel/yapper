import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { installCatalogEntry } from "@/lib/brain/operations/install";
import { refusalResponse } from "@/lib/http/operation-result";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

/** Take a copy: a skill becomes the creator's own skill, a context entry an
 * ordinary section (see installCatalogEntry). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;

  const result = await installCatalogEntry(userId, slug);
  if (!result.ok) return refusalResponse(result);
  const { block, skill } = result.value;
  return Response.json(block ? { block } : { skill }, { status: 201 });
}
