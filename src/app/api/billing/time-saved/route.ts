import { auth } from "@clerk/nextjs/server";
import { editRunTotals } from "@/lib/db/edit-runs";
import { timeSavedSeconds } from "@/lib/studio/edit-run";

export const runtime = "nodejs";

/** What the creator's 1-Click Edits have saved them: the value side of the
 * credits they spent, for Home on the web and in the Mac app. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const totals = await editRunTotals(userId);
  return Response.json(
    { ...totals, savedSeconds: timeSavedSeconds(totals) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
