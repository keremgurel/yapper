import { auth } from "@clerk/nextjs/server";
import { listStyleLooks } from "@/lib/db/style-looks";
import { styleCatalog } from "@/lib/style-library/catalog";
import { lookPayload } from "@/lib/style-library/operations/look-template";
import { describeTemplate } from "@/lib/style-library/templates/describe-template";
import { TEMPLATES } from "@/lib/style-library/templates/registry";

export const runtime = "nodejs";

/** Everything a gallery shows: the library's blocks by shelf, its templates, and the creator's saved looks. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const looks = await listStyleLooks(userId);
  return Response.json({
    shelves: styleCatalog(),
    templates: TEMPLATES.map(describeTemplate),
    looks: looks.map(lookPayload),
  });
}
