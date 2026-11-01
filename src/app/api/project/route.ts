import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { saveProjectBrain } from "@/lib/brain/operations/project";
import { listPillarsSeeded } from "@/lib/db/project-seed";
import { getActiveProject } from "@/lib/db/projects";
import { refusalResponse } from "@/lib/http/operation-result";
import { withServerTiming } from "@/lib/http/server-timing";
import { parsePillarInput, parseProjectInput } from "@/lib/project/input";

export const runtime = "nodejs";

/** Pillar names the creator typed during Studio onboarding, before this table
 * existed. Read straight off the Clerk user so a returning creator's first load
 * is already populated. */
function onboardingPillars(
  metadata: Record<string, unknown> | undefined,
): string[] {
  const onboarding = (metadata?.studioOnboarding ?? {}) as {
    pillars?: unknown;
  };
  return Array.isArray(onboarding.pillars)
    ? onboarding.pillars.filter((p): p is string => typeof p === "string")
    : [];
}

/**
 * The caller's project brain. Creates the row on first sight and, only while it
 * has no pillars at all, seeds them from onboarding plus whatever pillars their
 * existing library items were already classified under.
 */
export const GET = withServerTiming(async (): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Creates the user and project rows on first sight; afterwards one select.
  const project = await getActiveProject(userId);
  // Clerk is asked for onboarding pillars only while the project has none.
  const pillars = await listPillarsSeeded(userId, project.id, async () => {
    const user = await currentUser();
    return onboardingPillars(user?.unsafeMetadata as Record<string, unknown>);
  });
  return Response.json({ project, pillars });
});

/**
 * Save edits to the brain. Fields and pillars can arrive together or apart; a
 * key that is absent is left untouched, so the sheet's autosave can send only
 * what changed.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await saveProjectBrain(
    userId,
    parseProjectInput(body),
    parsePillarInput(body.pillars),
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}
