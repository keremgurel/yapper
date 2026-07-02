import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ownsKey, presignView, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";

/** Presigned R2 GET for playback — only for keys under the caller's own prefix. */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key || !ownsKey(userId, key)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const url = await presignView(key);
  return Response.json({ url });
}
