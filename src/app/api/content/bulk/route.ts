import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { bulkUpdateContent } from "@/lib/content/operations/bulk";
import { refusalResponse } from "@/lib/http/operation-result";

export const runtime = "nodejs";

/** Bulk actions for the shared item table (stage, delete, pillar, status). */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await bulkUpdateContent(userId, body);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ updated: result.value });
}
