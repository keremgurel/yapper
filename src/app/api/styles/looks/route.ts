import { auth } from "@clerk/nextjs/server";
import { refusalResponse } from "@/lib/http/operation-result";
import { parseLookSave } from "@/lib/style-library/operations/look-input";
import { lookPayload } from "@/lib/style-library/operations/look-template";
import { saveLook } from "@/lib/style-library/operations/save-look";

export const runtime = "nodejs";

/** Save a new look, started from a library template or copied from one of the creator's own. */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const input = parseLookSave(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "bad_request" }, { status: 400 });
  const saved = await saveLook(userId, input);
  if (!saved.ok) return refusalResponse(saved);
  return Response.json({ look: lookPayload(saved.value) }, { status: 201 });
}
