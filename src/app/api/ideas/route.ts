import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { parseContentInput } from "@/lib/content/input";
import { createContentItem, listContentItems } from "@/lib/db/content";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { parseIdeaFields } from "@/lib/ideas/input";

export const runtime = "nodejs";

/** Everything currently sitting in the Idea Bank inbox. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const items = await listContentItems(userId, { stage: "bank" });
  return Response.json({ items });
}

/**
 * Capture an idea. Deliberately cheap and synchronous: it stores the creator's
 * exact words immediately and returns, so nothing is ever lost while the
 * (slower, fallible) reference resolution and AI expansion run afterwards.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { input: base } = parseContentInput(body);
  const idea = parseIdeaFields(body);

  const hasMaterial = Boolean(
    idea.originalNote?.trim() || base.sourceUrl?.trim(),
  );
  if (!hasMaterial) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  const item = await createContentItem(userId, {
    ...base,
    ...idea,
    projectId: project.id,
    // Ideas always start in the bank; a client cannot claim otherwise.
    stage: "bank",
    status: "drafted",
  });

  return Response.json({ item });
}
