import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { startResumableUpload } from "@/lib/feedback/gemini";

export const runtime = "nodejs";

// Mints a Gemini resumable-upload URL (server holds the key) so the client can
// PUT its video straight to Gemini — the big file never touches our function.
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { sizeBytes, mimeType } = (await req.json().catch(() => ({}))) as {
    sizeBytes?: number;
    mimeType?: string;
  };
  if (!sizeBytes || sizeBytes <= 0 || !mimeType?.startsWith("video/")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // Guard against absurd uploads (Gemini caps ~2GB; keep coaching clips modest).
  if (sizeBytes > 500 * 1024 * 1024) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  try {
    const uploadUrl = await startResumableUpload(sizeBytes, mimeType);
    return Response.json({ uploadUrl });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "upload_start_failed";
    const status = detail === "no_provider" ? 501 : 502;
    return Response.json({ error: "upload_start_failed", detail }, { status });
  }
}
