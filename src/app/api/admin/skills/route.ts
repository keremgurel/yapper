import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isAdmin, notFound } from "@/lib/auth/admin";
import { parseNewCatalogEntry } from "@/lib/brain/skill-input";
import { createCatalogEntry, listAllCatalog } from "@/lib/db/skill-catalog";

export const runtime = "nodejs";

/** Every entry including drafts. Admin only. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!isAdmin(userId)) return notFound();
  return Response.json({ entries: await listAllCatalog() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!isAdmin(userId)) return notFound();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNewCatalogEntry(body);
  if (!input) {
    return Response.json({ error: "slug_and_name" }, { status: 400 });
  }

  try {
    return Response.json(
      { entry: await createCatalogEntry(input) },
      {
        status: 201,
      },
    );
  } catch (error) {
    // The slug is unique, and a duplicate is the one failure worth naming: it
    // means the entry already exists and should be edited instead.
    console.error("[admin/skills] create failed", error);
    return Response.json({ error: "duplicate_slug" }, { status: 409 });
  }
}
